
const inventoryService = require('../services/inventoryService');
const db = require('../config/database');

/**
 * CREATE TRANSACTION
 */
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
            return res.status(400).json({
                success: false,
                message: 'Tipe transaksi tidak didukung'
            });
        }

        return res.status(201).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('CREATE TX ERROR:', error);

        return res.status(error.code === 'INSUFFICIENT_STOCK' ? 409 : 500).json({
            success: false,
            message: error.message || 'Gagal membuat transaksi'
        });
    }
};

/**
 * UPDATE TRANSACTION (FIXED & HARDENED)
 * WAJIB format:
 * {
 *   "items": [
 *     { "item_id": 1, "qty": 5 }
 *   ]
 * }
 */
exports.updateTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user || { id: 'admin-uuid', name: 'System Admin' };

        // ===============================
        // 🔒 VALIDASI KERAS (STOP FLOW)
        // ===============================
        if (!req.body || !Array.isArray(req.body.items) || req.body.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'items wajib berupa array dan tidak boleh kosong'
            });
        }

        for (const item of req.body.items) {
            if (
                !item ||
                !item.item_id ||
                typeof item.qty !== 'number' ||
                item.qty <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Setiap item wajib memiliki item_id dan qty > 0'
                });
            }
        }

        // ===============================
        // 🚀 PROSES UPDATE KE SERVICE
        // ===============================
        const result = await inventoryService.updateTransaction(
            id,
            {
                items: req.body.items,
                syncItems: true
            },
            user
        );

        return res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('[CONTROLLER-ERROR] Failed to update TX:', error.message);

        let statusCode = 500;

        if (error.status === 404 || error.message?.includes('tidak ditemukan')) {
            statusCode = 404;
        } else if (
            error.code === 'INSUFFICIENT_STOCK' ||
            error.message?.includes('mencukupi')
        ) {
            statusCode = 409;
        } else if (error.status === 400) {
            statusCode = 400;
        }

        return res.status(statusCode).json({
            success: false,
            message: error.message || 'Gagal update transaksi'
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

        return res.json({
            success: true,
            message: 'Transaksi berhasil dihapus dan stok diperbarui'
        });

    } catch (error) {
        console.error('DELETE TX ERROR:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET TRANSACTIONS (LIST)
 */
exports.getTransactions = async (req, res, next) => {
    try {
        const { start, end, warehouse, type } = req.query;

        let query = `
            SELECT 
                t.*, 
                w.name AS warehouse_name, 
                p.name AS partner_name, 
                t.partner_id
            FROM transactions t
            JOIN warehouses w ON t.source_warehouse_id = w.id
            LEFT JOIN partners p ON t.partner_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (start) {
            query += ' AND t.date >= ?';
            params.push(start);
        }
        if (end) {
            query += ' AND t.date <= ?';
            params.push(end);
        }
        if (warehouse && warehouse !== 'ALL') {
            query += ' AND t.source_warehouse_id = ?';
            params.push(warehouse);
        }
        if (type && type !== 'ALL') {
            query += ' AND t.type = ?';
            params.push(type);
        }

        query += ' ORDER BY t.date DESC, t.created_at DESC';

        const [txs] = await db.query(query, params);

        for (const tx of txs) {
            const [items] = await db.query(
                `
                SELECT 
                    ti.*, 
                    i.name, 
                    i.code 
                FROM transaction_items ti
                JOIN items i ON ti.item_id = i.id
                WHERE ti.transaction_id = ?
                `,
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

            // Normalisasi response untuk frontend
            tx.sourceWarehouseId = tx.source_warehouse_id;
            tx.referenceNo = tx.reference_no;
            tx.partnerName = tx.partner_name;
            tx.partnerId = tx.partner_id;
        }

        return res.json(txs);

    } catch (error) {
        console.error('GET TX ERROR:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
