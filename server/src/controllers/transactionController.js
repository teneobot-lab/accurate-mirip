
const inventoryService = require('../services/inventoryService');
const db = require('../config/database');

/**
 * CREATE TRANSACTION
 */
exports.createTransaction = async (req, res, next) => {
    try {
        const { type, items, referenceNo, sourceWarehouseId } = req.body;
        
        // Normalisasi User
        const user = req.user || { 
            id: '00000000-0000-0000-0000-000000000000', 
            name: 'System Admin' 
        };

        // Validasi Dasar
        if (!referenceNo || referenceNo.trim() === "") {
            return res.status(400).json({ success: false, message: 'Nomor referensi wajib diisi' });
        }
        if (!sourceWarehouseId) {
            return res.status(400).json({ success: false, message: 'Gudang asal wajib dipilih' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Baris item transaksi tidak boleh kosong' });
        }

        let result;
        if (type === 'IN') {
            result = await inventoryService.processInboundTransaction(req.body, user);
        } else if (type === 'OUT') {
            result = await inventoryService.processOutboundTransaction(req.body, user);
        } else {
            return res.status(400).json({ success: false, message: 'Tipe transaksi tidak valid' });
        }

        return res.status(201).json({ success: true, data: result });

    } catch (error) {
        console.error('[TX_CONTROLLER] Error:', error);

        // Handle MySQL Duplicate Entry (Error 1062)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Gagal: Nomor referensi sudah terdaftar di sistem.'
            });
        }

        // Handle Insufficient Stock
        if (error.code === 'INSUFFICIENT_STOCK') {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan sistem saat menyimpan transaksi.'
        });
    }
};

/**
 * UPDATE TRANSACTION
 */
exports.updateTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user || { id: '00000000-0000-0000-0000-000000000000', name: 'System Admin' };

        if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Item transaksi tidak boleh kosong' });
        }

        const result = await inventoryService.updateTransaction(id, req.body, user);
        return res.json({ success: true, ...result });

    } catch (error) {
        console.error('[TX_CONTROLLER] Update Error:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Nomor referensi sudah digunakan' });
        }

        return res.status(500).json({
            success: false,
            message: error.message || 'Gagal memperbarui transaksi'
        });
    }
};

/**
 * DELETE TRANSACTION
 */
exports.deleteTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        await inventoryService.deleteTransaction(id);
        return res.json({ success: true, message: 'Transaksi berhasil dihapus' });
    } catch (error) {
        console.error('[TX_CONTROLLER] Delete Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal menghapus transaksi' });
    }
};

/**
 * GET TRANSACTIONS
 */
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
                `SELECT ti.*, i.name, i.code 
                 FROM transaction_items ti
                 JOIN items i ON ti.item_id = i.id
                 WHERE ti.transaction_id = ?`,
                [tx.id]
            );

            tx.items = items.map(it => ({
                itemId: it.item_id,
                qty: Number(it.qty),
                unit: it.unit,
                ratio: Number(it.conversion_ratio),
                note: it.note,
                name: it.name,
                code: it.code
            }));

            // Normalize for frontend
            tx.sourceWarehouseId = tx.source_warehouse_id;
            tx.referenceNo = tx.reference_no;
            tx.partnerName = tx.partner_name;
            tx.partnerId = tx.partner_id;
        }

        return res.json(txs);
    } catch (error) {
        console.error('[TX_CONTROLLER] Get Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data transaksi' });
    }
};
