
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * REVERT STOCK EFFECT (Standalone helper with Explicit Locking)
 * Mengembalikan stok ke kondisi sebelum transaksi tersebut ada.
 */
const revertStockEffect = async (conn, transactionId) => {
    console.log(`[REVERT-START] Locking and reverting stock for TX: ${transactionId}`);
    
    // 1. Lock Header Transaksi lama agar tidak bisa diubah proses lain
    const [txs] = await conn.query('SELECT * FROM transactions WHERE id = ? FOR UPDATE', [transactionId]);
    if (txs.length === 0) {
        console.log(`[REVERT-INFO] No transaction found for ID: ${transactionId}`);
        return;
    }
    const tx = txs[0];

    // 2. Lock item-item transaksi lama
    const [items] = await conn.query('SELECT * FROM transaction_items WHERE transaction_id = ? FOR UPDATE', [transactionId]);

    for (const item of items) {
        const baseQty = Number(item.base_qty);
        const warehouseId = tx.source_warehouse_id;
        const itemId = item.item_id;

        console.log(`[REVERT-STEP] Item: ${itemId}, BaseQty: ${baseQty}, WH: ${warehouseId}`);

        // Pastikan row stok ada dan dikunci (FOR UPDATE) sebelum di-revert
        await conn.query('INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE qty = qty', [warehouseId, itemId]);
        await conn.query('SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE', [warehouseId, itemId]);

        if (tx.type === 'IN' || tx.type === 'ADJUSTMENT') {
            // Revert IN: Stok dikurangi kembali
            await conn.query(
                `UPDATE stock SET qty = qty - ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, warehouseId, itemId]
            );
        } else if (tx.type === 'OUT') {
            // Revert OUT: Stok ditambah kembali
            await conn.query(
                `UPDATE stock SET qty = qty + ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, warehouseId, itemId]
            );
        } else if (tx.type === 'TRANSFER') {
            // Revert TRANSFER: Kembalikan ke asal, kurangi dari target
            await conn.query(
                `UPDATE stock SET qty = qty + ? WHERE warehouse_id = ? AND item_id = ?`,
                [baseQty, warehouseId, itemId]
            );
            if (tx.target_warehouse_id) {
                await conn.query('INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE qty = qty', [tx.target_warehouse_id, itemId]);
                await conn.query('SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE', [tx.target_warehouse_id, itemId]);
                await conn.query(
                    `UPDATE stock SET qty = qty - ? WHERE warehouse_id = ? AND item_id = ?`,
                    [baseQty, tx.target_warehouse_id, itemId]
                );
            }
        }
    }
    console.log(`[REVERT-DONE] Successfully reverted old stock impacts.`);
};

/**
 * CORE LOGIC: APPLY NEW TRANSACTION DATA (Internal Transactional)
 */
const applyTransactionLogicInternal = async (data, user, conn) => {
    const trxId = data.id;
    const partnerId = data.partnerId || null;
    const type = data.type; // 'IN' or 'OUT'

    console.log(`[APPLY-HEADER] Upserting ${type} Transaction: ${trxId}`);
    
    // Header Upsert
    await conn.query(
        `INSERT INTO transactions (id, reference_no, type, date, source_warehouse_id, partner_id, delivery_order_no, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            reference_no=VALUES(reference_no), type=VALUES(type), date=VALUES(date), 
            source_warehouse_id=VALUES(source_warehouse_id), partner_id=VALUES(partner_id), 
            delivery_order_no=VALUES(delivery_order_no), notes=VALUES(notes)`,
        [trxId, data.referenceNo, type, data.date, data.sourceWarehouseId, partnerId, data.deliveryOrderNo, data.notes, user.id]
    );

    for (const item of data.items) {
        const ratio = Number(item.conversionRatio || 1);
        const baseQty = Number(item.qty) * ratio;
        const whId = data.sourceWarehouseId;
        const itId = item.itemId;

        console.log(`[APPLY-ITEM] ${type} | SKU: ${itId} | BaseQty: ${baseQty}`);

        // 1. Lock stock record
        await conn.query(`INSERT INTO stock (warehouse_id, item_id, qty) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE qty = qty`, [whId, itId]);
        const [rows] = await conn.query(`SELECT qty FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`, [whId, itId]);
        
        const currentQty = rows.length > 0 ? Number(rows[0].qty) : 0;

        // 2. Validate for OUT
        if (type === 'OUT' && currentQty < baseQty) {
            throw new Error(`Stok tidak cukup untuk item ${itId}. Tersedia: ${currentQty}, Dibutuhkan: ${baseQty}`);
        }

        // 3. Update Stock
        const updateQuery = type === 'IN' 
            ? `UPDATE stock SET qty = qty + ? WHERE warehouse_id = ? AND item_id = ?`
            : `UPDATE stock SET qty = qty - ? WHERE warehouse_id = ? AND item_id = ?`;
            
        await conn.query(updateQuery, [baseQty, whId, itId]);

        // 4. Insert Transaction Item
        await conn.query(
            `INSERT INTO transaction_items (transaction_id, item_id, qty, unit, conversion_ratio, base_qty, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [trxId, itId, item.qty, item.unit, ratio, baseQty, item.note]
        );
    }
};

/**
 * EXPORT: UPDATE TRANSACTION (Endpoint: PUT /transactions/:id)
 */
exports.updateTransaction = async (id, data, user) => {
    console.log(`[MASTER-UPDATE] Processing Update for Transaction: ${id}`);
    const conn = await db.getConnection();
    
    try {
        // STEP 0: Set Timeout agar query tidak menggantung selamanya (Mencegah 502)
        await conn.query('SET innodb_lock_wait_timeout = 10');
        
        // STEP 1: Mulai Transaksi Database
        await conn.beginTransaction();
        console.log(`[STEP 1] Database Transaction Started`);

        // STEP 2: Revert stok lama (History condition)
        // Ini akan melakukan SELECT ... FOR UPDATE secara internal
        await revertStockEffect(conn, id);

        // STEP 3: Hapus baris item lama (History condition)
        console.log(`[STEP 3] Removing old line items for cleanup`);
        await conn.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);

        // STEP 4: Terapkan logika baru (Current condition)
        await applyTransactionLogicInternal({ ...data, id }, user, conn);

        // STEP 5: Selesaikan Transaksi
        await conn.commit();
        console.log(`[STEP 5] Database Transaction Committed Successfully`);
        
        return { success: true, id };

    } catch (error) {
        console.error(`[CRITICAL-FAIL] Transaction Update Aborted: ${error.message}`);
        if (conn) {
            console.log(`[ROLLBACK] Rolling back database changes...`);
            await conn.rollback();
        }
        throw error; // Rethrow ke controller
    } finally {
        if (conn) {
            console.log(`[RELEASE] MySQL connection released to pool`);
            conn.release();
        }
    }
};

/**
 * EXPORT: CREATE TRANSACTION (Endpoint: POST /transactions)
 */
exports.processInboundTransaction = async (data, user) => {
    const conn = await db.getConnection();
    try {
        await conn.query('SET innodb_lock_wait_timeout = 10');
        await conn.beginTransaction();
        const trxId = data.id || uuidv4();
        await applyTransactionLogicInternal({ ...data, id: trxId, type: 'IN' }, user, conn);
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
        await applyTransactionLogicInternal({ ...data, id: trxId, type: 'OUT' }, user, conn);
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
