
const router = require('express').Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// --- ITEMS ---
router.get('/items', async (req, res, next) => {
    try {
        const [items] = await db.query('SELECT * FROM items ORDER BY created_at DESC');
        for (let item of items) {
            const [units] = await db.query('SELECT unit_name as name, conversion_ratio as ratio, operator FROM item_units WHERE item_id = ?', [item.id]);
            item.conversions = units;
            item.baseUnit = item.base_unit; 
            item.minStock = item.min_stock;
        }
        res.json(items);
    } catch(e) { next(e); }
});

router.post('/items', async (req, res, next) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        const { id, code, name, category, baseUnit, minStock, initialStock, conversions } = req.body;
        const itemId = id || uuidv4();
        
        // 1. Save Header
        await conn.query(
            'INSERT INTO items (id, code, name, category, base_unit, min_stock) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE code=VALUES(code), name=VALUES(name), category=VALUES(category), base_unit=VALUES(base_unit), min_stock=VALUES(min_stock)',
            [itemId, code, name, category, baseUnit, minStock]
        );

        // 2. Clear & Save Units
        await conn.query('DELETE FROM item_units WHERE item_id = ?', [itemId]);
        if (Array.isArray(conversions)) {
            for (const conv of conversions) {
                if (conv.name && conv.ratio) {
                    await conn.query(
                        'INSERT INTO item_units (item_id, unit_name, conversion_ratio, operator) VALUES (?, ?, ?, ?)',
                        [itemId, conv.name, conv.ratio, conv.operator || '*']
                    );
                }
            }
        }

        // 3. Initial Stock (Accurate Logic: Only for new items)
        if (!id && initialStock > 0) {
            const [whs] = await conn.query('SELECT id FROM warehouses LIMIT 1');
            if (whs.length > 0) {
                await conn.query(
                    'INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)',
                    [whs[0].id, itemId, initialStock]
                );
            }
        }

        await conn.commit();
        res.status(201).json({ status: 'success', id: itemId });
    } catch(e) { 
        await conn.rollback();
        next(e); 
    } finally {
        conn.release();
    }
});

router.post('/items/bulk-upsert', async (req, res, next) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) throw new Error("Invalid payload format");

        for (const item of items) {
            const itemId = item.id || uuidv4();
            await conn.query(
                'INSERT INTO items (id, code, name, category, base_unit, min_stock) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), base_unit=VALUES(base_unit), min_stock=VALUES(min_stock)',
                [itemId, item.code, item.name, item.category, item.baseUnit, item.minStock || 0]
            );
        }

        await conn.commit();
        res.json({ status: 'success', count: items.length });
    } catch (e) {
        await conn.rollback();
        next(e);
    } finally {
        conn.release();
    }
});

// FIXED: Bulk Delete with Transaction and Constraint Check
router.post('/items/bulk-delete', async (req, res, next) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "No IDs provided" });
        
        // 1. Check if any item has transactions
        const [used] = await conn.query('SELECT item_id FROM transaction_items WHERE item_id IN (?) LIMIT 1', [ids]);
        if (used.length > 0) {
            const err = new Error("Sebagian item tidak bisa dihapus karena sudah memiliki riwayat transaksi.");
            err.status = 409;
            throw err;
        }

        // 2. Cascade manually if needed (though schema should handle)
        await conn.query('DELETE FROM item_units WHERE item_id IN (?)', [ids]);
        await conn.query('DELETE FROM stock WHERE item_id IN (?)', [ids]);
        
        // 3. Final Delete
        const [result] = await conn.query('DELETE FROM items WHERE id IN (?)', [ids]);
        
        await conn.commit();
        res.json({ status: 'success', count: result.affectedRows });
    } catch(e) { 
        await conn.rollback();
        next(e); 
    } finally {
        conn.release();
    }
});

// --- WAREHOUSES, PARTNERS, USERS, STOCKS (Tetap sama) ---
router.get('/warehouses', async (req, res, next) => {
    try {
        const [wh] = await db.query('SELECT * FROM warehouses');
        res.json(wh);
    } catch(e) { next(e); }
});

router.post('/warehouses', async (req, res, next) => {
    try {
        const { id, name, location, phone, pic } = req.body;
        const whId = id || uuidv4();
        await db.query(
            'INSERT INTO warehouses (id, name, location, phone, pic) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), location=VALUES(location), phone=VALUES(phone), pic=VALUES(pic)',
            [whId, name, location, phone, pic]
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

router.get('/partners', async (req, res, next) => {
    try {
        const [pt] = await db.query('SELECT * FROM partners');
        res.json(pt);
    } catch(e) { next(e); }
});

router.post('/partners', async (req, res, next) => {
    try {
        const { id, type, name, phone, email, address, npwp, term } = req.body;
        const ptId = id || uuidv4();
        await db.query(
            'INSERT INTO partners (id, type, name, phone, email, address, npwp, term_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE type=VALUES(type), name=VALUES(name), phone=VALUES(phone), email=VALUES(email), address=VALUES(address), npwp=VALUES(npwp), term_days=VALUES(term_days)',
            [ptId, type, name, phone, email, address, npwp, term || 0]
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
        
        if (password) {
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            await db.query(
                'INSERT INTO users (id, username, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE username=VALUES(username), password_hash=VALUES(password_hash), full_name=VALUES(full_name), role=VALUES(role), status=VALUES(status)',
                [userId, username, hashedPassword, name, role || 'STAFF', status || 'ACTIVE']
            );
        } else {
            await db.query(
                'INSERT INTO users (id, username, full_name, role, status, password_hash) VALUES (?, ?, ?, ?, ?, "TEMP") ON DUPLICATE KEY UPDATE username=VALUES(username), full_name=VALUES(full_name), role=VALUES(role), status=VALUES(status)',
                [userId, username, name, role || 'STAFF', status || 'ACTIVE']
            );
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

router.get('/stocks', async (req, res, next) => {
    try {
        const [stocks] = await db.query('SELECT item_id as itemId, warehouse_id as warehouseId, qty FROM stock');
        res.json(stocks);
    } catch(e) { next(e); }
});

module.exports = router;
