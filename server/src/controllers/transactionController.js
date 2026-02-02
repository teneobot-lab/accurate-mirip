
const inventoryService = require('../services/inventoryService');
const db = require('../config/database');

exports.createTransaction = async (req, res, next) => {
    try {
        const { type } = req.body;
        const user = req.user || { id: 'admin-uuid', name: 'System Admin' }; 

        let result;
        if (type === 'IN') {
            result = await inventoryService.processInboundTransaction(req.body, user);
        } else if (type === 'OUT') {
            result = await inventoryService.processOutboundTransaction(req.body, user);
        } else {
            return res.status(400).json({ status: 'error', message: 'Tipe transaksi tidak didukung' });
        }

        return res.status(201).json({ status: 'success', data: result });
    } catch (error) {
        console.error('CREATE TX ERROR:', error);
        return res.status(error.code === 'INSUFFICIENT_STOCK' ? 409 : 500).json({
            success: false,
            message: error.message || 'Gagal membuat transaksi'
        });
    }
};

exports.updateTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user || { id: 'admin-uuid', name: 'System Admin' };
        
        console.log(`[CONTROLLER] Processing PUT /transactions/${id}`);
        const result = await inventoryService.updateTransaction(id, req.body, user);
        
        return res.json({ success: true, ...result });
    } catch (error) {
        console.error('[CONTROLLER-ERROR] Failed to update TX:', error.message);
        
        // Pola Status Code Sesuai Permintaan User (404, 409, 500)
        let statusCode = 500;
        if (error.message.includes('tidak ditemukan')) statusCode = 404;
        else if (error.code === 'INSUFFICIENT_STOCK' || error.message.includes('mencukupi')) statusCode = 409;
        
        return res.status(statusCode).json({ 
            success: false, 
            message: error.message || 'Gagal update transaksi'
        });
    }
};

exports.deleteTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        await inventoryService.deleteTransaction(id);
        return res.json({ success: true, message: 'Transaksi berhasil dihapus dan stok diperbarui' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getTransactions = async (req, res, next) => {
    try {
        const { start, end, warehouse, type } = req.query;
        let query = `
            SELECT t.*, w.name as warehouse_name, p.name as partner_name, t.partner_id
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
            tx.partnerId = tx.partner_id;
        }

        return res.json(txs);
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};
