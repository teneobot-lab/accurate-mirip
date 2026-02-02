
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * MASTER UPDATE TRANSACTION (IMPLEMENTASI SESUAI SNIPPET USER)
 * Menggunakan pola: Lock Header -> Normalisasi -> Loop Item -> Lock Item -> Revert -> Check Stock -> Update/Apply.
 */
exports.updateTransaction = async (id, data, user) => {
    let conn;
    try {
        conn = await db.getConnection();
        // STEP 0: Set Lock Timeout untuk mencegah hanging query (Error 502)
        await conn.query('SET innodb_lock_wait_timeout = 10');
        
        await conn.beginTransaction();

        // 1️⃣ CEK HEADER TRANSAKSI (UUID) & LOCK
        const [oldTrx] = await conn.query(
            'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
            [id]
        );

        if (oldTrx.length === 0) {
            await conn.rollback();
            const err = new Error('Transaksi tidak ditemukan');
            err.status = 404;
            throw err;
        }

        const trxLama = oldTrx[0];

        // 2️⃣ NORMALISASI INPUT (Mendukung array items atau single item_id/qty)
        let itemsToProcess = [];
        if (Array.isArray(data.items)) {
            itemsToProcess = data.items;
        } else if (data.itemId && data.qty) {
            itemsToProcess = [{
                itemId: data.itemId,
                qty: data.qty,
                unit: data.unit,
                conversionRatio: data.conversionRatio || 1
            }];
        } else {
            await conn.rollback();
            const err = new Error('Format data item tidak valid');
            err.status = 400;
            throw err;
        }

        // 3️⃣ UPDATE HEADER DENGAN FALLBACK (Pola Turn Sebelumnya)
        const finalReferenceNo = data.referenceNo ?? data.reference_no ?? trxLama.reference_no;
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

        // 4️⃣ LOOP ITEM (Pola Snippet User)
        // Note: Untuk fleksibilitas edit masal, kita hapus dulu line lama yang TIDAK ada di request
        // Namun untuk mengikuti pola "UPDATE" yang diminta user:
        for (const item of itemsToProcess) {
            const itemId = item.itemId || item.item_id;
            const qtyBaru = Number(item.qty);
            const ratio = Number(item.conversionRatio || item.ratio || 1);
            const baseQtyBaru = qtyBaru * ratio;

            if (!itemId || isNaN(qtyBaru) || qtyBaru <= 0) {
                await conn.rollback();
                const err = new Error('item_id / qty tidak valid');
                err.status = 400;
                throw err;
            }

            // Ambil item lama (Lock Line Item)
            const [oldItems] = await conn.query(
                `SELECT id, base_qty, qty 
                 FROM transaction_items 
                 WHERE transaction_id = ? AND item_id = ? 
                 FOR UPDATE`,
                [id, itemId]
            );

            // Jika item sudah ada di transaksi, lakukan Revert & Update
            if (oldItems.length > 0) {
                const lineLama = oldItems[0];
                const baseQtyLama = Number(lineLama.base_qty);

                // Rollback stok lama (Sesuai Snippet)
                const opRevert = trxLama.type === 'IN' ? '-' : '+';
                await conn.query(
                    `UPDATE stock SET qty = qty ${opRevert} ? WHERE warehouse_id = ? AND item_id = ?`,
                    [baseQtyLama, finalWhId, itemId]
                );

                // Cek stok cukup (Hanya untuk OUT)
                const [[stokRow]] = await conn.query(
                    'SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE',
                    [finalWhId, itemId]
                );

                if (trxLama.type === 'OUT' && (!stokRow || Number(stokRow.qty) < baseQtyBaru)) {
                    await conn.rollback();
                    const err = new Error('Stok tidak mencukupi');
                    err.code = 'INSUFFICIENT_STOCK';
                    throw err;
                }

                // Update detail (Sesuai Snippet)
                await conn.query(
                    'UPDATE transaction_items SET qty = ?, base_qty = ?, unit = ?, conversion_ratio = ? WHERE id = ?',
                    [qtyBaru, baseQtyBaru, item.unit || 'Pcs', ratio, lineLama.id]
                );

                // Apply stok baru (Sesuai Snippet)
                const opApply = trxLama.type === 'IN' ? '+' : '-';
                await conn.query(
                    `UPDATE stock SET qty = qty ${opApply} ? WHERE warehouse_id = ? AND item_id = ?`,
                    [baseQtyBaru, finalWhId, itemId]
                );
            } else {
                // Jika item baru ditambahkan ke transaksi yang sudah ada
                // Pastikan baris stok tersedia
                await conn.query(`INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE qty = qty`, [finalWhId, itemId]);
                const [[stokRow]] = await conn.query('SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE', [finalWhId, itemId]);
                
                if (trxLama.type === 'OUT' && (!stokRow || Number(stokRow.qty) < baseQtyBaru)) {
                    await conn.rollback();
                    const err = new Error('Stok tidak mencukupi');
                    err.code = 'INSUFFICIENT_STOCK';
                    throw err;
                }

                const opApply = trxLama.type === 'IN' ? '+' : '-';
                await conn.query(`UPDATE stock SET qty = qty ${opApply} ? WHERE warehouse_id = ? AND item_id = ?`, [baseQtyBaru, finalWhId, itemId]);

                await conn.query(
                    `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [id, itemId, qtyBaru, item.unit || 'Pcs', ratio, baseQtyBaru, item.note || '']
                );
            }
        }

        // Opsional: Hapus item yang ada di DB tapi tidak ada di request (untuk sinkronisasi form full-edit)
        if (data.syncItems) {
            const requestedItemIds = itemsToProcess.map(it => it.itemId || it.item_id);
            const [toBeDeleted] = await conn.query(
                'SELECT * FROM transaction_items WHERE transaction_id = ? AND item_id NOT IN (?)',
                [id, requestedItemIds]
            );
            for (const d of toBeDeleted) {
                const opRevert = trxLama.type === 'IN' ? '-' : '+';
                await conn.query(`UPDATE stock SET qty = qty ${opRevert} ? WHERE warehouse_id = ? AND item_id = ?`, [d.base_qty, finalWhId, d.item_id]);
                await conn.query('DELETE FROM transaction_items WHERE id = ?', [d.id]);
            }
        }

        await conn.commit();
        return { success: true, message: 'Transaksi berhasil diupdate' };

    } catch (error) {
        if (conn) await conn.rollback();
        console.error('EDIT TRANSAKSI ERROR:', error.message);
        throw error; 
    } finally {
        if (conn) conn.release();
    }
};

/**
 * APPLY TRANSACTION LOGIC (Untuk Create)
 */
const applyTransactionLogic = async (conn, transactionId, data, user) => {
    const type = data.type;
    const whId = data.sourceWarehouseId;

    for (const item of data.items) {
        const ratio = Number(item.conversionRatio || 1);
        const baseQty = Number(item.qty) * ratio;
        const itId = item.itemId;

        await conn.query(`INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE qty = qty`, [whId, itId]);
        const [rows] = await conn.query(`SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`, [whId, itId]);
        const currentQty = rows.length > 0 ? Number(rows[0].qty) : 0;

        if (type === 'OUT' && currentQty < baseQty) {
            const err = new Error(`Stok tidak mencukupi untuk item ${itId}`);
            err.code = 'INSUFFICIENT_STOCK';
            throw err;
        }

        const op = type === 'IN' ? '+' : '-';
        await conn.query(`UPDATE stock SET qty = qty ${op} ? WHERE warehouse_id = ? AND item_id = ?`, [baseQty, whId, itId]);

        await conn.query(
            `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transactionId, itId, item.qty, item.unit, ratio, baseQty, item.note]
        );
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
        
        // Manual revert before delete
        const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ? FOR UPDATE', [transactionId]);
        const [txs] = await conn.query('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transactionId]);
        if (txs.length > 0) {
            const tx = txs[0];
            for (const item of items) {
                const op = tx.type === 'IN' ? '-' : '+';
                await conn.query(`UPDATE stock SET qty = qty ${op} ? WHERE warehouse_id = ? AND item_id = ?`, [item.base_qty, tx.source_warehouse_id, item.item_id]);
            }
        }

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
