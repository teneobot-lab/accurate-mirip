
const db = require('./database');

const initSchema = async () => {
    console.log("🛠️ Starting Database Schema Initialization...");
    const conn = await db.getConnection();
    try {
        // 1. Isolated Reject Module Tables
        await conn.query(`
            CREATE TABLE IF NOT EXISTS reject_outlets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS reject_master_items (
                id CHAR(36) PRIMARY KEY,
                code VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(150) NOT NULL,
                category VARCHAR(50),
                base_unit VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS reject_master_units (
                id INT AUTO_INCREMENT PRIMARY KEY,
                item_id CHAR(36) NOT NULL,
                unit_name VARCHAR(20) NOT NULL,
                conversion_ratio DECIMAL(10, 4) NOT NULL,
                operator ENUM('*', '/') DEFAULT '*',
                FOREIGN KEY (item_id) REFERENCES reject_master_items(id) ON DELETE CASCADE,
                UNIQUE(item_id, unit_name)
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS reject_batches (
                id CHAR(36) PRIMARY KEY,
                date DATE NOT NULL,
                outlet VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS reject_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                batch_id CHAR(36) NOT NULL,
                item_id CHAR(36) NOT NULL,
                sku VARCHAR(50),
                name VARCHAR(150),
                qty DECIMAL(15, 4) NOT NULL,
                unit VARCHAR(20) NOT NULL,
                base_qty DECIMAL(15, 4) NOT NULL,
                reason VARCHAR(255),
                FOREIGN KEY (batch_id) REFERENCES reject_batches(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES reject_master_items(id)
            ) ENGINE=InnoDB;
        `);

        // 2. Core Tables (Safety Check)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS item_units (
                id INT AUTO_INCREMENT PRIMARY KEY,
                item_id CHAR(36) NOT NULL,
                unit_name VARCHAR(20) NOT NULL,
                conversion_ratio DECIMAL(10, 4) NOT NULL,
                operator ENUM('*', '/') DEFAULT '*',
                UNIQUE(item_id, unit_name)
            ) ENGINE=InnoDB;
        `);

        console.log("✅ Database Schema Synced Successfully");
    } catch (error) {
        console.error("❌ Database Initialization Error:", error);
        throw error;
    } finally {
        conn.release();
    }
};

module.exports = initSchema;
