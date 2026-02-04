
const mysql = require('mysql2/promise');
const path = require('path');
// Pastikan dotenv mencari file di root folder server
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'waresix', // Fallback paksa ke waresix
  password: process.env.DB_PASSWORD || 'Lokasiku123.', // Fallback paksa ke password Anda
  database: process.env.DB_NAME || 'waresix_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
};

console.log(`[DATABASE] Mencoba koneksi sebagai user: ${DB_CONFIG.user}`);

const pool = mysql.createPool(DB_CONFIG);

// Verifikasi koneksi
pool.getConnection()
    .then(conn => {
        console.log("✅ [DATABASE] Koneksi Berhasil sebagai " + DB_CONFIG.user);
        conn.release();
    })
    .catch(err => {
        console.error("❌ [DATABASE] KONEKSI GAGAL!");
        console.error("User:", DB_CONFIG.user);
        console.error("Error Code:", err.code);
        console.error("Pesan:", err.sqlMessage || err.message);
        
        if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR') {
            console.error("👉 Masalah: Password 'Lokasiku123.' salah atau user 'waresix' belum diberi izin.");
        } else if (err.code === 'ER_BAD_DB_ERROR') {
            console.error("👉 Masalah: Database 'waresix_db' belum ada. Jalankan: CREATE DATABASE waresix_db;");
        }
    });

module.exports = pool;
