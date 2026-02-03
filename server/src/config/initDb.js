
const db = require('./database');

const initSchema = async () => {
    console.log("🛠️  Initializing Database Schema...");
    const conn = await db.getConnection();

    // Helper: Safely add column if it doesn't exist (Migration)
    const addColumnSafe = async (tableName, columnName, columnDefinition) => {
        try {
            // Check if table exists first to avoid errors
            const [tables] = await conn.query(`SHOW TABLES LIKE '${tableName}'`);
            if (tables.length === 0) return; // Table doesn't exist yet, CREATE TABLE will handle it

            const [cols] = await conn.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
            if (cols.length === 0) {
                console.log(`🔸 Migrating: Adding column '${columnName}' to table '${tableName}'...`);
                await conn.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
            }
        } catch (err) {
            console.warn(`⚠️ Migration warning for ${tableName}.${columnName}:`, err.message);
        }
    };

    try {
        // 1. Core Master Tables
        await conn.query(`
            CREATE TABLE IF NOT EXISTS warehouses (
                id CHAR(36) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                location TEXT,
                pic VARCHAR(100),
                phone VARCHAR(20),
                is_active BOOLEAN DEFAULT TRUE
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS items (
                id CHAR(36) PRIMARY KEY,
                code VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(150) NOT NULL,
                category VARCHAR(50),
                base_unit VARCHAR(20) NOT NULL,
                min_stock INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS item_units (
                id INT AUTO_INCREMENT PRIMARY KEY,
                item_id CHAR(36) NOT NULL,
                unit_name VARCHAR(20) NOT NULL,
                conversion_ratio DECIMAL(10, 4) NOT NULL,
                operator ENUM('*', '/') DEFAULT '*',
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                UNIQUE(item_id, unit_name)
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS partners (
                id CHAR(36) PRIMARY KEY,
                type ENUM('SUPPLIER', 'CUSTOMER') NOT NULL,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(100),
                address TEXT,
                npwp VARCHAR(50),
                term_days INT DEFAULT 0
            ) ENGINE=InnoDB;
        `);

        // 2. Stock Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS stock (
                id INT AUTO_INCREMENT PRIMARY KEY,
                warehouse_id CHAR(36) NOT NULL,
                item_id CHAR(36) NOT NULL,
                qty DECIMAL(15, 4) DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                UNIQUE INDEX idx_stock_unique (warehouse_id, item_id)
            ) ENGINE=InnoDB;
        `);

        // 3. Transactions
        await conn.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id CHAR(36) PRIMARY KEY,
                reference_no VARCHAR(50) NOT NULL UNIQUE,
                type ENUM('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT') NOT NULL,
                date DATE NOT NULL,
                source_warehouse_id CHAR(36) NOT NULL,
                target_warehouse_id CHAR(36),
                partner_id CHAR(36),
                delivery_order_no VARCHAR(50),
                notes TEXT,
                created_by CHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(id)
            ) ENGINE=InnoDB;
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS transaction_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                transaction_id CHAR(36) NOT NULL,
                item_id CHAR(36) NOT NULL,
                qty DECIMAL(15, 4) NOT NULL,
                unit VARCHAR(20) NOT NULL,
                conversion_ratio DECIMAL(10, 4) DEFAULT 1,
                base_qty DECIMAL(15, 4) NOT NULL,
                note VARCHAR(255),
                FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(id)
            ) ENGINE=InnoDB;
        `);

        // 4. Reject Module Tables
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

        // 5. User & Auth
        await conn.query(`
             CREATE TABLE IF NOT EXISTS users (
                id CHAR(36) PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                role VARCHAR(20) DEFAULT 'STAFF',
                status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        // 6. Music Module
        await conn.query(`
             CREATE TABLE IF NOT EXISTS playlists (
                id CHAR(36) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        
        await conn.query(`
             CREATE TABLE IF NOT EXISTS playlist_songs (
                id CHAR(36) PRIMARY KEY,
                playlist_id CHAR(36) NOT NULL,
                title VARCHAR(200) NOT NULL,
                youtube_url VARCHAR(500) NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // --- AUTO MIGRATION (Fix Missing Columns in Existing DB) ---
        await addColumnSafe('transaction_items', 'base_qty', 'DECIMAL(15, 4) NOT NULL DEFAULT 0');
        await addColumnSafe('transaction_items', 'conversion_ratio', 'DECIMAL(10, 4) DEFAULT 1');
        await addColumnSafe('transactions', 'created_by', 'CHAR(36)');
        await addColumnSafe('users', 'role', "VARCHAR(20) DEFAULT 'STAFF'");
        await addColumnSafe('users', 'status', "ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE'");

        console.log("✅ Database Schema Synced & Validated");
    } catch (error) {
        console.error("❌ Database Initialization Error:", error);
        throw error;
    } finally {
        conn.release();
    }
};

module.exports = initSchema;
