const router = require('express').Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/* =========================================================
   ITEMS
========================================================= */

// GET ITEMS (optimized, no N+1)
router.get('/items', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        i.*,
        iu.unit_name,
        iu.conversion_ratio,
        iu.operator
      FROM items i
      LEFT JOIN item_units iu ON iu.item_id = i.id
      ORDER BY i.created_at DESC
    `);

    const map = {};
    for (const r of rows) {
      if (!map[r.id]) {
        map[r.id] = {
          ...r,
          conversions: [],
          baseUnit: r.base_unit,
          minStock: r.min_stock
        };
      }
      if (r.unit_name) {
        map[r.id].conversions.push({
          name: r.unit_name,
          ratio: r.conversion_ratio,
          operator: r.operator
        });
      }
    }

    res.json(Object.values(map));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// CREATE / UPDATE ITEM
router.post('/items', async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const {
      id,
      code,
      name,
      category,
      baseUnit,
      minStock,
      initialStock,
      conversions
    } = req.body;

    const itemId = id || uuidv4();

    await conn.query(
      `INSERT INTO items (id, code, name, category, base_unit, min_stock)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         code=VALUES(code),
         name=VALUES(name),
         category=VALUES(category),
         base_unit=VALUES(base_unit),
         min_stock=VALUES(min_stock)`,
      [itemId, code, name, category, baseUnit, minStock || 0]
    );

    await conn.query('DELETE FROM item_units WHERE item_id = ?', [itemId]);

    if (Array.isArray(conversions)) {
      for (const c of conversions) {
        if (c.name && c.ratio) {
          await conn.query(
            `INSERT INTO item_units (item_id, unit_name, conversion_ratio, operator)
             VALUES (?, ?, ?, ?)`,
            [itemId, c.name, Number(c.ratio), c.operator || '*']
          );
        }
      }
    }

    if (!id && Number(initialStock) > 0) {
      const [wh] = await conn.query('SELECT id FROM warehouses LIMIT 1');
      if (wh.length) {
        await conn.query(
          `INSERT INTO stock (warehouse_id, item_id, qty)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)`,
          [wh[0].id, itemId, Number(initialStock)]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ status: 'success', id: itemId });
  } catch (e) {
    if (conn) await conn.rollback();
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    if (conn) conn.release();
  }
});

// DELETE SINGLE ITEM (🔥 WAJIB UNTUK VERCEL)
router.delete('/items/:id', async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const { id } = req.params;

    const [used] = await conn.query(
      'SELECT 1 FROM transaction_items WHERE item_id = ? LIMIT 1',
      [id]
    );
    if (used.length) {
      return res.status(409).json({
        message: 'Item tidak bisa dihapus karena sudah dipakai di transaksi'
      });
    }

    await conn.query('DELETE FROM item_units WHERE item_id = ?', [id]);
    await conn.query('DELETE FROM stock WHERE item_id = ?', [id]);
    await conn.query('DELETE FROM items WHERE id = ?', [id]);

    await conn.commit();
    res.json({ status: 'success' });
  } catch (e) {
    if (conn) await conn.rollback();
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    if (conn) conn.release();
  }
});

// BULK DELETE (PUT = lebih aman di Vercel)
router.put('/items/bulk-delete', async (req, res) => {
  let conn;
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'IDs required' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [used] = await conn.query(
      'SELECT 1 FROM transaction_items WHERE item_id IN (?) LIMIT 1',
      [ids]
    );
    if (used.length) {
      return res.status(409).json({
        message: 'Beberapa item sudah dipakai di transaksi'
      });
    }

    await conn.query('DELETE FROM item_units WHERE item_id IN (?)', [ids]);
    await conn.query('DELETE FROM stock WHERE item_id IN (?)', [ids]);
    const [result] = await conn.query(
      'DELETE FROM items WHERE id IN (?)',
      [ids]
    );

    await conn.commit();
    res.json({ status: 'success', count: result.affectedRows });
  } catch (e) {
    if (conn) await conn.rollback();
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    if (conn) conn.release();
  }
});

/* =========================================================
   WAREHOUSES
========================================================= */

router.get('/warehouses', async (req, res) => {
  try {
    const [wh] = await db.query('SELECT * FROM warehouses');
    res.json(wh);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/warehouses', async (req, res) => {
  try {
    const { id, name, location, phone, pic } = req.body;
    const whId = id || uuidv4();

    await db.query(
      `INSERT INTO warehouses (id, name, location, phone, pic)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name=VALUES(name),
         location=VALUES(location),
         phone=VALUES(phone),
         pic=VALUES(pic)`,
      [whId, name, location, phone, pic]
    );

    res.status(201).json({ status: 'success', id: whId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/warehouses/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM warehouses WHERE id = ?', [req.params.id]);
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================================================
   USERS
========================================================= */

router.get('/users', async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, username, full_name AS name, role, status FROM users'
    );
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { id, username, password, name, role, status } = req.body;
    const userId = id || uuidv4();

    const hash = password
      ? crypto.createHash('sha256').update(password).digest('hex')
      : 'TEMP';

    await db.query(
      `INSERT INTO users (id, username, password_hash, full_name, role, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         username=VALUES(username),
         password_hash=VALUES(password_hash),
         full_name=VALUES(full_name),
         role=VALUES(role),
         status=VALUES(status)`,
      [userId, username, hash, name, role || 'STAFF', status || 'ACTIVE']
    );

    res.status(201).json({ status: 'success', id: userId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================================================
   STOCKS
========================================================= */

router.get('/stocks', async (req, res) => {
  try {
    const [stocks] = await db.query(
      'SELECT item_id AS itemId, warehouse_id AS warehouseId, qty FROM stock'
    );
    res.json(stocks);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
