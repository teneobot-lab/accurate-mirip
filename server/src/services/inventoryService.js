
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Reverts the effect of a transaction on the stock.
 */
const revertStockEffect = async (conn, transactionId) => {
    // 1. Get transaction details
    const [transactions] = await conn.query('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    if (transactions.length === 0) return;
    const tx = transactions[0];

    // 2. Get transaction items
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [transactionId]);

    // 3. Revert each item
    for (const item of items) {
        const baseQty = Number(item.base_qty);
        if (tx.type === 'IN') {
            // Revert IN: Subtract stock
            await conn.query(
                `UPDATE stock SET qty = qty - ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, tx.source_warehouse_id, item.item_id]
            );
        } else if (tx.type === 'OUT') {
            // Revert OUT: Add back stock
            await conn.query(
                `UPDATE stock SET qty = qty + ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, tx.source_warehouse_id, item.item_id]
            );
        }
    }
};

exports.deleteTransaction = async (transactionId) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        await revertStockEffect(conn, transactionId);
        await conn.query('DELETE FROM transactions WHERE id = ?', [transactionId]);
        await conn.commit();
        return { success: true };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Update transaction: Revert old -> Apply new
 */
exports.updateTransaction = async (id, data, user) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        // 1. Revert old stock
        await revertStockEffect(conn, id);
        
        // 2. Delete old records
        await conn.query('DELETE FROM transactions WHERE id = ?', [id]);

        // 3. Apply as new transaction with same ID
        let result;
        if (data.type === 'IN') {
            result = await this.processInboundTransaction({ ...data, id }, user, conn);
        } else {
            result = await this.processOutboundTransaction({ ...data, id }, user, conn);
        }

        await conn.commit();
        return result;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Updated Stock OUT transaction.
 */
exports.processOutboundTransaction = async (data, user, existingConn = null) => {
    const conn = existingConn || await db.getConnection();
    if (!existingConn) await conn.beginTransaction();

    try {
        const trxId = data.id || uuidv4();
        const partnerId = data.partnerId || null;

        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?, ?)`,
            [trxId, data.referenceNo, data.date, data.sourceWarehouseId, partnerId, data.deliveryOrderNo, data.notes, user.id]
        );

        for (const item of data.items) {
            const ratio = Number(item.conversionRatio || 1);
            const baseQty = Number(item.qty) * ratio;

            // LOCKING for consistency
            const [rows] = await conn.query(
                `SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`,
                [data.sourceWarehouseId, item.itemId]
            );

            const currentStock = rows.length > 0 ? Number(rows[0].qty) : 0;
            if (currentStock < baseQty) {
                throw new Error(`Stok tidak cukup untuk ${item.itemId}. Sisa: ${currentStock}`);
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

        if (!existingConn) await conn.commit();
        return { success: true, id: trxId };
    } catch (error) {
        if (!existingConn) await conn.rollback();
        throw error;
    } finally {
        if (!existingConn) conn.release();
    }
};

/**
 * Updated Stock IN transaction.
 */
exports.processInboundTransaction = async (data, user, existingConn = null) => {
    const conn = existingConn || await db.getConnection();
    if (!existingConn) await conn.beginTransaction();

    try {
        const trxId = data.id || uuidv4();
        const partnerId = data.partnerId || null;

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

        if (!existingConn) await conn.commit();
        return { success: true, id: trxId };
    } catch (error) {
        if (!existingConn) await conn.rollback();
        throw error;
    } finally {
        if (!existingConn) conn.release();
    }
};
