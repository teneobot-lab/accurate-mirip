
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Executes a Stock OUT transaction with PESSIMISTIC LOCKING.
 * Guarantees atomic updates and prevents negative stock race conditions.
 */
exports.processOutboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        const trxId = uuidv4();

        // 1. Insert Header
        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?, ?)`,
            [trxId, data.referenceNo, data.date, data.sourceWarehouseId, data.partnerId, data.deliveryOrderNo, data.notes, user.id]
        );

        // 2. Process Items (SEQUENTIAL for locking consistency)
        // Sort by ID to prevent Deadlocks
        const sortedItems = data.items.sort((a, b) => a.itemId.localeCompare(b.itemId));

        for (const item of sortedItems) {
            const baseQty = Number(item.qty) * Number(item.conversionRatio);

            // --- CRITICAL SECTION: LOCKING ---
            // 'FOR UPDATE' locks the row. Other transactions must wait.
            const [rows] = await conn.query(
                `SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`,
                [data.sourceWarehouseId, item.itemId]
            );

            const currentStock = rows.length > 0 ? Number(rows[0].qty) : 0;

            // 3. Validation: Prevent Negative Stock
            if (currentStock < baseQty) {
                const error = new Error(`Insufficient stock for Item ID: ${item.itemId}. Available: ${currentStock}, Requested: ${baseQty}`);
                error.status = 409; // Conflict
                throw error;
            }

            // 4. Update Stock
            await conn.query(
                `UPDATE stock SET qty = qty - ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, data.sourceWarehouseId, item.itemId]
            );

            // 5. Insert Transaction Line
            await conn.query(
                `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [trxId, item.itemId, item.qty, item.unit, item.conversionRatio, baseQty, item.note]
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
 * Locking is less critical here (adding stock), but good for consistency.
 */
exports.processInboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        const trxId = uuidv4();

        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, 'IN', ?, ?, ?, ?, ?, ?)`,
            [trxId, data.referenceNo, data.date, data.sourceWarehouseId, data.partnerId, data.deliveryOrderNo, data.notes, user.id]
        );

        for (const item of data.items) {
            const baseQty = Number(item.qty) * Number(item.conversionRatio);

            // UPSERT Logic (Insert if new, Update if exists)
            await conn.query(
                `INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)`,
                [data.sourceWarehouseId, item.itemId, baseQty]
            );

            await conn.query(
                `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [trxId, item.itemId, item.qty, item.unit, item.conversionRatio, baseQty, item.note]
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
