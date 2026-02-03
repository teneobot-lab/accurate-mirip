
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * UTILS: Update Stock Function
 * Helper atomic untuk update stok.
 * op: '+' or '-'
 */
const updateStockAtomically = async (conn, warehouseId, itemId, qty, op) => {
    // 1. Ensure Stock Record Exists (Upsert with Lock-safe approach)
    await conn.query(
        `INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) 
         ON DUPLICATE KEY UPDATE qty = qty`, 
        [warehouseId, itemId]
    );

    // 2. Lock Row for Update
    const [[currentStock]] = await conn.query(
        `SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`,
        [warehouseId, itemId]
    );

    const currentQty = Number(currentStock.qty);
    const changeQty = Number(qty);

    // 3. Logic Validation
    if (op === '-' && currentQty < changeQty) {
        const error = new Error(`Stok tidak cukup untuk Item ID: ${itemId}. Sisa: ${currentQty}, Diminta: ${changeQty}`);
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
 * Mengembalikan stok berdasarkan data transaksi LAMA (snapshot).
 */
const revertTransactionEffects = async (conn, transactionId) => {
    // Get Header
    const [[tx]] = await conn.query('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transactionId]);
    if (!tx) return null; // Transaction not found

    // Get Items
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [transactionId]);

    for (const item of items) {
        const baseQty = Number(item.base_qty);
        // Jika dulu IN, sekarang dikurangi (-). Jika dulu OUT, sekarang ditambah (+).
        // IN -> Revert dengan (-)
        // OUT -> Revert dengan (+)
        const op = (tx.type === 'IN' || tx.type === 'ADJUSTMENT') ? '-' : '+';
        
        // PENTING: Revert dilakukan ke warehouse LAMA (tx.source_warehouse_id)
        // Kita tidak perlu cek stok minus saat revert IN (karena kita mengambil kembali barang yg pernah masuk)
        // Kita tidak perlu cek stok minus saat revert OUT (karena kita mengembalikan barang, stok bertambah)
        
        // Namun, jika revert IN (mengurangi stok), pastikan stok masih ada (edge case jarang, tapi mungkin jika stok sudah terpakai transaksi lain)
        // Untuk safety, kita gunakan updateStockAtomically
        
        await updateStockAtomically(conn, tx.source_warehouse_id, item.item_id, baseQty, op);
    }
    
    return tx;
};

/**
 * APPLY LOGIC
 * Menerapkan stok berdasarkan data transaksi BARU.
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

        // IN -> Apply (+)
        // OUT -> Apply (-)
        const op = (type === 'IN' || type === 'ADJUSTMENT') ? '+' : '-';
        
        await updateStockAtomically(conn, sourceWarehouseId, itemId, baseQty, op);

        // Insert Item Line
        await conn.query(
            `INSERT INTO transaction_items 
            (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transactionId, itemId, qty, unit, ratio, baseQty, note]
        );
    }
};

/**
 * CREATE TRANSACTION (IN/OUT)
 */
const createTransaction = async (data, user, type) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10'); // Fail fast on deadlocks
        await conn.beginTransaction();

        const trxId = data.id || uuidv4();
        const partnerId = (data.partnerId && data.partnerId.trim() !== "") ? data.partnerId : null;
        const doNo = data.deliveryOrderNo || null;
        const notes = data.notes || null;

        // 1. Insert Header
        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [trxId, data.referenceNo, type, data.date, data.sourceWarehouseId, partnerId, doNo, notes, user.id]
        );

        // 2. Apply Stock & Items
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
 * UPDATE TRANSACTION (FULL REWRITE STRATEGY)
 */
exports.updateTransaction = async (id, data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 15');
        await conn.beginTransaction();

        // 1. REVERT OLD EFFECTS
        // Ini akan mengembalikan stok ke gudang LAMA berdasarkan item LAMA.
        const oldTx = await revertTransactionEffects(conn, id);
        
        if (!oldTx) {
            throw new Error(`Transaksi ID ${id} tidak ditemukan.`);
        }

        // 2. DELETE OLD ITEMS
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);

        // 3. UPDATE HEADER
        // Update data baru (Warehouse mungkin berubah, Partner mungkin berubah)
        const partnerId = (data.partnerId && data.partnerId.trim() !== "") ? data.partnerId : null;
        const doNo = data.deliveryOrderNo || null;
        const notes = data.notes || null;

        await conn.query(
            `UPDATE transactions 
             SET reference_no = ?, date = ?, source_warehouse_id = ?, partner_id = ?, 
                 delivery_order_no = ?, notes = ?
             WHERE id = ?`,
            [
                data.referenceNo, 
                data.date, 
                data.sourceWarehouseId, 
                partnerId, 
                doNo, 
                notes, 
                id
            ]
        );

        // 4. APPLY NEW EFFECTS
        // Terapkan stok ke gudang BARU berdasarkan item BARU.
        // Type transaksi (IN/OUT) diasumsikan tidak berubah via UI Edit, gunakan oldTx.type.
        // Jika UI mendukung ubah tipe, gunakan data.type.
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

        // 1. Revert Old Effects (Restore Stock)
        const oldTx = await revertTransactionEffects(conn, id);
        if (!oldTx) throw new Error("Transaksi tidak ditemukan");

        // 2. Delete Header (Cascade delete items due to FK constraint, but explicit delete is safer)
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
