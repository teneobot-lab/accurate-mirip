
const router = require('express').Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// --- SYSTEM CONFIG (Google Sheets URL etc) ---
router.get('/config/:key', async (req, res, next) => {
    try {
        const { key } = req.params;
        const [rows] = await db.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
        if (rows.length > 0) {
            res.json({ key, value: rows[0].setting_value });
        } else {
            res.json({ key, value: '' });
        }
    } catch(e) { next(e); }
});

router.post('/config', async (req, res, next) => {
    try {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ message: "Key is required" });
        
        await db.query(
            'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
            [key, value]
        );
        res.json({ status: 'success', key, value });
    } catch(e) { next(e); }
});

// --- ITEMS ---
router.get('/items', async (req, res, next) => {
    try {
        const [items] = await db.query('SELECT * FROM items ORDER BY created_at DESC');
        for (let item of items) {
            const [units] = await db.query('SELECT unit_name as name, conversion_ratio as ratio, operator FROM item_units WHERE item_id = ?', [item.id]);
            item.conversions = units || [];
            item.baseUnit = item.base_unit; 
            item.minStock = item.min_stock;
            item.isActive = !!item.is_active; // Map DB column to API property
        }
        res.json(items);
    } catch(e) { 
        next(e); 
    }
});

router.post('/items', async (req, res, next) => {
    let conn = null;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const { id, code, name, category, baseUnit, minStock, initialStock, conversions, isActive } = req.body;
        const itemId = id || uuidv4();
        
        // Convert boolean/undefined to 1 or 0
        const isActiveVal = (isActive === undefined || isActive === true) ? 1 : 0;

        // 1. Save Header
        await conn.query(
            `INSERT INTO items (id, code, name, category, base_unit, min_stock, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
                code=VALUES(code), name=VALUES(name), category=VALUES(category), 
                base_unit=VALUES(base_unit), min_stock=VALUES(min_stock), is_active=VALUES(is_active)`,
            [itemId, code, name, category, baseUnit, minStock || 0, isActiveVal]
        );

        // 2. Clear & Save Units
        await conn.query('DELETE FROM item_units WHERE item_id = ?', [itemId]);
        if (Array.isArray(conversions)) {
            for (const conv of conversions) {
                if (conv.name && conv.ratio) {
                    await conn.query(
                        'INSERT INTO item_units (item_id, unit_name, conversion_ratio, operator) VALUES (?, ?, ?, ?)',
                        [itemId, conv.name, Number(conv.ratio), conv.operator || '*']
                    );
                }
            }
        }

        // 3. Initial Stock (Only for new items)
        if (!id && Number(initialStock) > 0) {
            const [whs] = await conn.query('SELECT id FROM warehouses LIMIT 1');
            if (whs.length > 0) {
                await conn.query(
                    'INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)',
                    [whs[0].id, itemId, Number(initialStock)]
                );
            }
        }

        await conn.commit();
        res.status(201).json({ status: 'success', id: itemId });
    } catch(e) { 
        if (conn) await conn.rollback();
        next(e); 
    } finally {
        if (conn) conn.release();
    }
});

router.post('/items/bulk-upsert', async (req, res, next) => {
    let conn = null;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const { items } = req.body;
        if (!Array.isArray(items)) throw new Error("Payload items harus berupa array");

        for (const item of items) {
            const itemId = item.id || uuidv4();
            const isActiveVal = 1; // Bulk insert defaults to active

            await conn.query(
                `INSERT INTO items (id, code, name, category, base_unit, min_stock, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                    name=VALUES(name), category=VALUES(category), 
                    base_unit=VALUES(base_unit), min_stock=VALUES(min_stock)`,
                [itemId, item.code, item.name, item.category, item.baseUnit, item.minStock || 0, isActiveVal]
            );
        }

        await conn.commit();
        res.json({ status: 'success', count: items.length });
    } catch (e) {
        if (conn) await conn.rollback();
        next(e);
    } finally {
        if (conn) conn.release();
    }
});

router.post('/items/bulk-delete', async (req, res, next) => {
    let conn = null;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "No IDs provided" });
        
        const [used] = await conn.query('SELECT item_id FROM transaction_items WHERE item_id IN (?) LIMIT 1', [ids]);
        if (used.length > 0) {
            const err = new Error("Beberapa item tidak bisa dihapus karena memiliki riwayat transaksi.");
            err.status = 409;
            throw err;
        }

        await conn.query('DELETE FROM item_units WHERE item_id IN (?)', [ids]);
        await conn.query('DELETE FROM stock WHERE item_id IN (?)', [ids]);
        const [result] = await conn.query('DELETE FROM items WHERE id IN (?)', [ids]);
        
        await conn.commit();
        res.json({ status: 'success', count: result.affectedRows });
    } catch(e) { 
        if (conn) await conn.rollback();
        next(e); 
    } finally {
        if (conn) conn.release();
    }
});

// --- WAREHOUSES ---
router.get('/warehouses', async (req, res, next) => {
    try {
        const [whs] = await db.query('SELECT * FROM warehouses');
        const mappedWhs = whs.map(w => ({
            ...w,
            isActive: !!w.is_active // Map from DB to Frontend
        }));
        res.json(mappedWhs);
    } catch(e) { next(e); }
});

router.post('/warehouses', async (req, res, next) => {
    try {
        const { id, name, location, phone, pic, isActive } = req.body;
        const whId = id || uuidv4();
        
        const isActiveVal = (isActive === undefined || isActive === true) ? 1 : 0;

        await db.query(
            `INSERT INTO warehouses (id, name, location, phone, pic, is_active) 
             VALUES (?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE name=VALUES(name), location=VALUES(location), phone=VALUES(phone), pic=VALUES(pic), is_active=VALUES(is_active)`,
            [whId, name, location, phone, pic, isActiveVal]
        );
        res.status(201).json({ status: 'success', id: whId });
    } catch(e) { next(e); }
});

router.delete('/warehouses/:id', async (req, res, next) => {
    try {
        await db.query('DELETE FROM warehouses WHERE id = ?', [req.params.id]);
        res.json({ status: 'success' });
    } catch(e) { next(e); }
});

// --- PARTNERS ---
router.get('/partners', async (req, res, next) => {
    try {
        const [partners] = await db.query('SELECT * FROM partners');
        // Map snake_case db column to camelCase API property
        const mappedPartners = partners.map(p => ({
            ...p,
            isActive: !!p.is_active
        }));
        res.json(mappedPartners);
    } catch(e) { next(e); }
});

router.post('/partners', async (req, res, next) => {
    try {
        const { id, type, name, phone, email, address, npwp, term, isActive } = req.body;
        const ptId = id || uuidv4();
        
        const isActiveVal = (isActive === undefined || isActive === true) ? 1 : 0;

        await db.query(
            `INSERT INTO partners (id, type, name, phone, email, address, npwp, term_days, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE type=VALUES(type), name=VALUES(name), phone=VALUES(phone), email=VALUES(email), address=VALUES(address), npwp=VALUES(npwp), term_days=VALUES(term_days), is_active=VALUES(is_active)`,
            [ptId, type, name, phone, email, address, npwp, term || 0, isActiveVal]
        );
        res.status(201).json({ status: 'success', id: ptId });
    } catch(e) { next(e); }
});

router.delete('/partners/:id', async (req, res, next) => {
    try {
        await db.query('DELETE FROM partners WHERE id = ?', [req.params.id]);
        res.json({ status: 'success' });
    } catch(e) { next(e); }
});

// --- USERS ---
router.get('/users', async (req, res, next) => {
    try {
        const [users] = await db.query('SELECT id, username, full_name as name, role, status FROM users');
        res.json(users);
    } catch(e) { next(e); }
});

router.post('/users', async (req, res, next) => {
    try {
        const { id, username, password, name, role, status } = req.body;
        const userId = id || uuidv4();
        
        // Ensure status is valid
        const userStatus = (status === 'INACTIVE') ? 'INACTIVE' : 'ACTIVE';

        if (password) {
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            await db.query(
                `INSERT INTO users (id, username, password_hash, full_name, role, status) 
                 VALUES (?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE username=VALUES(username), password_hash=VALUES(password_hash), full_name=VALUES(full_name), role=VALUES(role), status=VALUES(status)`,
                [userId, username, hashedPassword, name, role || 'STAFF', userStatus]
            );
        } else {
            // IF creating new user without password, set a default
            // IF updating existing user without password, DO NOT CHANGE password_hash
            
            // Check if user exists
            const [existing] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
            
            if (existing.length === 0) {
                 // New user without password -> set default "123456"
                 const defaultHash = crypto.createHash('sha256').update('123456').digest('hex');
                 await db.query(
                    `INSERT INTO users (id, username, full_name, role, status, password_hash) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [userId, username, name, role || 'STAFF', userStatus, defaultHash]
                );
            } else {
                // Update without changing password
                await db.query(
                    `UPDATE users SET username=?, full_name=?, role=?, status=? WHERE id=?`,
                    [username, name, role || 'STAFF', userStatus, userId]
                );
            }
        }
        res.status(201).json({ status: 'success', id: userId });
    } catch(e) { next(e); }
});

router.delete('/users/:id', async (req, res, next) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ status: 'success' });
    } catch(e) { next(e); }
});

// --- STOCKS ---
router.get('/stocks', async (req, res, next) => {
    try {
        const [stocks] = await db.query('SELECT item_id as itemId, warehouse_id as warehouseId, qty FROM stock');
        res.json(stocks);
    } catch(e) { next(e); }
});

module.exports = router;
