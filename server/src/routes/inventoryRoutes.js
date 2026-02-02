
const router = require('express').Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// --- ITEMS ---
router.get('/items', async (req, res, next) => {
    try {
        const [items] = await db.query('SELECT * FROM items');
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
    try {
        const { code, name, category, baseUnit, minStock, initialStock } = req.body;
        const id = req.body.id || uuidv4();
        
        await db.query(
            'INSERT INTO items (id, code, name, category, base_unit, min_stock) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), base_unit=VALUES(base_unit), min_stock=VALUES(min_stock)',
            [id, code, name, category, baseUnit, minStock]
        );

        if (initialStock > 0) {
            const [whs] = await db.query('SELECT id FROM warehouses LIMIT 1');
            if (whs.length > 0) {
                await db.query(
                    'INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE qty = VALUES(qty)',
                    [whs[0].id, id, initialStock]
                );
            }
        }

        res.status(201).json({ status: 'success', id });
    } catch(e) { next(e); }
});

// --- WAREHOUSES ---
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

// --- PARTNERS (SUPPLIERS / CUSTOMERS) ---
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
        
        // Handle password update if provided
        if (password) {
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            await db.query(
                'INSERT INTO users (id, username, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE username=VALUES(username), password_hash=VALUES(password_hash), full_name=VALUES(full_name), role=VALUES(role), status=VALUES(status)',
                [userId, username, hashedPassword, name, role || 'STAFF', status || 'ACTIVE']
            );
        } else {
            // Update without changing password
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

// --- STOCKS ---
router.get('/stocks', async (req, res, next) => {
    try {
        const [stocks] = await db.query('SELECT item_id as itemId, warehouse_id as warehouseId, qty FROM stock');
        res.json(stocks);
    } catch(e) { next(e); }
});

module.exports = router;
