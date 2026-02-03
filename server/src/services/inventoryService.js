
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

    // 2. Lock Row for Update
    const [rows] = await conn.query(
        `SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`,
        [warehouseId, itemId]
    );
    
    if (rows.length === 0) throw new Error("Gagal mengunci baris stok.");
    const currentStock = rows[0];

    const currentQty = Number(currentStock.qty);
    const changeQty = Number(qty);

    // 3. Logic Validation (Jangan biarkan stok minus saat transaksi OUT atau REVERT IN)
    if (op === '-' && currentQty < changeQty) {
        const error = new Error(`Stok tidak cukup untuk Item ID: ${itemId}. Sisa: ${currentQty}, Dibutuhkan pengurangan: ${changeQty}`);
        error.code = 'INSUFFICIENT_STOCK';
        throw error;
    }

    // 4. Update
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
    // FIX: Gunakan cara akses array yang aman untuk menghindari TypeError
    const [txRows] = await conn.query('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transactionId]);
    if (txRows.length === 0) return null;
    const tx = txRows[0];

    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [transactionId]);

    for (const item of items) {
        const baseQty = Number(item.base_qty);
        // IN -> Revert dengan (-)
        // OUT -> Revert dengan (+)
        const op = (tx.type === 'IN' || tx.type === 'ADJUSTMENT') ? '-' : '+';
        await updateStockAtomically(conn, tx.source_warehouse_id, item.item_id, baseQty, op);
    }
    
    return tx;
};

/**
 * APPLY LOGIC
 */
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

/**
 * CREATE TRANSACTION
 */
const createTransaction = async (data, user, type) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();

        const trxId = data.id || uuidv4();
        const partnerId = (data.partnerId && data.partnerId.trim() !== "") ? data.partnerId : null;
        const doNo = data.deliveryOrderNo || null;
        const notes = data.notes || null;

        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [trxId, data.referenceNo, type, data.date, data.sourceWarehouseId, partnerId, doNo, notes, user.id]
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

exports.processInboundTransaction = (data, user) => createTransaction(data, user, 'IN');
exports.processOutboundTransaction = (data, user) => createTransaction(data, user, 'OUT');

/**
 * UPDATE TRANSACTION
 */
exports.updateTransaction = async (id, data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 15');
        await conn.beginTransaction();

        const oldTx = await revertTransactionEffects(conn, id);
        if (!oldTx) throw new Error(`Transaksi ID ${id} tidak ditemukan.`);

        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);

        const partnerId = (data.partnerId && data.partnerId.trim() !== "") ? data.partnerId : null;
        const doNo = data.deliveryOrderNo || null;
        const notes = data.notes || null;

        await conn.query(
            `UPDATE transactions 
             SET reference_no = ?, date = ?, source_warehouse_id = ?, partner_id = ?, 
                 delivery_order_no = ?, notes = ?
             WHERE id = ?`,
            [data.referenceNo, data.date, data.sourceWarehouseId, partnerId, doNo, notes, id]
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

/**
 * DELETE TRANSACTION
 */
exports.deleteTransaction = async (id) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();

        const oldTx = await revertTransactionEffects(conn, id);
        if (!oldTx) {
            console.warn(`[INVENTORY_SERVICE] Delete failed: Transaction ${id} not found.`);
            throw new Error("Transaksi tidak ditemukan");
        }

        // Delete items first (though cascade is on, manual is safer for auditing during transaction)
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);
        await conn.query('DELETE FROM transactions WHERE id = ?', [id]);

        await conn.commit();
        return { success: true };
    } catch (error) {
        if (conn) await conn.rollback();
        throw error;
    } finally {
        if (conn) conn.release();
    }
};
