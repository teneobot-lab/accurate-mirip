
const router = require('express').Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

router.get('/items', async (req, res, next) => {
    try {
        const [items] = await db.query('SELECT * FROM items');
        // Ambil unit konversi untuk setiap item
        for (let item of items) {
            const [units] = await db.query('SELECT unit_name as name, conversion_ratio as ratio, operator FROM item_units WHERE item_id = ?', [item.id]);
            item.conversions = units;
            item.baseUnit = item.base_unit; // Mapping ke camelCase frontend
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
            'INSERT INTO items (id, code, name, category, base_unit, min_stock) VALUES (?, ?, ?, ?, ?, ?)',
            [id, code, name, category, baseUnit, minStock]
        );

        // Jika ada stok awal, masukkan ke gudang pertama yang tersedia
        if (initialStock > 0) {
            const [whs] = await db.query('SELECT id FROM warehouses LIMIT 1');
            if (whs.length > 0) {
                await db.query(
                    'INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, ?)',
                    [whs[0].id, id, initialStock]
                );
            }
        }

        res.status(201).json({ status: 'success', id });
    } catch(e) { next(e); }
});

router.get('/warehouses', async (req, res, next) => {
    try {
        const [wh] = await db.query('SELECT * FROM warehouses');
        res.json(wh);
    } catch(e) { next(e); }
});

router.get('/stocks', async (req, res, next) => {
    try {
        const [stocks] = await db.query('SELECT item_id as itemId, warehouse_id as warehouseId, qty FROM stock');
        res.json(stocks);
    } catch(e) { next(e); }
});

module.exports = router;
