
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'waresix_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // Return date as string to avoid timezone issues
});

// Test Connection
pool.getConnection()
    .then(conn => {
        console.log("✅ Database Connected Successfully");
        conn.release();
    })
    .catch(err => {
        console.error("❌ Database Connection Failed:", err);
    });

module.exports = pool;
