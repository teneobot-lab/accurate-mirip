
const mysql = require('mysql2/promise');
require('dotenv').config();

// Ambil kredensial dari .env atau gunakan fallback ke kredensial yang Anda berikan
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'waresix',
  password: process.env.DB_PASSWORD || 'Lokasiku123.',
  database: process.env.DB_NAME || 'waresix_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
};

console.log(`[DB_CONFIG] Attempting connection as user: ${DB_CONFIG.user}`);
console.log(`[DB_CONFIG] Target Database: ${DB_CONFIG.database}`);

const pool = mysql.createPool(DB_CONFIG);

// Verifikasi koneksi awal dengan penanganan error spesifik
pool.getConnection()
    .then(conn => {
        console.log("✅ [DB_CONNECTION] Connected successfully as " + DB_CONFIG.user);
        conn.release();
    })
    .catch(err => {
        console.error("❌ [DB_CONNECTION] Connection Failed!");
        console.error("Error Code:", err.code);
        console.error("Message:", err.sqlMessage || err.message);
        
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error("👉 Masalah: Password atau User salah.");
        } else if (err.code === 'ER_BAD_DB_ERROR') {
            console.error("👉 Masalah: Database '" + DB_CONFIG.database + "' belum dibuat di MySQL.");
        }
    });

module.exports = pool;
