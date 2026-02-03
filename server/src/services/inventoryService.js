
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * UTILS: Update Stock Function
 */
const updateStockAtomically = async (conn, warehouseId, itemId, qty, op) => {
    // 1. Ensure Stock Record Exists
    await conn.query(
        `INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) 
         ON DUPLICATE KEY UPDATE qty = qty`, 
        [warehouseId, itemId]
    );

    // 2. Lock Row for Update (Set timeout agar tidak hang selamanya)
    const [rows] = await conn.query(
        {
            sql: `SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`,
            timeout: 5000 // 5 detik timeout
        },
        [warehouseId, itemId]
    );
    
    if (rows.length === 0) throw new Error("Gagal mengunci baris stok.");
    const currentStock = rows[0];

    const currentQty = Number(currentStock.qty);
    const changeQty = Number(qty);

    if (op === '-' && currentQty < changeQty) {
        const error = new Error(`Stok tidak cukup untuk Item ID: ${itemId}. Sisa: ${currentQty}, Dibutuhkan pengurangan: ${changeQty}`);
        error.code = 'INSUFFICIENT_STOCK';
        throw error;
    }

    const sqlOp = op === '+' ? '+' : '-';
    await conn.query(
        `UPDATE stock SET qty = qty ${sqlOp} ? WHERE warehouse_id = ? AND item_id = ?`,
        [changeQty, warehouseId, itemId]
    );
};

/**
 * REVERT LOGIC
 */
const revertTransactionEffects = async (conn, transactionId) => {
    console.log(`[REVERT] Fetching transaction ${transactionId}...`);
    const [txRows] = await conn.query(
        {
            sql: 'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
            timeout: 5000
        }, 
        [transactionId]
    );
    
    if (txRows.length === 0) {
        console.log(`[REVERT] Transaction ${transactionId} not found in DB.`);
        return null;
    }
    const tx = txRows[0];

    console.log(`[REVERT] Fetching items for transaction ${transactionId}...`);
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [transactionId]);

    for (const item of items) {
        const baseQty = Number(item.base_qty);
        const op = (tx.type === 'IN' || tx.type === 'ADJUSTMENT') ? '-' : '+';
        console.log(`[REVERT] Adjusting stock for item ${item.item_id}: ${op}${baseQty}`);
        await updateStockAtomically(conn, tx.source_warehouse_id, item.item_id, baseQty, op);
    }
    
    return tx;
};

/**
 * DELETE TRANSACTION
 */
exports.deleteTransaction = async (id) => {
    const conn = await db.getConnection();
    console.log(`[DB] Connection acquired for delete: ${id}`);
    
    try {
        // Force session timeout untuk menghindari hang selamanya di tingkat MySQL
        await conn.query('SET SESSION innodb_lock_wait_timeout = 5');
        await conn.beginTransaction();

        console.log(`[DELETE_PROCESS] Starting revert effects for: ${id}`);
        const oldTx = await revertTransactionEffects(conn, id);
        
        if (!oldTx) {
            console.error(`[DELETE_PROCESS] Transaction ${id} NOT FOUND.`);
            throw new Error("Transaksi tidak ditemukan di database.");
        }

        console.log(`[DELETE_PROCESS] Deleting items from transaction_items...`);
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);
        
        console.log(`[DELETE_PROCESS] Deleting header from transactions...`);
        await conn.query('DELETE FROM transactions WHERE id = ?', [id]);

        console.log(`[DELETE_PROCESS] Committing changes to DB...`);
        await conn.commit();
        console.log(`[DELETE_PROCESS] SUCCESS: ${id}`);
        return { success: true };
    } catch (error) {
        console.error(`[DELETE_PROCESS] ERROR CRITICAL: ${error.message}`);
        if (conn) {
            console.log(`[DELETE_PROCESS] Rolling back...`);
            await conn.rollback();
        }
        throw error;
    } finally {
        if (conn) {
            console.log(`[DB] Releasing connection for: ${id}`);
            conn.release();
        }
    }
};

// ... keep other functions same as before ...
const applyTransactionEffects = async (conn, transactionId, data) => {
    const { type, sourceWarehouseId, items } = data;
    for (const item of items) {
        const itemId = item.item_id || item.itemId;
        const qty = Number(item.qty);
        const ratio = Number(item.conversionRatio || item.ratio || 1);
        const baseQty = qty * ratio;
        const unit = item.unit || 'Pcs';
        const note = item.note || '';
        const op = (type === 'IN' || type === 'ADJUSTMENT') ? '+' : '-';
        await updateStockAtomically(conn, sourceWarehouseId, itemId, baseQty, op);
        await conn.query(
            `INSERT INTO transaction_items 
            (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transactionId, itemId, qty, unit, ratio, baseQty, note]
        );
    }
};

exports.processInboundTransaction = (data, user) => createTransaction(data, user, 'IN');
exports.processOutboundTransaction = (data, user) => createTransaction(data, user, 'OUT');

const createTransaction = async (data, user, type) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET SESSION innodb_lock_wait_timeout = 5');
        await conn.beginTransaction();
        const trxId = data.id || uuidv4();
        const partnerId = (data.partnerId && data.partnerId.trim() !== "") ? data.partnerId : null;
        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [trxId, data.referenceNo, type, data.date, data.sourceWarehouseId, partnerId, data.deliveryOrderNo || null, data.notes || null, user.id]
        );
        await applyTransactionEffects(conn, trxId, { ...data, type });
        await conn.commit();
        return { success: true, id: trxId };
    } catch (e) {
        if (conn) await conn.rollback();
        throw e;
    } finally {
        if (conn) conn.release();
    }
};

exports.updateTransaction = async (id, data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET SESSION innodb_lock_wait_timeout = 5');
        await conn.beginTransaction();
        const oldTx = await revertTransactionEffects(conn, id);
        if (!oldTx) throw new Error(`Transaksi ID ${id} tidak ditemukan.`);
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);
        const partnerId = (data.partnerId && data.partnerId.trim() !== "") ? data.partnerId : null;
        await conn.query(
            `UPDATE transactions 
             SET reference_no = ?, date = ?, source_warehouse_id = ?, partner_id = ?, 
                 delivery_order_no = ?, notes = ?
             WHERE id = ?`,
            [data.referenceNo, data.date, data.sourceWarehouseId, partnerId, data.deliveryOrderNo || null, data.notes || null, id]
        );
        await applyTransactionEffects(conn, id, { ...data, type: oldTx.type });
        await conn.commit();
        return { success: true };
    } catch (error) {
        if (conn) await conn.rollback();
        throw error;
    } finally {
        if (conn) conn.release();
    }
};
