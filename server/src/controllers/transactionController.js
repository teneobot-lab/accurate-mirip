
const inventoryService = require('../services/inventoryService');
const db = require('../config/database');

exports.createTransaction = async (req, res, next) => {
    try {
        const { type } = req.body;
        const user = { id: 'admin-uuid', name: 'System Admin' }; 

        let result;
        if (type === 'IN') {
            result = await inventoryService.processInboundTransaction(req.body, user);
        } else if (type === 'OUT') {
            result = await inventoryService.processOutboundTransaction(req.body, user);
        } else {
            return res.status(400).json({ message: 'Tipe transaksi tidak didukung' });
        }

        res.status(201).json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

exports.updateTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = { id: 'admin-uuid' };
        const result = await inventoryService.updateTransaction(id, req.body, user);
        res.json({ status: 'success', data: result });
    } catch (error) {
        next(error);
    }
};

exports.deleteTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        await inventoryService.deleteTransaction(id);
        res.json({ status: 'success', message: 'Transaksi berhasil dihapus dan stok diperbarui' });
    } catch (error) {
        next(error);
    }
};

exports.getTransactions = async (req, res, next) => {
    try {
        const { start, end, warehouse, type } = req.query;
        let query = `
            SELECT t.*, w.name as warehouse_name, p.name as partner_name 
            FROM transactions t
            JOIN warehouses w ON t.source_warehouse_id = w.id
            LEFT JOIN partners p ON t.partner_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (start) { query += " AND t.date >= ?"; params.push(start); }
        if (end) { query += " AND t.date <= ?"; params.push(end); }
        if (warehouse && warehouse !== 'ALL') { query += " AND t.source_warehouse_id = ?"; params.push(warehouse); }
        if (type && type !== 'ALL') { query += " AND t.type = ?"; params.push(type); }

        query += " ORDER BY t.date DESC, t.created_at DESC";

        const [txs] = await db.query(query, params);
        
        // Fetch items for each transaction
        for (let tx of txs) {
            const [items] = await db.query(`
                SELECT ti.*, i.name, i.code 
                FROM transaction_items ti
                JOIN items i ON ti.item_id = i.id
                WHERE ti.transaction_id = ?
            `, [tx.id]);
            tx.items = items.map(it => ({
                itemId: it.item_id,
                qty: Number(it.qty),
                unit: it.unit,
                ratio: Number(it.conversion_ratio),
                note: it.note,
                name: it.name,
                code: it.code
            }));
            tx.sourceWarehouseId = tx.source_warehouse_id;
            tx.referenceNo = tx.reference_no;
            tx.partnerName = tx.partner_name;
        }

        res.json(txs);
    } catch (error) {
        next(error);
    }
};
