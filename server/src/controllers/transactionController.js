
const inventoryService = require('../services/inventoryService');
const db = require('../config/database');

exports.getTransactions = async (req, res, next) => {
    try {
        const { start, end, warehouse, type } = req.query;
        let query = `
            SELECT t.*, w.name AS warehouse_name, p.name AS partner_name
            FROM transactions t
            JOIN warehouses w ON t.source_warehouse_id = w.id
            LEFT JOIN partners p ON t.partner_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (start) { query += ' AND t.date >= ?'; params.push(start); }
        if (end) { query += ' AND t.date <= ?'; params.push(end); }
        if (warehouse && warehouse !== 'ALL') { query += ' AND t.source_warehouse_id = ?'; params.push(warehouse); }
        if (type && type !== 'ALL') { query += ' AND t.type = ?'; params.push(type); }
        query += ' ORDER BY t.date DESC, t.created_at DESC';

        const [txs] = await db.query(query, params);
        for (const tx of txs) {
            const [items] = await db.query(
                `SELECT ti.*, i.name, i.code FROM transaction_items ti JOIN items i ON ti.item_id = i.id WHERE ti.transaction_id = ?`,
                [tx.id]
            );
            tx.items = items.map(it => ({
                itemId: it.item_id, qty: Number(it.qty), unit: it.unit, ratio: Number(it.conversion_ratio), note: it.note, name: it.name, code: it.code
            }));
            tx.sourceWarehouseId = tx.source_warehouse_id;
            tx.referenceNo = tx.reference_no;
            tx.partnerName = tx.partner_name;
            tx.partnerId = tx.partner_id;
        }
        return res.json(txs);
    } catch (error) { next(error); }
};

exports.createTransaction = async (req, res, next) => {
    try {
        const { type } = req.body;
        const user = req.user || { id: '000', name: 'System' };
        let result = type === 'IN' ? await inventoryService.processInboundTransaction(req.body, user) : await inventoryService.processOutboundTransaction(req.body, user);
        return res.status(201).json({ success: true, data: result });
    } catch (error) { next(error); }
};

exports.updateTransaction = async (req, res, next) => {
    try {
        const result = await inventoryService.updateTransaction(req.params.id, req.body, { id: '000' });
        return res.json({ success: true, ...result });
    } catch (error) { next(error); }
};

exports.deleteTransaction = async (req, res, next) => {
    const { id } = req.params;
    console.log(`>>> [TX_CTRL] DELETE START: ${id} at ${new Date().toISOString()}`);
    
    // Set Header untuk cegah proxy gantung
    res.setHeader('Connection', 'close');
    res.setHeader('Content-Type', 'application/json');

    try {
        await inventoryService.deleteTransaction(id);
        console.log(`>>> [TX_CTRL] DELETE SUCCESS: ${id}`);
        return res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        console.error(`>>> [TX_CTRL] DELETE ERROR: ${id} -> ${error.message}`);
        return res.status(error.code === 'INSUFFICIENT_STOCK' ? 409 : 500).json({
            success: false,
            message: error.message
        });
    }
};
