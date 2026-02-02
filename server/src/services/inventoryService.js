
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Reverts the effect of a transaction on the stock.
 * Supports IN, OUT, TRANSFER, and ADJUSTMENT.
 */
const revertStockEffect = async (conn, transactionId) => {
    const [transactions] = await conn.query('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    if (transactions.length === 0) return;
    const tx = transactions[0];

    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [transactionId]);

    for (const item of items) {
        const baseQty = Number(item.base_qty);
        
        if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
            // Revert IN: Subtract from source
            await conn.query(
                `UPDATE stock SET qty = qty - ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, tx.source_warehouse_id, item.item_id]
            );
        } else if (tx.type === 'OUT') {
            // Revert OUT: Add back to source
            await conn.query(
                `UPDATE stock SET qty = qty + ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, tx.source_warehouse_id, item.item_id]
            );
        } else if (tx.type === 'TRANSFER') {
            // Revert TRANSFER: Add back to source, subtract from target
            await conn.query(
                `UPDATE stock SET qty = qty + ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, tx.source_warehouse_id, item.item_id]
            );
            if (tx.target_warehouse_id) {
                await conn.query(
                    `UPDATE stock SET qty = qty - ? WHERE warehouse_id = ? AND item_id = ?`,
                    [baseQty, tx.target_warehouse_id, item.item_id]
                );
            }
        }
    }
};

/**
 * Core Logic for processing Inbound
 */
const processInbound = async (data, user, conn) => {
    const trxId = data.id || uuidv4();
    const partnerId = data.partnerId || null;

    // Update or Insert Header
    await conn.query(
        `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
         VALUES (?, ?, 'IN', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            reference_no=VALUES(reference_no), type=VALUES(type), date=VALUES(date), 
            source_warehouse_id=VALUES(source_warehouse_id), partner_id=VALUES(partner_id), 
            delivery_order_no=VALUES(delivery_order_no), notes=VALUES(notes)`,
        [trxId, data.referenceNo, data.date, data.sourceWarehouseId, partnerId, data.deliveryOrderNo, data.notes, user.id]
    );

    // Items
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
    return { success: true, id: trxId };
};

/**
 * Core Logic for processing Outbound
 */
const processOutbound = async (data, user, conn) => {
    const trxId = data.id || uuidv4();
    const partnerId = data.partnerId || null;

    await conn.query(
        `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
         VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            reference_no=VALUES(reference_no), type=VALUES(type), date=VALUES(date), 
            source_warehouse_id=VALUES(source_warehouse_id), partner_id=VALUES(partner_id), 
            delivery_order_no=VALUES(delivery_order_no), notes=VALUES(notes)`,
        [trxId, data.referenceNo, data.date, data.sourceWarehouseId, partnerId, data.deliveryOrderNo, data.notes, user.id]
    );

    for (const item of data.items) {
        const ratio = Number(item.conversionRatio || 1);
        const baseQty = Number(item.qty) * ratio;

        const [rows] = await conn.query(
            `SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`,
            [data.sourceWarehouseId, item.itemId]
        );

        const currentStock = rows.length > 0 ? Number(rows[0].qty) : 0;
        // In adjustment/force mode we might allow negative, but for standard OUT we check
        if (currentStock < baseQty) {
            throw new Error(`Stok tidak cukup untuk item ${item.itemId}. Tersedia: ${currentStock}, Dibutuhkan: ${baseQty}`);
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
    return { success: true, id: trxId };
};

// --- EXPORTS ---

exports.processInboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        const res = await processInbound(data, user, conn);
        await conn.commit();
        return res;
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

exports.processOutboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        const res = await processOutbound(data, user, conn);
        await conn.commit();
        return res;
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

exports.updateTransaction = async (id, data, user) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
        // 1. Revert effect of OLD transaction stored in DB
        await revertStockEffect(conn, id);
        
        // 2. Clear OLD transaction items (header is updated via ON DUPLICATE KEY in process functions)
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);

        // 3. Apply NEW logic as if it was a fresh transaction but with same ID
        let result;
        if (data.type === 'IN') {
            result = await processInbound({ ...data, id }, user, conn);
        } else {
            result = await processOutbound({ ...data, id }, user, conn);
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
