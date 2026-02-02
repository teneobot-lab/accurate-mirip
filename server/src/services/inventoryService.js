
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * REVERT STOCK EFFECT (Anti-Deadlock Logic)
 * Mengembalikan stok lama ke kondisi semula menggunakan koneksi yang sama dalam transaksi.
 */
const revertStockEffect = async (conn, transactionId) => {
    console.log(`[STEP 2] Reverting stock for TX: ${transactionId}`);
    
    // Lock header transaksi lama agar tidak disentuh proses lain
    const [txs] = await conn.query('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transactionId]);
    if (txs.length === 0) return;
    const tx = txs[0];

    // Lock baris item transaksi lama
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ? FOR UPDATE', [transactionId]);

    for (const item of items) {
        const baseQty = Number(item.base_qty);
        const whId = tx.source_warehouse_id;
        const itId = item.item_id;

        // Pastikan row stok dikunci (FOR UPDATE)
        await conn.query(`SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`, [whId, itId]);

        if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
            await conn.query(`UPDATE stock SET qty = qty - ? WHERE warehouse_id = ? AND item_id = ?`, [baseQty, whId, itId]);
        } else if (tx.type === 'OUT') {
            await conn.query(`UPDATE stock SET qty = qty + ? WHERE warehouse_id = ? AND item_id = ?`, [baseQty, whId, itId]);
        }
    }
};

/**
 * APPLY TRANSACTION INTERNAL
 * Menerapkan data transaksi baru ke dalam stok.
 */
const applyTransactionInternal = async (conn, data, user) => {
    const trxId = data.id;
    const type = data.type;

    console.log(`[STEP 4] Applying New ${type} Logic for TX: ${trxId}`);

    // Update Header
    await conn.query(
        `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            reference_no=VALUES(reference_no), type=VALUES(type), date=VALUES(date), 
            source_warehouse_id=VALUES(source_warehouse_id), partner_id=VALUES(partner_id), 
            delivery_order_no=VALUES(delivery_order_no), notes=VALUES(notes)`,
        [trxId, data.referenceNo, type, data.date, data.sourceWarehouseId, data.partnerId || null, data.deliveryOrderNo, data.notes, user.id]
    );

    for (const item of data.items) {
        const ratio = Number(item.conversionRatio || 1);
        const baseQty = Number(item.qty) * ratio;
        const whId = data.sourceWarehouseId;
        const itId = item.itemId;

        // LOCK STOK BARIS (PENTING!)
        const [rows] = await conn.query(`SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`, [whId, itId]);
        const currentQty = rows.length > 0 ? Number(rows[0].qty) : 0;

        if (type === 'OUT' && currentQty < baseQty) {
            const err = new Error(`Stok tidak cukup untuk item ${itId}. Tersedia: ${currentQty}, Dibutuhkan: ${baseQty}`);
            err.code = 'INSUFFICIENT_STOCK';
            throw err;
        }

        const op = type === 'IN' ? '+' : '-';
        await conn.query(`UPDATE stock SET qty = qty ${op} ? WHERE warehouse_id = ? AND item_id = ?`, [baseQty, whId, itId]);

        await conn.query(
            `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [trxId, itId, item.qty, item.unit, ratio, baseQty, item.note]
        );
    }
};

/**
 * EXPORT: UPDATE TRANSACTION (FIXED 502)
 */
exports.updateTransaction = async (id, data, user) => {
    console.log(`[START] Master Update for Transaction: ${id}`);
    const conn = await db.getConnection();
    
    try {
        // STEP 0: Set Lock Timeout untuk mematikan query menggantung (Mencegah 502)
        await conn.query('SET innodb_lock_wait_timeout = 10');
        
        // STEP 1: BEGIN TRANSACTION
        await conn.beginTransaction();
        console.log(`[STEP 1] DB Transaction Started`);

        // STEP 2: REVERT OLD DATA
        await revertStockEffect(conn, id);

        // STEP 3: CLEANUP OLD ITEMS
        console.log(`[STEP 3] Cleaning up old items`);
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);

        // STEP 4: APPLY NEW DATA
        await applyTransactionInternal(conn, { ...data, id }, user);

        // STEP 5: COMMIT
        await conn.commit();
        console.log(`[STEP 5] Committed Successfully`);
        
        return { success: true, message: 'Transaksi berhasil diupdate' };

    } catch (error) {
        console.error(`[CRITICAL FAIL] ${error.message}`);
        if (conn) {
            console.log(`[ROLLBACK] Rolling back changes...`);
            await conn.rollback();
        }
        throw error;
    } finally {
        if (conn) {
            console.log(`[RELEASE] Releasing connection to pool`);
            conn.release();
        }
    }
};

exports.processInboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();
        const trxId = data.id || uuidv4();
        await applyTransactionInternal(conn, { ...data, id: trxId, type: 'IN' }, user);
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
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();
        const trxId = data.id || uuidv4();
        await applyTransactionInternal(conn, { ...data, id: trxId, type: 'OUT' }, user);
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
        await conn.query('SET innodb_lock_wait_timeout = 10');
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
