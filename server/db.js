const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'immobilier.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('DB Error:', err.message);
    else console.log('Connected to SQLite database');
});

db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        baridimob_rip TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Properties (annonces) table
    db.run(`CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('vente','location')),
        category TEXT NOT NULL CHECK(category IN ('appartement','villa','terrain','commercial','garage')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL,
        wilaya TEXT NOT NULL,
        commune TEXT,
        address TEXT,
        surface INTEGER,
        rooms INTEGER,
        bathrooms INTEGER,
        parking TEXT DEFAULT 'non',
        condition TEXT DEFAULT 'bon',
        age INTEGER DEFAULT 0,
        images TEXT DEFAULT '[]',
        contact_phone TEXT,
        featured INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','sold','rented','expired','pending')),
        views INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Payments (publications) table
    db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        property_id INTEGER,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('publication','commission_vente','commission_location')),
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected')),
        reference TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Contacts (messages) table
    db.run(`CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        subject TEXT,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Estimations table
    db.run(`CREATE TABLE IF NOT EXISTS estimations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        wilaya TEXT NOT NULL,
        category TEXT NOT NULL,
        surface INTEGER NOT NULL,
        condition_val TEXT NOT NULL,
        age INTEGER DEFAULT 0,
        parking TEXT DEFAULT 'non',
        estimated_price INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Admin settings
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )`);

    // Insert default settings
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES 
        ('commission_vente', '2'),
        ('commission_location', '5000'),
        ('frais_publication', '1000'),
        ('baridimob_rip', '00799990001001234567'),
        ('admin_whatsapp', '213550000000'),
        ('site_name', 'ImmoElite')
    `);

    // Create default admin (password: admin123 - should be changed)
    db.run(`INSERT OR IGNORE INTO users (name, email, phone, password, role) VALUES 
        ('Admin', 'admin@immoelite.dz', '0550000000', '0192023a7bbd73250516f069df18b500', 'admin')
    `);

    // ========== MIGRATIONS ==========
    // Add contact_phone column if it doesn't exist
    db.all("PRAGMA table_info(properties)", [], (err, cols) => {
        if (!err) {
            const hasContactPhone = cols.some(c => c.name === 'contact_phone');
            if (!hasContactPhone) {
                db.run("ALTER TABLE properties ADD COLUMN contact_phone TEXT", (err2) => {
                    if (!err2) console.log('Migration: added contact_phone column to properties');
                });
            }
        }
    });
});

module.exports = db;