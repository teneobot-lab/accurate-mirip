
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * REVERT STOCK EFFECT
 * Mengembalikan stok ke kondisi sebelum transaksi tersebut ada.
 */
const revertStockEffect = async (conn, transactionId) => {
    // Lock baris item transaksi lama agar tidak berubah saat proses hitung
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ? FOR UPDATE', [transactionId]);
    const [txs] = await conn.query('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transactionId]);
    
    if (txs.length === 0) return;
    const tx = txs[0];

    for (const item of items) {
        const baseQty = Number(item.base_qty);
        const whId = tx.source_warehouse_id;
        const itId = item.item_id;

        // Lock baris stok di tabel stock
        await conn.query(`SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`, [whId, itId]);

        if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
            await conn.query(`UPDATE stock SET qty = qty - ? WHERE warehouse_id = ? AND item_id = ?`, [baseQty, whId, itId]);
        } else if (tx.type === 'OUT') {
            await conn.query(`UPDATE stock SET qty = qty + ? WHERE warehouse_id = ? AND item_id = ?`, [baseQty, whId, itId]);
        }
    }
};

/**
 * APPLY TRANSACTION LOGIC
 * Menghitung dan menerapkan stok baru serta menyimpan detail item.
 */
const applyTransactionLogic = async (conn, transactionId, data, user) => {
    const type = data.type;
    const whId = data.sourceWarehouseId;

    for (const item of data.items) {
        const ratio = Number(item.conversionRatio || 1);
        const baseQty = Number(item.qty) * ratio;
        const itId = item.itemId;

        // 1. Lock baris stok yang akan diupdate
        // Gunakan INSERT ON DUPLICATE untuk memastikan row ada sebelum di-lock
        await conn.query(`INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE qty = qty`, [whId, itId]);
        const [rows] = await conn.query(`SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`, [whId, itId]);
        const currentQty = rows.length > 0 ? Number(rows[0].qty) : 0;

        // 2. Validasi Stok (OUT)
        if (type === 'OUT' && currentQty < baseQty) {
            const err = new Error(`Stok tidak mencukupi untuk item ${itId}`);
            err.code = 'INSUFFICIENT_STOCK';
            throw err;
        }

        // 3. Update Stok
        const op = type === 'IN' ? '+' : '-';
        await conn.query(`UPDATE stock SET qty = qty ${op} ? WHERE warehouse_id = ? AND item_id = ?`, [baseQty, whId, itId]);

        // 4. Simpan Line Item
        await conn.query(
            `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transactionId, itId, item.qty, item.unit, ratio, baseQty, item.note]
        );
    }
};

/**
 * MASTER UPDATE TRANSACTION (IMPLEMENTASI SESUAI PERMINTAAN USER)
 */
exports.updateTransaction = async (id, data, user) => {
    const conn = await db.getConnection();
    
    try {
        // STEP 0: Set Lock Timeout untuk mencegah hanging query (Error 502)
        await conn.query('SET innodb_lock_wait_timeout = 10');
        
        // STEP 1: Mulai Transaksi Database
        await conn.beginTransaction();

        // 1️⃣ Ambil transaksi lama & lock row (Mencegah modifikasi ganda)
        const [oldTrxRows] = await conn.query(
            'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
            [id]
        );

        if (oldTrxRows.length === 0) {
            throw new Error('Transaksi tidak ditemukan');
        }

        const trxLama = oldTrxRows[0];

        // 2️⃣ Rollback stok lama (Revert effect)
        await revertStockEffect(conn, id);

        // 3️⃣ Bersihkan item lama dari transaction_items
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);

        // 4️⃣ Update Header dengan Fallback (Ambil no references dari data lama jika kosong)
        const finalReferenceNo = data.referenceNo ?? trxLama.reference_no;
        const finalDate = data.date ?? trxLama.date;
        const finalWhId = data.sourceWarehouseId ?? trxLama.source_warehouse_id;
        const finalPartnerId = data.partnerId ?? trxLama.partner_id;

        await conn.query(
            `UPDATE transactions 
             SET reference_no = ?, date = ?, source_warehouse_id = ?, partner_id = ?, 
                 delivery_order_no = ?, notes = ?
             WHERE id = ?`,
            [
                finalReferenceNo, 
                finalDate, 
                finalWhId, 
                finalPartnerId, 
                data.deliveryOrderNo ?? trxLama.delivery_order_no, 
                data.notes ?? trxLama.notes, 
                id
            ]
        );

        // 5️⃣ Terapkan stok baru & detail baru (Validasi stok dilakukan di dalam sini)
        await applyTransactionLogic(conn, id, { ...data, sourceWarehouseId: finalWhId }, user);

        // STEP 6: Commit jika semua urutan sukses
        await conn.commit();
        return { success: true, message: 'Transaksi berhasil diupdate' };

    } catch (error) {
        if (conn) await conn.rollback();
        console.error('DATABASE EDIT ERROR:', error.message);
        throw error; // Biarkan controller menangani response status (409/500)
    } finally {
        if (conn) conn.release();
    }
};

exports.processInboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();
        const trxId = data.id || uuidv4();
        await applyTransactionLogic(conn, trxId, { ...data, type: 'IN' }, user);
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
        await applyTransactionLogic(conn, trxId, { ...data, type: 'OUT' }, user);
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
