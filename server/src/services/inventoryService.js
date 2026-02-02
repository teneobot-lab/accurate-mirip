
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
        const baseQty = Number(item.base_qty);
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
 * UPDATE TRANSACTION (FULL RESET & RE-APPLY)
 */
exports.updateTransaction = async (id, data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();

        // 1. REVERT & LOCK HEADER
        const oldTrx = await revertStockEffect(conn, id);
        if (!oldTrx) {
            await conn.rollback();
            const err = new Error('Transaksi tidak ditemukan');
            err.status = 404;
            throw err;
        }

        // 2. DELETE OLD ITEMS
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);

        // 3. UPDATE HEADER DENGAN FALLBACK
        const finalReferenceNo = data.referenceNo ?? data.reference_no ?? oldTrx.reference_no;
        const finalDate = data.date ?? oldTrx.date;
        const finalWhId = data.sourceWarehouseId ?? oldTrx.source_warehouse_id;
        const finalPartnerId = data.partnerId ?? oldTrx.partner_id;

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
                data.deliveryOrderNo ?? oldTrx.delivery_order_no, 
                data.notes ?? oldTrx.notes, 
                id
            ]
        );

        // 4. INSERT NEW ITEMS & APPLY STOCK
        for (const item of data.items) {
            // Normalisasi key (mendukung item_id atau itemId)
            const itemId = item.item_id || item.itemId;
            const qty = Number(item.qty);
            const ratio = Number(item.conversionRatio || item.ratio || 1);
            const baseQty = qty * ratio;

            // Pastikan baris stok ada
            await conn.query(`INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE qty = qty`, [finalWhId, itemId]);
            
            // Cek Stok Baru (Hanya jika OUT)
            const [[stok]] = await conn.query('SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE', [finalWhId, itemId]);
            
            if (oldTrx.type === 'OUT' && (!stok || Number(stok.qty) < baseQty)) {
                await conn.rollback();
                const err = new Error(`Stok tidak mencukupi untuk item ID: ${itemId}`);
                err.code = 'INSUFFICIENT_STOCK';
                throw err;
            }

            // Simpan baris baru
            await conn.query(
                `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, itemId, qty, item.unit || 'Pcs', ratio, baseQty, item.note || '']
            );

            // Terapkan stok
            const op = (oldTrx.type === 'IN' || oldTrx.type === 'ADJUSTMENT') ? '+' : '-';
            await conn.query(`UPDATE stock SET qty = qty ${op} ? WHERE warehouse_id = ? AND item_id = ?`, [baseQty, finalWhId, itemId]);
        }

        await conn.commit();
        return { success: true, message: 'Transaksi berhasil diperbarui sepenuhnya' };

    } catch (error) {
        if (conn) await conn.rollback();
        console.error('SERVICE UPDATE ERROR:', error.message);
        throw error;
    } finally {
        if (conn) conn.release();
    }
};

/**
 * LOGIC LAIN (CREATE & DELETE)
 */
const applyTransactionLogic = async (conn, transactionId, data) => {
    const type = data.type;
    const whId = data.sourceWarehouseId;

    for (const item of data.items) {
        const itemId = item.itemId || item.item_id;
        const ratio = Number(item.conversionRatio || item.ratio || 1);
        const baseQty = Number(item.qty) * ratio;

        await conn.query(`INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE qty = qty`, [whId, itemId]);
        const [[stok]] = await conn.query(`SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`, [whId, itemId]);

        if (type === 'OUT' && (!stok || Number(stok.qty) < baseQty)) {
            const err = new Error(`Stok tidak mencukupi untuk item ${itemId}`);
            err.code = 'INSUFFICIENT_STOCK';
            throw err;
        }

        const op = type === 'IN' ? '+' : '-';
        await conn.query(`UPDATE stock SET qty = qty ${op} ? WHERE warehouse_id = ? AND item_id = ?`, [baseQty, whId, itemId]);

        await conn.query(
            `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transactionId, itemId, item.qty, item.unit, ratio, baseQty, item.note]
        );
    }
};

exports.processInboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();
        const trxId = data.id || uuidv4();
        
        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, 'IN', ?, ?, ?, ?, ?, ?)`,
            [trxId, data.referenceNo, data.date, data.sourceWarehouseId, data.partnerId, data.deliveryOrderNo, data.notes, user.id]
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

exports.processOutboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();
        const trxId = data.id || uuidv4();
        
        await conn.query(
            `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
             VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?, ?)`,
            [trxId, data.referenceNo, data.date, data.sourceWarehouseId, data.partnerId, data.deliveryOrderNo, data.notes, user.id]
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
