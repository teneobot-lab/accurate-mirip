
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * UTILS: Update Stock Atomically
 * @param {boolean} bypassCheck - Jika true, tidak validasi stok minimum (untuk koreksi transaksi IN)
 */
const updateStockAtomically = async (conn, warehouseId, itemId, qty, op, bypassCheck = false) => {
    // 1. Pastikan record stok ada
    await conn.query(
        `INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) 
         ON DUPLICATE KEY UPDATE qty = qty`,
        [warehouseId, itemId]
    );

    // 2. Lock row untuk update
    const [rows] = await conn.query(
        `SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`,
        [warehouseId, itemId]
    );
    if (rows.length === 0) throw new Error("Gagal mengunci baris stok.");

    const currentQty = Number(rows[0].qty);
    const changeQty = Number(qty);

    // 3. Validasi stok - hanya jika bukan bypass (koreksi) dan operasi pengurangan
    if (!bypassCheck && op === '-' && currentQty < changeQty) {
        const error = new Error(
            `Stok tidak cukup untuk Item ID: ${itemId}. Sisa: ${currentQty}, Dibutuhkan: ${changeQty}`
        );
        error.code = 'INSUFFICIENT_STOCK';
        throw error;
    }

    // 4. Update stok
    const sqlOp = op === '+' ? '+' : '-';
    await conn.query(
        `UPDATE stock SET qty = qty ${sqlOp} ? WHERE warehouse_id = ? AND item_id = ?`,
        [changeQty, warehouseId, itemId]
    );
};

/**
 * APPLY TRANSACTION EFFECTS
 * Digunakan oleh CREATE. Untuk UPDATE, stok dikelola terpisah via delta.
 */
const applyTransactionEffects = async (conn, transactionId, data, skipStock = false) => {
    const { type, sourceWarehouseId, items, attachments } = data;

    for (const item of items) {
        const itemId = item.item_id || item.itemId;
        const qty = Number(item.qty);
        const ratio = Number(item.conversionRatio || item.ratio || 1);
        const baseQty = qty * ratio;
        const unit = item.unit || 'Pcs';
        const note = item.note || '';

        if (!skipStock) {
            const op = (type === 'IN' || type === 'ADJUSTMENT') ? '+' : '-';
            await updateStockAtomically(conn, sourceWarehouseId, itemId, baseQty, op);
        }

        await conn.query(
            `INSERT INTO transaction_items 
            (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transactionId, itemId, qty, unit, ratio, baseQty, note]
        );
    }

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        for (const photoBase64 of attachments) {
            if (!photoBase64) continue;
            await conn.query(
                `INSERT INTO transaction_photos (id, transaction_id, photo) VALUES (?, ?, ?)`,
                [uuidv4(), transactionId, photoBase64]
            );
        }
    }
};

/**
 * REVERT TRANSACTION EFFECTS
 * Hanya digunakan oleh DELETE.
 */
const revertTransactionEffects = async (conn, transactionId, isHardDelete = false) => {
    const [txRows] = await conn.query(
        'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
        [transactionId]
    );
    if (txRows.length === 0) return null;
    const tx = txRows[0];

    const [items] = await conn.query(
        'SELECT * FROM transaction_items WHERE transaction_id = ?',
        [transactionId]
    );

    for (const item of items) {
        const baseQty = Number(item.base_qty);
        const op = (tx.type === 'IN' || tx.type === 'ADJUSTMENT') ? '-' : '+';
        await updateStockAtomically(conn, tx.source_warehouse_id, item.item_id, baseQty, op, isHardDelete);
    }

    return tx;
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
        const partnerId = (data.partnerId && data.partnerId.trim() !== '') ? data.partnerId : null;

        await conn.query(
            `INSERT INTO transactions 
            (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [trxId, data.referenceNo, type, data.date, data.sourceWarehouseId,
             partnerId, data.deliveryOrderNo || null, data.notes || null, user.id]
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
 * UPDATE TRANSACTION — Delta-Based
 *
 * Logika:
 * - Hitung selisih (delta) qty lama vs baru per item
 * - Untuk transaksi IN/ADJUSTMENT: koreksi negatif (hapus/kurangi item) di-BYPASS validasi stok
 *   karena ini adalah koreksi catatan, bukan konsumsi stok nyata
 * - Untuk transaksi OUT: penambahan qty tetap divalidasi stok
 */
exports.updateTransaction = async (id, data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 15');
        await conn.beginTransaction();

        // 1. Ambil & lock transaksi lama
        const [txRows] = await conn.query(
            'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
            [id]
        );
        if (txRows.length === 0) throw new Error(`Transaksi ID ${id} tidak ditemukan.`);
        const oldTx = txRows[0];
        const isIN = (oldTx.type === 'IN' || oldTx.type === 'ADJUSTMENT');

        // 2. Buat map qty lama: { itemId → baseQty }
        const [oldItems] = await conn.query(
            'SELECT * FROM transaction_items WHERE transaction_id = ?',
            [id]
        );
        const oldMap = {};
        for (const item of oldItems) {
            oldMap[item.item_id] = {
                baseQty: Number(item.base_qty),
                warehouseId: oldTx.source_warehouse_id
            };
        }

        // 3. Buat map qty baru: { itemId → baseQty }
        const newWarehouseId = data.sourceWarehouseId || oldTx.source_warehouse_id;
        const newMap = {};
        for (const item of data.items) {
            const itemId = item.item_id || item.itemId;
            const qty = Number(item.qty);
            const ratio = Number(item.conversionRatio || item.ratio || 1);
            newMap[itemId] = { baseQty: qty * ratio };
        }

        // 4. Terapkan delta per item
        const allItemIds = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);

        for (const itemId of allItemIds) {
            const oldBaseQty = oldMap[itemId]?.baseQty || 0;
            const newBaseQty = newMap[itemId]?.baseQty || 0;
            const delta = newBaseQty - oldBaseQty;

            if (delta === 0) continue;

            let op, absQty, bypassCheck;

            if (isIN) {
                // Transaksi IN/ADJUSTMENT:
                // delta > 0 → tambah stok (op '+', tidak perlu bypass)
                // delta < 0 → kurangi stok (op '-', BYPASS karena koreksi catatan)
                op = delta > 0 ? '+' : '-';
                absQty = Math.abs(delta);
                bypassCheck = delta < 0; // bypass hanya saat mengurangi
            } else {
                // Transaksi OUT:
                // delta > 0 → ambil lebih banyak dari gudang (op '-', VALIDASI stok)
                // delta < 0 → kembalikan ke gudang (op '+', tidak perlu bypass)
                op = delta > 0 ? '-' : '+';
                absQty = Math.abs(delta);
                bypassCheck = delta < 0; // bypass hanya saat mengembalikan
            }

            // Jika gudang berubah (warehouse pindah), revert di gudang lama, apply di gudang baru
            const oldWarehouseId = oldMap[itemId]?.warehouseId || oldTx.source_warehouse_id;
            const warehouseChanged = oldWarehouseId !== newWarehouseId && oldMap[itemId];

            if (warehouseChanged) {
                // Revert stok di gudang lama (bypass check untuk IN)
                const revertOp = isIN ? '-' : '+';
                await updateStockAtomically(conn, oldWarehouseId, itemId, oldBaseQty, revertOp, isIN);
                // Apply stok di gudang baru
                const applyOp = isIN ? '+' : '-';
                await updateStockAtomically(conn, newWarehouseId, itemId, newBaseQty, applyOp, false);
            } else {
                await updateStockAtomically(conn, newWarehouseId, itemId, absQty, op, bypassCheck);
            }
        }

        // 5. Clear items & photos lama
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);
        await conn.query('DELETE FROM transaction_photos WHERE transaction_id = ?', [id]);

        // 6. Update header transaksi
        const partnerId = (data.partnerId && data.partnerId.trim() !== '') ? data.partnerId : null;
        await conn.query(
            `UPDATE transactions 
             SET reference_no = ?, date = ?, source_warehouse_id = ?, partner_id = ?,
                 delivery_order_no = ?, notes = ?, updated_by = ?
             WHERE id = ?`,
            [data.referenceNo, data.date, newWarehouseId, partnerId,
             data.deliveryOrderNo || null, data.notes || null, user.id, id]
        );

        // 7. Insert ulang items & photos (stok sudah dikelola di atas, skip stock)
        await applyTransactionEffects(conn, id, { ...data, type: oldTx.type }, true);

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
exports.deleteTransaction = async (id, isHardDelete = false) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();

        const oldTx = await revertTransactionEffects(conn, id, isHardDelete);
        if (!oldTx) {
            throw Object.assign(new Error('Transaksi tidak ditemukan'), { code: 'NOT_FOUND' });
        }

        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);
        await conn.query('DELETE FROM transaction_photos WHERE transaction_id = ?', [id]);
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
