
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Executes a Stock OUT transaction with PESSIMISTIC LOCKING.
 */
exports.processOutboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        const trxId = uuidv4();

        // Ensure partnerId is null if empty string to avoid foreign key issues
        const partnerId = data.partnerId && data.partnerId.length > 0 ? data.partnerId : null;

        // 1. Insert Header
        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?, ?)`,
            [trxId, data.referenceNo, data.date, data.sourceWarehouseId, partnerId, data.deliveryOrderNo, data.notes, user.id]
        );

        // 2. Process Items
        const sortedItems = data.items.sort((a, b) => a.itemId.localeCompare(b.itemId));

        for (const item of sortedItems) {
            const ratio = Number(item.conversionRatio || 1);
            const baseQty = Number(item.qty) * ratio;

            // --- LOCKING ---
            const [rows] = await conn.query(
                `SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`,
                [data.sourceWarehouseId, item.itemId]
            );

            const currentStock = rows.length > 0 ? Number(rows[0].qty) : 0;

            if (currentStock < baseQty) {
                const error = new Error(`Stok tidak cukup untuk Item ID: ${item.itemId}. Tersedia: ${currentStock}, Dibutuhkan: ${baseQty}`);
                error.status = 409;
                throw error;
            }

            await conn.query(
                `UPDATE stock SET qty = qty - ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, data.sourceWarehouseId, item.itemId]
            );

            await conn.query(
                `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [trxId, item.itemId, item.qty, item.unit, ratio, baseQty, item.note]
            );
        }

        await conn.commit();
        return { success: true, id: trxId, referenceNo: data.referenceNo };

    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Executes a Stock IN transaction.
 */
exports.processInboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        const trxId = uuidv4();
        const partnerId = data.partnerId && data.partnerId.length > 0 ? data.partnerId : null;

        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, 'IN', ?, ?, ?, ?, ?, ?)`,
            [trxId, data.referenceNo, data.date, data.sourceWarehouseId, partnerId, data.deliveryOrderNo, data.notes, user.id]
        );

        for (const item of data.items) {
            const ratio = Number(item.conversionRatio || 1);
            const baseQty = Number(item.qty) * ratio;

            await conn.query(
                `INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)`,
                [data.sourceWarehouseId, item.itemId, baseQty]
            );

            await conn.query(
                `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [trxId, item.itemId, item.qty, item.unit, ratio, baseQty, item.note]
            );
        }

        await conn.commit();
        return { success: true, id: trxId };

    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};
