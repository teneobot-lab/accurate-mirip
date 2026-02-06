
const router = require('express').Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// --- OUTLETS ---
router.get('/outlets', async (req, res, next) => {
    try {
        const [ols] = await db.query('SELECT name FROM reject_outlets ORDER BY name ASC');
        res.json(ols.map(o => o.name));
    } catch (e) { 
        next(e); 
    }
});

router.post('/outlets', async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: "Nama outlet wajib diisi" });
        await db.query('INSERT INTO reject_outlets (name) VALUES (?) ON DUPLICATE KEY UPDATE name=VALUES(name)', [name]);
        res.status(201).json({ status: 'success' });
    } catch (e) { 
        next(e); 
    }
});

// --- MASTER ITEMS (ISOLATED) ---
router.get('/master-items', async (req, res, next) => {
    try {
        const [items] = await db.query('SELECT * FROM reject_master_items ORDER BY created_at DESC');
        for (let item of items) {
            const [units] = await db.query('SELECT unit_name as name, conversion_ratio as ratio, operator FROM reject_master_units WHERE item_id = ?', [item.id]);
            item.conversions = units || [];
            item.baseUnit = item.base_unit;
        }
        res.json(items);
    } catch (e) { 
        next(e); 
    }
});

router.post('/master-items', async (req, res, next) => {
    let conn = null;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const { id, code, name, category, baseUnit, conversions } = req.body;
        
        if (!code || !name || !baseUnit) {
            throw new Error("Field Code, Name, dan Base Unit wajib diisi");
        }

        const itemId = id || uuidv4();
        
        // Save Master Item Header
        await conn.query(
            `INSERT INTO reject_master_items (id, code, name, category, base_unit) 
             VALUES (?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
                code = VALUES(code), 
                name = VALUES(name), 
                category = VALUES(category), 
                base_unit = VALUES(base_unit)`,
            [itemId, code, name, category || null, baseUnit]
        );

        // Clear existing conversions
        await conn.query('DELETE FROM reject_master_units WHERE item_id = ?', [itemId]);
        
        // Save new conversions
        if (Array.isArray(conversions)) {
            for (const conv of conversions) {
                if (conv.name && conv.ratio) {
                    await conn.query(
                        'INSERT INTO reject_master_units (item_id, unit_name, conversion_ratio, operator) VALUES (?, ?, ?, ?)',
                        [itemId, conv.name, Number(conv.ratio), conv.operator || '*']
                    );
                }
            }
        }

        await conn.commit();
        res.status(201).json({ status: 'success', id: itemId });
    } catch (e) { 
        if (conn) await conn.rollback();
        console.error("[REJECT_MASTER_POST_ERROR]", e);
        next(e); 
    } finally {
        if (conn) conn.release();
    }
});

router.delete('/master-items/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM reject_master_items WHERE id = ?', [id]);
        res.json({ status: 'success' });
    } catch (e) { 
        next(e); 
    }
});

// --- TRANSACTIONS (ISOLATED) ---
router.get('/batches', async (req, res, next) => {
    try {
        const [batches] = await db.query('SELECT * FROM reject_batches ORDER BY date DESC, created_at DESC');
        for (let b of batches) {
            const [items] = await db.query('SELECT * FROM reject_items WHERE batch_id = ?', [b.id]);
            // PENTING: Map properti database ke format yang dimengerti Frontend
            b.items = items.map(it => ({
                itemId: it.item_id,
                sku: it.sku,
                name: it.name,
                qty: Number(it.qty),
                unit: it.unit,
                baseQty: Number(it.base_qty), // Mapping dari base_qty ke baseQty
                reason: it.reason
            }));
        }
        res.json(batches);
    } catch (e) { 
        next(e); 
    }
});

router.post('/batches', async (req, res, next) => {
    let conn = null;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const { id, date, outlet, items } = req.body;
        if (!items || items.length === 0) throw new Error("Item transaksi afkir tidak boleh kosong");

        const batchId = id || uuidv4();
        
        await conn.query(
            'INSERT INTO reject_batches (id, date, outlet) VALUES (?, ?, ?)',
            [batchId, date, outlet]
        );

        for (const it of items) {
            // Gunakan baseQty dari payload frontend
            const baseQty = Number(it.baseQty || it.qty); 
            await conn.query(
                `INSERT INTO reject_items (batch_id, item_id, sku, name, qty, unit, base_qty, reason)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [batchId, it.itemId, it.sku, it.name, Number(it.qty), it.unit, baseQty, it.reason || null]
            );
        }

        await conn.commit();
        res.status(201).json({ status: 'success', id: batchId });
    } catch (e) {
        if (conn) await conn.rollback();
        console.error("[REJECT_BATCH_POST_ERROR]", e);
        next(e);
    } finally {
        if (conn) conn.release();
    }
});

router.delete('/batches/:id', async (req, res, next) => {
    try {
        await db.query('DELETE FROM reject_batches WHERE id = ?', [req.params.id]);
        res.json({ status: 'success' });
    } catch (e) { 
        next(e); 
    }
});

module.exports = router;
