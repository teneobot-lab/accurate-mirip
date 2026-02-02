
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * REVERT STOCK EFFECT (Standalone helper with Logging)
 * Digunakan untuk mengembalikan dampak stok sebelum dihapus atau diupdate.
 */
const revertStockEffect = async (conn, transactionId) => {
    console.log(`[STEP 2.1] Reverting stock for TX: ${transactionId}`);
    
    // Lock Header Transaksi lama
    const [txs] = await conn.query('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transactionId]);
    if (txs.length === 0) return;
    const tx = txs[0];

    // Lock & Get Items lama
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ? FOR UPDATE', [transactionId]);

    for (const item of items) {
        const baseQty = Number(item.base_qty);
        console.log(`[STEP 2.2] Reverting Item: ${item.item_id}, Qty: ${baseQty}`);

        if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
            await conn.query(
                `UPDATE stock SET qty = qty - ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, tx.source_warehouse_id, item.item_id]
            );
        } else if (tx.type === 'OUT') {
            await conn.query(
                `UPDATE stock SET qty = qty + ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, tx.source_warehouse_id, item.item_id]
            );
        } else if (tx.type === 'TRANSFER') {
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
 * CORE LOGIC: PROCESS INBOUND (Internal Transactional)
 */
const processInboundInternal = async (data, user, conn) => {
    const trxId = data.id;
    const partnerId = data.partnerId || null;

    console.log(`[STEP 4.1] Upserting Header TX: ${trxId}`);
    await conn.query(
        `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
         VALUES (?, ?, 'IN', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            reference_no=VALUES(reference_no), type=VALUES(type), date=VALUES(date), 
            source_warehouse_id=VALUES(source_warehouse_id), partner_id=VALUES(partner_id), 
            delivery_order_no=VALUES(delivery_order_no), notes=VALUES(notes)`,
        [trxId, data.referenceNo, data.date, data.sourceWarehouseId, partnerId, data.deliveryOrderNo, data.notes, user.id]
    );

    for (const item of data.items) {
        const ratio = Number(item.conversionRatio || 1);
        const baseQty = Number(item.qty) * ratio;

        console.log(`[STEP 4.2] Applying New Stock IN: Item ${item.itemId}, Qty ${baseQty}`);
        // Lock stock record before update to prevent race condition
        await conn.query(`INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE qty = qty`, [data.sourceWarehouseId, item.itemId]);
        await conn.query(`SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`, [data.sourceWarehouseId, item.itemId]);
        
        await conn.query(
            `UPDATE stock SET qty = qty + ? WHERE warehouse_id = ? AND item_id = ?`,
            [baseQty, data.sourceWarehouseId, item.itemId]
        );

        await conn.query(
            `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [trxId, item.itemId, item.qty, item.unit, ratio, baseQty, item.note]
        );
    }
};

/**
 * CORE LOGIC: PROCESS OUTBOUND (Internal Transactional)
 */
const processOutboundInternal = async (data, user, conn) => {
    const trxId = data.id;
    const partnerId = data.partnerId || null;

    console.log(`[STEP 4.1] Upserting Header TX: ${trxId}`);
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

        console.log(`[STEP 4.2] Applying New Stock OUT: Item ${item.itemId}, Qty ${baseQty}`);
        const [rows] = await conn.query(
            `SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`,
            [data.sourceWarehouseId, item.itemId]
        );

        const currentStock = rows.length > 0 ? Number(rows[0].qty) : 0;
        if (currentStock < baseQty) {
            throw new Error(`Stok tidak cukup untuk item ${item.itemId}. Sisa: ${currentStock}, Butuh: ${baseQty}`);
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
};

// --- EXPORTED SERVICE WRAPPERS ---

exports.updateTransaction = async (id, data, user) => {
    console.log(`[START] UPDATE TRANSACTION ID: ${id}`);
    const conn = await db.getConnection();
    
    try {
        // STEP 0: Set Lock Timeout untuk mencegah query menggantung selamanya
        await conn.query('SET innodb_lock_wait_timeout = 15');
        
        // STEP 1: BEGIN
        await conn.beginTransaction();
        console.log(`[STEP 1] Transaction Started`);

        // STEP 2: REVERT OLD IMPACT (With Locking)
        await revertStockEffect(conn, id);

        // STEP 3: CLEAR OLD ITEMS
        console.log(`[STEP 3] Deleting Old Transaction Items`);
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);

        // STEP 4: APPLY NEW DATA
        if (data.type === 'IN') {
            await processInboundInternal({ ...data, id }, user, conn);
        } else if (data.type === 'OUT') {
            await processOutboundInternal({ ...data, id }, user, conn);
        } else {
            throw new Error(`Tipe transaksi ${data.type} tidak valid untuk update.`);
        }

        // STEP 5: COMMIT
        await conn.commit();
        console.log(`[STEP 5] Transaction Committed Successfully`);
        
        return { success: true, id };

    } catch (error) {
        console.error(`[CRITICAL ERROR] Update TX Failed: ${error.message}`);
        if (conn) {
            console.log(`[ROLLBACK] Rolling back changes...`);
            await conn.rollback();
        }
        throw error; // Rethrow agar controller bisa mengirim res.status(500)
    } finally {
        if (conn) {
            console.log(`[RELEASE] Connection released to pool`);
            conn.release();
        }
    }
};

exports.processInboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 15');
        await conn.beginTransaction();
        const trxId = data.id || uuidv4();
        await processInboundInternal({ ...data, id: trxId }, user, conn);
        await conn.commit();
        return { success: true, id: trxId };
    } catch (e) {
        if (conn) await conn.rollback();
        throw e;
    } finally {
        if (conn) conn.release();
    }
};

exports.processOutboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 15');
        await conn.beginTransaction();
        const trxId = data.id || uuidv4();
        await processOutboundInternal({ ...data, id: trxId }, user, conn);
        await conn.commit();
        return { success: true, id: trxId };
    } catch (e) {
        if (conn) await conn.rollback();
        throw e;
    } finally {
        if (conn) conn.release();
    }
};

exports.deleteTransaction = async (transactionId) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 15');
        await conn.beginTransaction();
        await revertStockEffect(conn, transactionId);
        await conn.query('DELETE FROM transactions WHERE id = ?', [transactionId]);
        await conn.commit();
        return { success: true };
    } catch (error) {
        if (conn) await conn.rollback();
        throw error;
    } finally {
        if (conn) conn.release();
    }
};
