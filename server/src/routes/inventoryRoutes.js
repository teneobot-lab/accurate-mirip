
const router = require('express').Router();
const db = require('../config/database');

router.get('/items', async (req, res, next) => {
    try {
        const [items] = await db.query('SELECT * FROM items');
        res.json(items);
    } catch(e) { next(e); }
});

router.get('/warehouses', async (req, res, next) => {
    try {
        const [wh] = await db.query('SELECT * FROM warehouses');
        res.json(wh);
    } catch(e) { next(e); }
});

module.exports = router;
