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

    // Properties (annonces) table — bureautique added, lat/lng added
    db.run(`CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('vente','location')),
        category TEXT NOT NULL CHECK(category IN ('appartement','villa','terrain','commercial','garage','bureautique')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL,
        wilaya TEXT NOT NULL,
        commune TEXT,
        address TEXT,
        lat REAL,
        lng REAL,
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
        client_rip TEXT,
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

    // Estimations table (quick)
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

    // Estimation Requests table (detailed, with email/phone for auto-reply)
    db.run(`CREATE TABLE IF NOT EXISTS estimation_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        whatsapp TEXT,
        wilaya TEXT NOT NULL,
        commune TEXT,
        category TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('vente','location')),
        surface INTEGER NOT NULL,
        rooms INTEGER,
        bathrooms INTEGER,
        parking TEXT DEFAULT 'non',
        condition TEXT DEFAULT 'bon',
        age INTEGER DEFAULT 0,
        description TEXT,
        estimated_price INTEGER,
        status TEXT DEFAULT 'new' CHECK(status IN ('new','processing','completed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Admin settings
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )`);

    // Promotions / Enterprises table — added photos column
    db.run(`CREATE TABLE IF NOT EXISTS promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        logo TEXT,
        photos TEXT DEFAULT '[]',
        description TEXT,
        type TEXT DEFAULT 'agence' CHECK(type IN ('agence','promoteur','entreprise','partenaire')),
        wilaya TEXT,
        phone TEXT,
        email TEXT,
        website TEXT,
        promo_text TEXT,
        custom_field1 TEXT,
        custom_field2 TEXT,
        custom_field3 TEXT,
        custom_field4 TEXT,
        custom_field5 TEXT,
        start_date TEXT,
        end_date TEXT,
        is_program INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
        featured INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ad Banners table — added custom fields
    db.run(`CREATE TABLE IF NOT EXISTS ad_banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        text TEXT,
        link TEXT,
        image TEXT,
        position TEXT DEFAULT 'hero' CHECK(position IN ('hero','top','sidebar','footer')),
        custom_field1 TEXT,
        custom_field2 TEXT,
        custom_field3 TEXT,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Form Fields table (admin-customizable form fields)
    db.run(`CREATE TABLE IF NOT EXISTS form_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        field_key TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL,
        field_type TEXT DEFAULT 'text' CHECK(field_type IN ('text','number','select','textarea','checkbox')),
        options TEXT,
        placeholder TEXT,
        required INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        section TEXT DEFAULT 'info' CHECK(section IN ('info','location','details','contact','custom')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Admin Messages (admin-to-user messaging)
    db.run(`CREATE TABLE IF NOT EXISTS admin_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Site Content table (admin-managed content blocks: notes, offers, conseils)
    db.run(`CREATE TABLE IF NOT EXISTS site_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_key TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        image TEXT,
        active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        section TEXT DEFAULT 'home' CHECK(section IN ('home','tarifs','sidebar','footer','custom')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default settings (with new keys)
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES 
        ('commission_vente', '2'),
        ('commission_location', '5000'),
        ('frais_publication', '1000'),
        ('baridimob_rip', '00799990001001234567'),
        ('admin_whatsapp', '213550000000'),
        ('site_name', 'ImmoElite'),
        ('hero_title', 'Trouvez votre bien immobilier en Algérie'),
        ('hero_subtitle', 'La première plateforme immobilière 100% algérienne — Vente, Location, Estimation'),
        ('primary_color', '#1a1a2e'),
        ('secondary_color', '#16213e'),
        ('accent_color', '#d4a254'),
        ('red_color', '#e94560'),
        ('maintenance_mode', '0'),
        ('section_steps_visible', '1'),
        ('section_commissions_visible', '1'),
        ('section_estimation_visible', '1'),
        ('section_gestion_visible', '1'),
        ('section_testimonials_visible', '1'),
        ('section_contact_visible', '1'),
        ('section_tarifs_visible', '1'),
        ('section_promos_visible', '1'),
        ('footer_text', '© 2024 ImmoElite — Tous droits réservés'),
        ('about_text', 'ImmoElite est la première plateforme immobilière 100% algérienne dédiée à la vente, location et estimation de biens immobiliers across les 58 wilayas.'),
        ('seo_title', 'ImmoElite — Immobilier Algérie'),
        ('seo_description', 'Achetez, vendez, louez et estimez votre bien immobilier en Algérie. Première plateforme immobilière 100% algérienne.'),
        ('promotions_title', 'Professionnels & Entreprises'),
        ('promotions_subtitle', 'Découvrez nos partenaires et programmes promotionnels'),
        ('steps_soft_text', '1'),
        ('background_image', ''),
        ('estimation_auto_reply', 'Merci pour votre demande d''estimation. Notre équipe va étudier votre bien et vous revenir avec une estimation détaillée. Le délai de traitement est de 24 à 48h. Nous nous excusons pour tout délai supplémentaire. \n\nCordialement,\nL''équipe ImmoElite'),
        ('gestion_text', 'Confiez-nous la gestion de vos biens locatifs. Nous prenons en charge la recherche de locataires, la rédaction des baux, l''encaissement des loyers et le suivi des travaux. Contactez-nous pour un devis personnalisé.'),
        ('default_language', 'fr')
    `);

    // Create default admin (password: admin123 → MD5: 0192023a7bbd73250516f069df18b500)
    db.run(`INSERT OR IGNORE INTO users (name, email, phone, password, role) VALUES 
        ('Admin', 'admin@immoelite.dz', '0550000000', '0192023a7bbd73250516f069df18b500', 'admin')
    `);

    // Insert default form fields
    db.run(`INSERT OR IGNORE INTO form_fields (field_key, label, field_type, placeholder, required, active, sort_order, section) VALUES
        ('title', 'Titre de l''annonce', 'text', 'Titre', 1, 1, 1, 'info'),
        ('description', 'Description', 'textarea', 'Décrivez votre bien', 0, 1, 2, 'info'),
        ('price', 'Prix (DZD)', 'number', 'Prix', 1, 1, 3, 'info'),
        ('surface', 'Surface (m²)', 'number', 'Surface', 0, 1, 4, 'details'),
        ('rooms', 'Pièces', 'number', 'Pièces', 0, 1, 5, 'details'),
        ('commune', 'Commune', 'text', 'Commune', 0, 1, 6, 'location'),
        ('address', 'Adresse', 'text', 'Adresse', 0, 1, 7, 'location')
    `);

    // Insert default site content blocks
    db.run(`INSERT OR IGNORE INTO site_content (content_key, title, body, active, sort_order, section) VALUES
        ('home_note', 'Bienvenue sur ImmoElite', 'Votre plateforme immobilière de confiance en Algérie. Publiez, cherchez et trouvez votre bien idéal.', 1, 1, 'home'),
        ('home_offers', 'Offres spéciales', 'Publiez votre annonce pour seulement 1 000 DZ via BaridiMob !', 1, 2, 'home'),
        ('home_conseils', 'Conseils immobiliers', 'Consultez nos guides pour bien estimer, acheter ou vendre votre bien.', 1, 3, 'home')
    `);

    // ========== MIGRATIONS ==========
    // Add contact_phone column if it doesn't exist
    db.all("PRAGMA table_info(properties)", [], (err, cols) => {
        if (!err) {
            const colNames = cols.map(c => c.name);
            if (!colNames.includes('contact_phone')) {
                db.run("ALTER TABLE properties ADD COLUMN contact_phone TEXT", (err2) => {
                    if (!err2) console.log('Migration: added contact_phone to properties');
                });
            }
            if (!colNames.includes('lat')) {
                db.run("ALTER TABLE properties ADD COLUMN lat REAL", (err2) => {
                    if (!err2) console.log('Migration: added lat to properties');
                });
            }
            if (!colNames.includes('lng')) {
                db.run("ALTER TABLE properties ADD COLUMN lng REAL", (err2) => {
                    if (!err2) console.log('Migration: added lng to properties');
                });
            }
        }
    });

    // Add client_rip column to payments if it doesn't exist
    db.all("PRAGMA table_info(payments)", [], (err, cols) => {
        if (!err) {
            const hasClientRip = cols.some(c => c.name === 'client_rip');
            if (!hasClientRip) {
                db.run("ALTER TABLE payments ADD COLUMN client_rip TEXT", (err2) => {
                    if (!err2) console.log('Migration: added client_rip to payments');
                });
            }
        }
    });

    // Add photos + custom fields to promotions if they don't exist
    db.all("PRAGMA table_info(promotions)", [], (err, cols) => {
        if (!err) {
            const colNames = cols.map(c => c.name);
            if (!colNames.includes('photos')) {
                db.run("ALTER TABLE promotions ADD COLUMN photos TEXT DEFAULT '[]'", (err2) => {
                    if (!err2) console.log('Migration: added photos to promotions');
                });
            }
            ['custom_field1','custom_field2','custom_field3','custom_field4','custom_field5','is_program'].forEach(col => {
                if (!colNames.includes(col)) {
                    const def = col === 'is_program' ? 'INTEGER DEFAULT 0' : 'TEXT';
                    db.run('ALTER TABLE promotions ADD COLUMN ' + col + ' ' + def, (err2) => {
                        if (!err2) console.log('Migration: added ' + col + ' to promotions');
                    });
                }
            });
        }
    });

    // Add custom fields to ad_banners if they don't exist
    db.all("PRAGMA table_info(ad_banners)", [], (err, cols) => {
        if (!err) {
            const colNames = cols.map(c => c.name);
            ['custom_field1','custom_field2','custom_field3'].forEach(col => {
                if (!colNames.includes(col)) {
                    db.run('ALTER TABLE ad_banners ADD COLUMN ' + col + ' TEXT', (err2) => {
                        if (!err2) console.log('Migration: added ' + col + ' to ad_banners');
                    });
                }
            });
        }
    });

    // Add new settings keys if they don't exist
    const newSettings = [
        ['section_tarifs_visible', '1'],
        ['section_promos_visible', '1'],
        ['steps_soft_text', '1'],
        ['background_image', ''],
        ['estimation_auto_reply', 'Merci pour votre demande d\'estimation. Notre équipe va étudier votre bien et vous revenir avec une estimation détaillée. Délai de traitement : 24-48h. Nous nous excusons pour tout délai.'],
        ['gestion_text', 'Confiez-nous la gestion de vos biens locatifs. Contactez-nous pour un devis personnalisé.'],
        ['default_language', 'fr']
    ];
    newSettings.forEach(([key, value]) => {
        db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    });
});

module.exports = db;