
-- Waresix Inventory Database Schema

-- 1. Authentication & Users
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE -- 'ADMIN', 'MANAGER', 'STAFF'
) ENGINE=InnoDB;

CREATE TABLE users (
    id CHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'STAFF',
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Master Data (Main Inventory)
CREATE TABLE warehouses (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location TEXT,
    pic VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE items (
    id CHAR(36) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50),
    base_unit VARCHAR(20) NOT NULL,
    min_stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE item_units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id CHAR(36) NOT NULL,
    unit_name VARCHAR(20) NOT NULL,
    conversion_ratio DECIMAL(10, 4) NOT NULL,
    operator ENUM('*', '/') DEFAULT '*',
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    UNIQUE(item_id, unit_name)
) ENGINE=InnoDB;

CREATE TABLE partners (
    id CHAR(36) PRIMARY KEY,
    type ENUM('SUPPLIER', 'CUSTOMER') NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    npwp VARCHAR(50),
    term_days INT DEFAULT 0
) ENGINE=InnoDB;

-- 3. Core Inventory Stock
CREATE TABLE stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id CHAR(36) NOT NULL,
    item_id CHAR(36) NOT NULL,
    qty DECIMAL(15, 4) DEFAULT 0, -- Always in Base Unit
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (item_id) REFERENCES items(id),
    UNIQUE INDEX idx_stock_unique (warehouse_id, item_id)
) ENGINE=InnoDB;

-- 4. Transactions (Logistics)
CREATE TABLE transactions (
    id CHAR(36) PRIMARY KEY,
    reference_no VARCHAR(50) NOT NULL UNIQUE,
    type ENUM('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT') NOT NULL,
    date DATE NOT NULL,
    source_warehouse_id CHAR(36) NOT NULL,
    target_warehouse_id CHAR(36),
    partner_id CHAR(36), -- Supplier or Customer
    delivery_order_no VARCHAR(50),
    notes TEXT,
    created_by CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE transaction_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id CHAR(36) NOT NULL,
    item_id CHAR(36) NOT NULL,
    qty DECIMAL(15, 4) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    conversion_ratio DECIMAL(10, 4) NOT NULL,
    base_qty DECIMAL(15, 4) NOT NULL, -- qty * ratio
    note VARCHAR(255),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id)
) ENGINE=InnoDB;

-- 5. Isolated Reject Module (Master & Transactions)
CREATE TABLE reject_outlets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE reject_master_items (
    id CHAR(36) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50),
    base_unit VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE reject_master_units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id CHAR(36) NOT NULL,
    unit_name VARCHAR(20) NOT NULL,
    conversion_ratio DECIMAL(10, 4) NOT NULL,
    operator ENUM('*', '/') DEFAULT '*',
    FOREIGN KEY (item_id) REFERENCES reject_master_items(id) ON DELETE CASCADE,
    UNIQUE(item_id, unit_name)
) ENGINE=InnoDB;

CREATE TABLE reject_batches (
    id CHAR(36) PRIMARY KEY,
    date DATE NOT NULL,
    outlet VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE reject_items (
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

-- 6. Music Player
CREATE TABLE playlists (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE playlist_songs (
    id CHAR(36) PRIMARY KEY,
    playlist_id CHAR(36) NOT NULL,
    title VARCHAR(200) NOT NULL,
    youtube_url VARCHAR(500) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Indexes for Performance
CREATE INDEX idx_trx_date ON transactions(date);
CREATE INDEX idx_trx_type ON transactions(type);
CREATE INDEX idx_trx_source ON transactions(source_warehouse_id);
CREATE INDEX idx_rej_date ON reject_batches(date);
