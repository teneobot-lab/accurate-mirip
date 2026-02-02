
const router = require('express').Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// --- OUTLETS ---
router.get('/outlets', async (req, res, next) => {
    try {
        const [ols] = await db.query('SELECT name FROM reject_outlets ORDER BY name ASC');
        res.json(ols.map(o => o.name));
    } catch (e) { next(e); }
});

router.post('/outlets', async (req, res, next) => {
    try {
        const { name } = req.body;
        await db.query('INSERT INTO reject_outlets (name) VALUES (?) ON DUPLICATE KEY UPDATE name=VALUES(name)', [name]);
        res.status(201).json({ status: 'success' });
    } catch (e) { next(e); }
});

// --- MASTER ITEMS (ISOLATED) ---
router.get('/master-items', async (req, res, next) => {
    try {
        const [items] = await db.query('SELECT * FROM reject_master_items ORDER BY created_at DESC');
        for (let item of items) {
            const [units] = await db.query('SELECT unit_name as name, conversion_ratio as ratio, operator FROM reject_master_units WHERE item_id = ?', [item.id]);
            item.conversions = units;
            item.baseUnit = item.base_unit;
        }
        res.json(items);
    } catch (e) { next(e); }
});

router.post('/master-items', async (req, res, next) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        const { id, code, name, category, baseUnit, conversions } = req.body;
        const itemId = id || uuidv4();
        
        await conn.query(
            'INSERT INTO reject_master_items (id, code, name, category, base_unit) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE code=VALUES(code), name=VALUES(name), category=VALUES(category), base_unit=VALUES(base_unit)',
            [itemId, code, name, category, baseUnit]
        );

        await conn.query('DELETE FROM reject_master_units WHERE item_id = ?', [itemId]);
        if (Array.isArray(conversions)) {
            for (const conv of conversions) {
                if (conv.name && conv.ratio) {
                    await conn.query(
                        'INSERT INTO reject_master_units (item_id, unit_name, conversion_ratio, operator) VALUES (?, ?, ?, ?)',
                        [itemId, conv.name, conv.ratio, conv.operator || '*']
                    );
                }
            }
        }

        await conn.commit();
        res.status(201).json({ status: 'success', id: itemId });
    } catch (e) { 
        await conn.rollback();
        next(e); 
    } finally {
        conn.release();
    }
});

router.post('/master-items/bulk-upsert', async (req, res, next) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        const { items } = req.body;
        for (const item of items) {
            const itemId = item.id || uuidv4();
            await conn.query(
                'INSERT INTO reject_master_items (id, code, name, category, base_unit) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), base_unit=VALUES(base_unit)',
                [itemId, item.code, item.name, item.category, item.baseUnit]
            );
            
            // Support simplified conversion string in bulk import if needed, but for now assuming conversions array
            if (Array.isArray(item.conversions)) {
                await conn.query('DELETE FROM reject_master_units WHERE item_id = ?', [itemId]);
                for (const conv of item.conversions) {
                    await conn.query(
                        'INSERT INTO reject_master_units (item_id, unit_name, conversion_ratio, operator) VALUES (?, ?, ?, ?)',
                        [itemId, conv.name, conv.ratio, conv.operator || '*']
                    );
                }
            }
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

router.delete('/master-items/:id', async (req, res, next) => {
    try {
        await db.query('DELETE FROM reject_master_items WHERE id = ?', [req.params.id]);
        res.json({ status: 'success' });
    } catch (e) { next(e); }
});

// --- TRANSACTIONS (ISOLATED - DOES NOT AFFECT STOCK) ---
router.get('/batches', async (req, res, next) => {
    try {
        const [batches] = await db.query('SELECT * FROM reject_batches ORDER BY date DESC, created_at DESC');
        for (let b of batches) {
            const [items] = await db.query('SELECT * FROM reject_items WHERE batch_id = ?', [b.id]);
            b.items = items;
        }
        res.json(batches);
    } catch (e) { next(e); }
});

router.post('/batches', async (req, res, next) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        const { id, date, outlet, items } = req.body;
        const batchId = id || uuidv4();
        
        await conn.query(
            'INSERT INTO reject_batches (id, date, outlet) VALUES (?, ?, ?)',
            [batchId, date, outlet]
        );

        for (const it of items) {
            await conn.query(
                `INSERT INTO reject_items (batch_id, item_id, sku, name, qty, unit, base_qty, reason)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [batchId, it.itemId, it.sku, it.name, it.qty, it.unit, it.baseQty, it.reason]
            );
        }

        await conn.commit();
        res.status(201).json({ status: 'success', id: batchId });
    } catch (e) {
        await conn.rollback();
        next(e);
    } finally {
        conn.release();
    }
});

router.delete('/batches/:id', async (req, res, next) => {
    try {
        await db.query('DELETE FROM reject_batches WHERE id = ?', [req.params.id]);
        res.json({ status: 'success' });
    } catch (e) { next(e); }
});

module.exports = router;
