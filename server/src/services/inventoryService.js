
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * REVERT STOCK IMPACT
 * Menghapus efek stok dari transaksi tertentu sebelum diupdate atau dihapus.
 */
const revertStockEffect = async (conn, transactionId) => {
    // Ambil header untuk tahu gudang dan tipe
    const [txs] = await conn.query('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transactionId]);
    if (txs.length === 0) return null;
    const tx = txs[0];

    // Ambil semua item lama
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [transactionId]);
    
    for (const item of items) {
        const baseQty = Number(item.base_qty) || 0;
        const whId = tx.source_warehouse_id;
        const itId = item.item_id;

        // Lock stok row
        await conn.query('SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE', [whId, itId]);

        // Jika dulu IN, sekarang dikurangi. Jika dulu OUT, sekarang ditambah.
        const op = (tx.type === 'IN' || tx.type === 'ADJUSTMENT') ? '-' : '+';
        await conn.query(`UPDATE stock SET qty = qty ${op} ? WHERE warehouse_id = ? AND item_id = ?`, [baseQty, whId, itId]);
    }
    return tx;
};

/**
 * APPLY LOGIC
 * Menghitung dan menerapkan perubahan stok serta menyimpan item transaksi.
 */
const applyTransactionLogic = async (conn, transactionId, data) => {
    const type = data.type;
    const whId = data.sourceWarehouseId;

    if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Data items tidak valid');
    }

    for (const item of data.items) {
        const itemId = item.item_id || item.itemId;
        if (!itemId) continue;

        const qty = Number(item.qty) || 0;
        const ratio = Number(item.conversionRatio || item.ratio || 1);
        const baseQty = qty * ratio;

        // Pastikan record stok ada
        await conn.query(`INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE qty = qty`, [whId, itemId]);
        
        // Lock row stok untuk konsistensi
        const [[stok]] = await conn.query(`SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`, [whId, itemId]);

        // Validasi stok jika keluar
        if (type === 'OUT' && (!stok || Number(stok.qty) < baseQty)) {
            const err = new Error(`Stok tidak mencukupi untuk item ID: ${itemId}`);
            err.code = 'INSUFFICIENT_STOCK';
            throw err;
        }

        // Terapkan perubahan stok
        const op = type === 'IN' ? '+' : '-';
        await conn.query(`UPDATE stock SET qty = qty ${op} ? WHERE warehouse_id = ? AND item_id = ?`, [baseQty, whId, itemId]);

        // Simpan baris item transaksi
        await conn.query(
            `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                transactionId, 
                itemId, 
                qty, 
                item.unit || 'Pcs', 
                ratio, 
                baseQty, 
                item.note || null
            ]
        );
    }
};

/**
 * CREATE INBOUND
 */
exports.processInboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();
        
        const trxId = data.id || uuidv4();
        
        // Normalisasi data opsional (Empty string to null)
        const partnerId = (data.partnerId && data.partnerId.trim() !== "") ? data.partnerId : null;
        const doNo = (data.deliveryOrderNo && data.deliveryOrderNo.trim() !== "") ? data.deliveryOrderNo : null;
        const notes = (data.notes && data.notes.trim() !== "") ? data.notes : null;

        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                trxId, 
                data.referenceNo, 
                'IN', 
                data.date, 
                data.sourceWarehouseId, 
                partnerId, 
                doNo, 
                notes, 
                user.id
            ]
        );

        await applyTransactionLogic(conn, trxId, { ...data, type: 'IN' });
        
        await conn.commit();
        return { success: true, id: trxId };
    } catch (e) {
        if (conn) await conn.rollback();
        throw e;
    } finally {
        if (conn) conn.release();
    }
};

/**
 * CREATE OUTBOUND
 */
exports.processOutboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();
        
        const trxId = data.id || uuidv4();
        
        const partnerId = (data.partnerId && data.partnerId.trim() !== "") ? data.partnerId : null;
        const doNo = (data.deliveryOrderNo && data.deliveryOrderNo.trim() !== "") ? data.deliveryOrderNo : null;
        const notes = (data.notes && data.notes.trim() !== "") ? data.notes : null;

        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                trxId, 
                data.referenceNo, 
                'OUT', 
                data.date, 
                data.sourceWarehouseId, 
                partnerId, 
                doNo, 
                notes, 
                user.id
            ]
        );

        await applyTransactionLogic(conn, trxId, { ...data, type: 'OUT' });
        
        await conn.commit();
        return { success: true, id: trxId };
    } catch (e) {
        if (conn) await conn.rollback();
        throw e;
    } finally {
        if (conn) conn.release();
    }
};

/**
 * UPDATE TRANSACTION
 */
exports.updateTransaction = async (id, data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();

        // 1. Revert stok lama
        const oldTrx = await revertStockEffect(conn, id);
        if (!oldTrx) {
            throw new Error('Transaksi tidak ditemukan');
        }

        // 2. Hapus item lama
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);

        // 3. Update Header
        const partnerId = (data.partnerId && data.partnerId.trim() !== "") ? data.partnerId : null;
        const doNo = (data.deliveryOrderNo && data.deliveryOrderNo.trim() !== "") ? data.deliveryOrderNo : null;
        const notes = (data.notes && data.notes.trim() !== "") ? data.notes : null;

        await conn.query(
            `UPDATE transactions 
             SET reference_no = ?, date = ?, source_warehouse_id = ?, partner_id = ?, 
                 delivery_order_no = ?, notes = ?
             WHERE id = ?`,
            [
                data.referenceNo || oldTrx.reference_no, 
                data.date || oldTrx.date, 
                data.sourceWarehouseId || oldTrx.source_warehouse_id, 
                partnerId, 
                doNo, 
                notes, 
                id
            ]
        );

        // 4. Terapkan logika baru
        await applyTransactionLogic(conn, id, { ...data, type: oldTrx.type });

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
