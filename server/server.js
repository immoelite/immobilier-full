const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { authMiddleware, adminMiddleware, register, login, getProfile, updateProfile, changeAdminEmail, changeAdminPassword } = require('./auth');
const { createProperty, getProperties, getPropertyById, updateProperty, deleteProperty, incrementViews, getAllPropertiesAdmin } = require('./properties');
const { createPayment, confirmPayment, getPaymentsByUser, getAllPayments, getPaymentStats } = require('./payments');
const { calculateEstimation, saveEstimation, getEstimations } = require('./estimation');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// File upload config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png|webp)$/.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Seules les images sont autorisées'));
}});

// Multi-field upload (for promotions with logo + photos)
const uploadFields = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png|webp)$/.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Seules les images sont autorisées'));
}});

// ========== AUTH ROUTES ==========
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        if (!name || !email || !phone || !password) return res.status(400).json({ error: 'Tous les champs sont requis' });
        const id = await register(name, email, phone, password);
        res.json({ success: true, userId: id });
    } catch (e) { res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Email déjà utilisé' : e.message }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await login(email, password);
        res.json(result);
    } catch (e) { res.status(401).json({ error: e.message }); }
});

app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
        const profile = await getProfile(req.userId);
        res.json(profile);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/profile', authMiddleware, async (req, res) => {
    try {
        await updateProfile(req.userId, req.body);
        const profile = await getProfile(req.userId);
        res.json(profile);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== ADMIN ACCOUNT ROUTES ==========
app.post('/api/admin/change-email', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { currentPassword, newEmail } = req.body;
        if (!currentPassword || !newEmail) return res.status(400).json({ error: 'Champs requis manquants' });
        await changeAdminEmail(req.userId, currentPassword, newEmail);
        res.json({ success: true, message: 'Email mis à jour' });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/admin/change-password', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Champs requis manquants' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
        await changeAdminPassword(req.userId, currentPassword, newPassword);
        res.json({ success: true, message: 'Mot de passe mis à jour' });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// ========== ADMIN MANAGEMENT (create additional admins) ==========
app.get('/api/admin/admins', authMiddleware, adminMiddleware, (req, res) => {
    db.all('SELECT id, name, email, phone, created_at FROM users WHERE role = ?', ['admin'], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/admins', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        if (!name || !email || !phone || !password) return res.status(400).json({ error: 'Tous les champs sont requis' });
        const id = await register(name, email, phone, password);
        db.run('UPDATE users SET role = ? WHERE id = ?', ['admin', id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id });
        });
    } catch (e) { res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Email déjà utilisé' : e.message }); }
});

app.delete('/api/admin/admins/:id', authMiddleware, adminMiddleware, (req, res) => {
    const id = parseInt(req.params.id);
    // Prevent deleting yourself
    if (id === req.userId) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte admin' });
    db.run('UPDATE users SET role = ? WHERE id = ? AND role = ?', ['user', id, 'admin'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// ========== PROPERTY ROUTES ==========
app.get('/api/properties', async (req, res) => {
    try {
        const filters = {
            type: req.query.type,
            wilaya: req.query.wilaya,
            category: req.query.category,
            min_price: req.query.min_price,
            max_price: req.query.max_price,
            min_surface: req.query.min_surface,
            rooms: req.query.rooms,
            limit: req.query.limit || 20,
            offset: req.query.offset || 0
        };
        const props = await getProperties(filters);
        res.json(props);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/properties/:id', async (req, res) => {
    try {
        const prop = await getPropertyById(req.params.id);
        if (!prop) return res.status(404).json({ error: 'Annonce non trouvée' });
        incrementViews(req.params.id);
        res.json(prop);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/properties', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const images = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];
        const data = { ...req.body, user_id: req.userId, images };
        data.price = parseInt(data.price);
        if (data.contact_phone === 'platform') {
            const s = await new Promise(r => db.get("SELECT value FROM settings WHERE key = 'admin_whatsapp'", [], (e, row) => r(row)));
            data.contact_phone = s?.value ? '0' + s.value.replace(/^213/, '') : null;
        } else if (data.contact_phone === 'mine') {
            const u = await new Promise(r => db.get('SELECT phone FROM users WHERE id = ?', [req.userId], (e, row) => r(row)));
            data.contact_phone = u?.phone || null;
        }
        data.surface = parseInt(data.surface) || 0;
        data.rooms = parseInt(data.rooms) || 0;
        data.bathrooms = parseInt(data.bathrooms) || 0;
        data.age = parseInt(data.age) || 0;
        data.lat = data.lat ? parseFloat(data.lat) : null;
        data.lng = data.lng ? parseFloat(data.lng) : null;
        const id = await createProperty(data);
        const setting = await new Promise((resolve) => {
            db.get("SELECT value FROM settings WHERE key = 'frais_publication'", [], (err, row) => resolve(row));
        });
        const frais = parseInt(setting?.value || '1000');
        await createPayment({ user_id: req.userId, property_id: id, amount: frais, type: 'publication', status: 'pending', client_rip: req.body.client_rip || null, notes: 'Frais de publication' });
        res.json({ success: true, propertyId: id, fraisPublication: frais });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/properties/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const images = req.files && req.files.length ? req.files.map(f => '/uploads/' + f.filename) : (req.body.images ? JSON.parse(typeof req.body.images === 'string' ? req.body.images : JSON.stringify(req.body.images)) : []);
        const data = { ...req.body, images };
        if (req.userRole === 'admin' && req.body.owner_phone) {
            db.run('UPDATE users SET phone = ? WHERE id = (SELECT user_id FROM properties WHERE id = ?)', [req.body.owner_phone, req.params.id]);
        }
        if (req.userRole === 'admin' && req.body.contact_phone) {
            data.contact_phone = req.body.contact_phone;
        }
        data.lat = data.lat ? parseFloat(data.lat) : null;
        data.lng = data.lng ? parseFloat(data.lng) : null;
        const changes = await updateProperty(req.params.id, data, req.userId, req.userRole);
        res.json({ success: true, changes });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/properties/:id', authMiddleware, async (req, res) => {
    try {
        const changes = await deleteProperty(req.params.id, req.userId, req.userRole);
        res.json({ success: true, changes });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== PAYMENT ROUTES ==========
app.get('/api/payments', authMiddleware, adminMiddleware, async (req, res) => {
    try { res.json(await getAllPayments()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/payments/my', authMiddleware, async (req, res) => {
    try { res.json(await getPaymentsByUser(req.userId)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/payments/:id/confirm', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const changes = await confirmPayment(req.params.id, status);
        res.json({ success: true, changes });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/payments/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        db.run('UPDATE payments SET status = "rejected" WHERE id = ?', [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const payStats = await getPaymentStats();
        const propCount = await new Promise((resolve) => {
            db.get('SELECT COUNT(*) as total, SUM(CASE WHEN status="active" THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status="pending" THEN 1 ELSE 0 END) as pending, SUM(views) as total_views FROM properties', [], (err, row) => resolve(row));
        });
        const userCount = await new Promise((resolve) => {
            db.get('SELECT COUNT(*) as total FROM users', [], (err, row) => resolve(row));
        });
        res.json({ payments: payStats, properties: propCount, users: userCount });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== ESTIMATION ROUTES ==========
app.post('/api/estimation', async (req, res) => {
    try {
        const result = await saveEstimation(req.userId || null, req.body);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/estimation/prices', (req, res) => {
    res.json(require('./estimation').basePrices);
});

app.get('/api/estimation/my', authMiddleware, async (req, res) => {
    try { res.json(await getEstimations(req.userId)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== DETAILED ESTIMATION REQUESTS ==========
app.post('/api/estimation-request', (req, res) => {
    const { name, email, phone, whatsapp, wilaya, commune, category, type, surface, rooms, bathrooms, parking, condition, age, description } = req.body;
    if (!name || !email || !wilaya || !category || !surface) return res.status(400).json({ error: 'Champs requis manquants' });
    db.run(
        `INSERT INTO estimation_requests (name, email, phone, whatsapp, wilaya, commune, category, type, surface, rooms, bathrooms, parking, condition, age, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, email, phone || null, whatsapp || null, wilaya, commune || null, category, type || 'vente', parseInt(surface), rooms ? parseInt(rooms) : null, bathrooms ? parseInt(bathrooms) : null, parking || 'non', condition || 'bon', age ? parseInt(age) : 0, description || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            // Get auto-reply text from settings
            db.get("SELECT value FROM settings WHERE key = 'estimation_auto_reply'", [], (err2, row) => {
                const autoReply = row?.value || 'Merci pour votre demande. Notre équipe reviendra vers vous sous 24-48h.';
                res.json({ success: true, id: this.lastID, auto_reply: autoReply });
            });
        }
    );
});

app.get('/api/admin/estimation-requests', authMiddleware, adminMiddleware, (req, res) => {
    db.all('SELECT * FROM estimation_requests ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/admin/estimation-requests/:id', authMiddleware, adminMiddleware, (req, res) => {
    const { estimated_price, status } = req.body;
    db.run('UPDATE estimation_requests SET estimated_price = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [estimated_price ? parseInt(estimated_price) : null, status || 'new', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

app.delete('/api/admin/estimation-requests/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.run('DELETE FROM estimation_requests WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ========== CONTACT ROUTES ==========
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;
        db.run('INSERT INTO contacts (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
            [name, email, phone, subject, message], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== ADMIN SETTINGS ==========
app.get('/api/settings', (req, res) => {
    db.all('SELECT key, value FROM settings', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    });
});

app.put('/api/settings', authMiddleware, adminMiddleware, (req, res) => {
    const entries = Object.entries(req.body);
    let done = 0;
    entries.forEach(([key, value]) => {
        db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value], (err) => {
            if (err) console.error(err);
            if (++done === entries.length) res.json({ success: true });
        });
    });
});

// ========== BACKGROUND IMAGE UPLOAD ==========
app.post('/api/admin/upload-bg', authMiddleware, adminMiddleware, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucune image' });
    const imagePath = '/uploads/' + req.file.filename;
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('background_image', ?)", [imagePath], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, path: imagePath });
    });
});

// ========== FORM FIELDS CUSTOMIZATION ==========
app.get('/api/form-fields', (req, res) => {
    db.all('SELECT * FROM form_fields ORDER BY sort_order, id', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/form-fields', authMiddleware, adminMiddleware, (req, res) => {
    const { field_key, label, field_type, options, placeholder, required, active, sort_order, section } = req.body;
    if (!field_key || !label) return res.status(400).json({ error: 'Clé et label requis' });
    db.run(
        'INSERT INTO form_fields (field_key, label, field_type, options, placeholder, required, active, sort_order, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [field_key, label, field_type || 'text', options ? JSON.stringify(options) : null, placeholder || '', required ? 1 : 0, active !== undefined ? (active ? 1 : 0) : 1, sort_order || 0, section || 'custom'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.put('/api/form-fields/:id', authMiddleware, adminMiddleware, (req, res) => {
    const { label, field_type, options, placeholder, required, active, sort_order, section } = req.body;
    db.run(
        'UPDATE form_fields SET label=?, field_type=?, options=?, placeholder=?, required=?, active=?, sort_order=?, section=? WHERE id=?',
        [label, field_type || 'text', options ? JSON.stringify(options) : null, placeholder || '', required ? 1 : 0, active !== undefined ? (active ? 1 : 0) : 1, sort_order || 0, section || 'custom', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

app.delete('/api/form-fields/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.run('DELETE FROM form_fields WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ========== USER EDIT & MESSAGING ==========
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    db.all('SELECT id, name, email, phone, role, baridimob_rip, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    const { name, phone, email, baridimob_rip, role } = req.body;
    const fields = [];
    const values = [];
    if (name) { fields.push('name = ?'); values.push(name); }
    if (phone) { fields.push('phone = ?'); values.push(phone); }
    if (email) { fields.push('email = ?'); values.push(email); }
    if (baridimob_rip) { fields.push('baridimob_rip = ?'); values.push(baridimob_rip); }
    if (role) { fields.push('role = ?'); values.push(role); }
    if (fields.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    values.push(req.params.id);
    db.run('UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?', values, function(err) {
        if (err) return res.status(500).json({ error: err.message.includes('UNIQUE') ? 'Email déjà utilisé' : err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.put('/api/admin/users/:id/role', authMiddleware, adminMiddleware, (req, res) => {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
    db.run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM payments WHERE user_id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run('DELETE FROM properties WHERE user_id = ?', [id], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            db.run('DELETE FROM users WHERE id = ?', [id], function(err3) {
                if (err3) return res.status(500).json({ error: err3.message });
                res.json({ success: true, changes: this.changes });
            });
        });
    });
});

// Admin messages to users
app.post('/api/admin/messages', authMiddleware, adminMiddleware, (req, res) => {
    const { user_id, subject, body } = req.body;
    if (!user_id || !body) return res.status(400).json({ error: 'Destinataire et message requis' });
    db.run('INSERT INTO admin_messages (admin_id, user_id, subject, body) VALUES (?, ?, ?, ?)',
        [req.userId, user_id, subject || null, body], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

app.get('/api/admin/messages', authMiddleware, adminMiddleware, (req, res) => {
    db.all(`SELECT m.*, u.name as user_name, u.email as user_email, u.phone as user_phone
        FROM admin_messages m LEFT JOIN users u ON m.user_id = u.id
        ORDER BY m.created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.delete('/api/admin/messages/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.run('DELETE FROM admin_messages WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// User: get messages from admin
app.get('/api/messages', authMiddleware, (req, res) => {
    db.all('SELECT * FROM admin_messages WHERE user_id = ? ORDER BY created_at DESC', [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Mark as read
        db.run('UPDATE admin_messages SET is_read = 1 WHERE user_id = ?', [req.userId]);
        res.json(rows);
    });
});

// ========== SITE CONTENT (notes, offres, conseils) ==========
app.get('/api/site-content', (req, res) => {
    db.all('SELECT * FROM site_content ORDER BY sort_order, id', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/site-content/:id', (req, res) => {
    db.get('SELECT * FROM site_content WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Bloc non trouve' });
        res.json(row);
    });
});

app.post('/api/admin/site-content', authMiddleware, adminMiddleware, upload.single('image'), (req, res) => {
    const { content_key, title, body, active, sort_order, section } = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : null;
    if (!content_key || !title) return res.status(400).json({ error: 'Clé et titre requis' });
    db.run(
        'INSERT INTO site_content (content_key, title, body, image, active, sort_order, section) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [content_key, title, body || '', image, active !== undefined ? (active ? 1 : 0) : 1, sort_order || 0, section || 'home'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message.includes('UNIQUE') ? 'Cette clé existe déjà' : err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.put('/api/admin/site-content/:id', authMiddleware, adminMiddleware, upload.single('image'), (req, res) => {
    const { title, body, active, sort_order, section } = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : (req.body.existing_image || null);
    db.run(
        'UPDATE site_content SET title=?, body=?, image=?, active=?, sort_order=?, section=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [title, body || '', image, active !== undefined ? (active ? 1 : 0) : 1, sort_order || 0, section || 'home', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

app.delete('/api/admin/site-content/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.run('DELETE FROM site_content WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ========== PROMOTIONS / ENTERPRISES ROUTES ==========
// Public: list active promotions
app.get('/api/promotions/public', (req, res) => {
    const now = new Date().toISOString().split('T')[0];
    db.all(
        `SELECT * FROM promotions WHERE status = 'active' AND (end_date IS NULL OR end_date >= ?) ORDER BY featured DESC, created_at DESC`,
        [now],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            rows.forEach(r => { r.photos = JSON.parse(r.photos || '[]'); });
            res.json(rows);
        }
    );
});

// Admin: list all promotions
app.get('/api/promotions', authMiddleware, adminMiddleware, (req, res) => {
    db.all('SELECT * FROM promotions ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        rows.forEach(r => { r.photos = JSON.parse(r.photos || '[]'); });
        res.json(rows);
    });
});

// Admin: get single promotion
app.get('/api/promotions/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.get('SELECT * FROM promotions WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Promotion non trouvee' });
        row.photos = JSON.parse(row.photos || '[]');
        res.json(row);
    });
});

// Admin: create promotion (with logo + photos)
app.post('/api/promotions', authMiddleware, adminMiddleware, uploadFields.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'photos', maxCount: 5 }
]), (req, res) => {
    const data = req.body;
    const logo = req.files && req.files['logo'] ? '/uploads/' + req.files['logo'][0].filename : (data.logo || null);
    const photos = req.files && req.files['photos'] ? req.files['photos'].map(f => '/uploads/' + f.filename) : (data.photos ? JSON.parse(data.photos) : []);
    db.run(
        `INSERT INTO promotions (company_name, logo, photos, description, type, wilaya, phone, email, website, promo_text, custom_field1, custom_field2, custom_field3, custom_field4, custom_field5, start_date, end_date, is_program, status, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.company_name, logo, JSON.stringify(photos), data.description, data.type || 'agence', data.wilaya, data.phone, data.email, data.website, data.promo_text,
         data.custom_field1 || null, data.custom_field2 || null, data.custom_field3 || null, data.custom_field4 || null, data.custom_field5 || null,
         data.start_date, data.end_date, data.is_program ? 1 : 0, data.status || 'active', data.featured ? 1 : 0],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Admin: update promotion
app.put('/api/promotions/:id', authMiddleware, adminMiddleware, uploadFields.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'photos', maxCount: 5 }
]), (req, res) => {
    const data = req.body;
    const logo = req.files && req.files['logo'] ? '/uploads/' + req.files['logo'][0].filename : (data.logo || null);
    let photos = [];
    if (req.files && req.files['photos']) {
        photos = req.files['photos'].map(f => '/uploads/' + f.filename);
    } else if (data.photos) {
        try { photos = JSON.parse(data.photos); } catch(e) { photos = []; }
    }
    db.run(
        `UPDATE promotions SET company_name=?, logo=?, photos=?, description=?, type=?, wilaya=?, phone=?, email=?, website=?, promo_text=?, custom_field1=?, custom_field2=?, custom_field3=?, custom_field4=?, custom_field5=?, start_date=?, end_date=?, is_program=?, status=?, featured=? WHERE id=?`,
        [data.company_name, logo, JSON.stringify(photos), data.description, data.type, data.wilaya, data.phone, data.email, data.website, data.promo_text,
         data.custom_field1 || null, data.custom_field2 || null, data.custom_field3 || null, data.custom_field4 || null, data.custom_field5 || null,
         data.start_date, data.end_date, data.is_program ? 1 : 0, data.status, data.featured ? 1 : 0, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

// Admin: delete promotion
app.delete('/api/promotions/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.run('DELETE FROM promotions WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// ========== AD BANNERS ROUTES ==========
// Public: list active banners
app.get('/api/banners/public', (req, res) => {
    db.all('SELECT * FROM ad_banners WHERE active = 1 ORDER BY position, created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin: list all banners
app.get('/api/banners', authMiddleware, adminMiddleware, (req, res) => {
    db.all('SELECT * FROM ad_banners ORDER BY position, created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin: get single banner
app.get('/api/banners/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.get('SELECT * FROM ad_banners WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Banniere non trouvee' });
        res.json(row);
    });
});

// Admin: create banner (with custom fields)
app.post('/api/banners', authMiddleware, adminMiddleware, upload.single('image'), (req, res) => {
    const data = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : (data.image || null);
    db.run(
        `INSERT INTO ad_banners (title, text, link, image, position, custom_field1, custom_field2, custom_field3, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.title, data.text, data.link, image, data.position || 'hero', data.custom_field1 || null, data.custom_field2 || null, data.custom_field3 || null, data.active !== undefined ? (data.active ? 1 : 0) : 1],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Admin: update banner
app.put('/api/banners/:id', authMiddleware, adminMiddleware, upload.single('image'), (req, res) => {
    const data = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : (data.image || null);
    db.run(
        `UPDATE ad_banners SET title=?, text=?, link=?, image=?, position=?, custom_field1=?, custom_field2=?, custom_field3=?, active=? WHERE id=?`,
        [data.title, data.text, data.link, image, data.position, data.custom_field1 || null, data.custom_field2 || null, data.custom_field3 || null, data.active !== undefined ? (data.active ? 1 : 0) : 1, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes });
        }
    );
});

// Admin: delete banner
app.delete('/api/banners/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.run('DELETE FROM ad_banners WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// ========== ADMIN: All properties ==========
app.get('/api/admin/properties', authMiddleware, adminMiddleware, async (req, res) => {
    try { res.json(await getAllPropertiesAdmin()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== ADMIN: Create property ==========
app.post('/api/admin/properties', authMiddleware, adminMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const images = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];
        const data = { ...req.body, user_id: req.userId, images };
        data.price = parseInt(data.price);
        data.surface = parseInt(data.surface) || 0;
        data.rooms = parseInt(data.rooms) || 0;
        data.bathrooms = parseInt(data.bathrooms) || 0;
        data.age = parseInt(data.age) || 0;
        data.status = data.status || 'active';
        data.featured = parseInt(data.featured) || 0;
        data.lat = data.lat ? parseFloat(data.lat) : null;
        data.lng = data.lng ? parseFloat(data.lng) : null;
        const id = await createProperty(data);
        res.json({ success: true, propertyId: id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== ADMIN: Update property (including featured) ==========
app.put('/api/admin/properties/:id', authMiddleware, adminMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        if (req.body.featured !== undefined && !req.body.title) {
            const val = parseInt(req.body.featured) ? 1 : 0;
            db.run('UPDATE properties SET featured = ? WHERE id = ?', [val, req.params.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, featured: val });
            });
        } else {
            const images = req.files && req.files.length ? req.files.map(f => '/uploads/' + f.filename) : (req.body.images ? JSON.parse(typeof req.body.images === 'string' ? req.body.images : JSON.stringify(req.body.images)) : []);
            const data = { ...req.body, images };
            data.featured = parseInt(data.featured) || 0;
            data.lat = data.lat ? parseFloat(data.lat) : null;
            data.lng = data.lng ? parseFloat(data.lng) : null;
            const changes = await updateProperty(req.params.id, data, req.userId, 'admin');
            res.json({ success: true, changes });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== ADMIN: Contacts management ==========
app.get('/api/admin/contacts', authMiddleware, adminMiddleware, (req, res) => {
    db.all('SELECT * FROM contacts ORDER BY created_at DESC', [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.delete('/api/admin/contacts/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.run('DELETE FROM contacts WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// ========== ADMIN CHECK (auth verification) ==========
app.get('/api/admin/check', authMiddleware, adminMiddleware, (req, res) => {
    res.json({ success: true, role: 'admin' });
});

// ========== ADMIN DASHBOARD (stats) ==========
app.get('/api/admin/dashboard', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const payStats = await getPaymentStats();
        const propCount = await new Promise((resolve) => {
            db.get('SELECT COUNT(*) as total, SUM(CASE WHEN status="active" THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status="pending" THEN 1 ELSE 0 END) as pending, SUM(views) as total_views FROM properties', [], (err, row) => resolve(row));
        });
        const userCount = await new Promise((resolve) => {
            db.get('SELECT COUNT(*) as total FROM users', [], (err, row) => resolve(row));
        });
        const contactCount = await new Promise((resolve) => {
            db.get('SELECT COUNT(*) as total FROM contacts', [], (err, row) => resolve(row));
        });
        const promoCount = await new Promise((resolve) => {
            db.get('SELECT COUNT(*) as total FROM promotions', [], (err, row) => resolve(row));
        });
        const bannerCount = await new Promise((resolve) => {
            db.get('SELECT COUNT(*) as total FROM ad_banners', [], (err, row) => resolve(row));
        });
        const estReqCount = await new Promise((resolve) => {
            db.get('SELECT COUNT(*) as total FROM estimation_requests', [], (err, row) => resolve(row));
        });
        const recentPayments = await new Promise((resolve) => {
            db.all('SELECT p.*, u.name as user_name FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 10', [], (err, rows) => resolve(rows || []));
        });
        const recentEstRequests = await new Promise((resolve) => {
            db.all('SELECT * FROM estimation_requests ORDER BY created_at DESC LIMIT 5', [], (err, rows) => resolve(rows || []));
        });
        res.json({
            payments: payStats,
            properties: propCount || {},
            users: userCount || {},
            contacts: contactCount || {},
            promotions: promoCount || {},
            banners: bannerCount || {},
            estimationRequests: estReqCount || {},
            recentPayments: recentPayments,
            recentEstRequests: recentEstRequests
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== ADMIN PAYMENT APPROVE (alias for confirm) ==========
app.post('/api/admin/payments/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const changes = await confirmPayment(req.params.id, 'confirmed');
        res.json({ success: true, changes });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== USER DASHBOARD ROUTES ==========
app.get('/api/user/properties', authMiddleware, async (req, res) => {
    try {
        db.all('SELECT * FROM properties WHERE user_id = ? ORDER BY created_at DESC', [req.userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            rows.forEach(r => { r.images = JSON.parse(r.images || '[]'); });
            res.json(rows);
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/user/payments', authMiddleware, async (req, res) => {
    try { res.json(await getPaymentsByUser(req.userId)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== i18n / TRANSLATIONS ==========
const translations = {
    fr: {
        nav_annonces: 'Annonces', nav_estimation: 'Estimation', nav_pros: 'Pros', nav_contact: 'Contact',
        nav_publier: 'Publier', nav_connexion: 'Connexion', nav_espace: 'Espace', nav_admin: 'Admin',
        hero_title: 'Trouvez votre bien immobilier en Algérie',
        hero_subtitle: 'La première plateforme immobilière 100% algérienne — Vente, Location, Estimation',
        search_type: 'Vente / Location', search_wilaya: 'Toutes wilayas', search_category: 'Catégorie',
        search_min: 'Prix min', search_max: 'Prix max', search_btn: 'Rechercher',
        steps_title: 'Comment ça marche ?', steps_subtitle: 'Publiez ou trouvez votre bien en quelques étapes',
        step1_title: '1. Publiez', step1_text: 'Remplissez le formulaire, ajoutez vos photos et soumettez votre annonce',
        step2_title: '2. Activez', step2_text: 'Activez votre annonce via BaridiMob pour la rendre visible',
        step3_title: '3. Trouvez', step3_text: 'Acheteurs et locataires vous contactent directement',
        commissions_title: 'Nos Tarifs', commissions_subtitle: 'Transparence totale sur nos prix',
        comm_pub: 'Publication', comm_pub_text: 'Frais de publication par annonce',
        comm_vente: 'Vente', comm_vente_text: 'Commission sur vente réussie',
        comm_location: 'Location', comm_location_text: 'Commission fixe sur location',
        properties_title: 'Annonces Immobilières', properties_subtitle: 'Découvrez les biens disponibles',
        estimation_title: 'Estimez votre bien', estimation_subtitle: 'Obtenez une estimation basée sur les prix du marché',
        estimation_btn: 'Estimer', estimation_detailed: 'Demande d\'estimation détaillée',
        gestion_title: 'Gestion Locative', gestion_subtitle: 'Confiez-nous la gestion de vos biens locatifs',
        contact_title: 'Contactez-nous', contact_subtitle: 'Une question ? Nous sommes là pour vous aider',
        footer_about: 'ImmoElite — Plateforme immobilière algérienne',
        btn_whatsapp: 'WhatsApp', btn_details: 'Détails',
        cat_appartement: 'Appartement', cat_villa: 'Villa', cat_terrain: 'Terrain', cat_commercial: 'Local commercial', cat_garage: 'Garage', cat_bureautique: 'Bureautique',
        type_vente: 'Vente', type_location: 'Location',
        lang_fr: 'Français', lang_ar: 'العربية', lang_en: 'English'
    },
    ar: {
        nav_annonces: 'الإعلانات', nav_estimation: 'التقييم', nav_pros: 'المحترفون', nav_contact: 'اتصل بنا',
        nav_publier: 'نشر', nav_connexion: 'تسجيل الدخول', nav_espace: 'فضاء', nav_admin: 'مدير',
        hero_title: 'اعثر على عقارك في الجزائر',
        hero_subtitle: 'المنصة العقارية الأولى 100% جزائرية — بيع، إيجار، تقييم',
        search_type: 'بيع / إيجار', search_wilaya: 'كل الولايات', search_category: 'الفئة',
        search_min: 'الحد الأدنى للسعر', search_max: 'الحد الأقصى للسعر', search_btn: 'بحث',
        steps_title: 'كيف يعمل؟', steps_subtitle: 'انشر أو ابحث عن عقارك',
        step1_title: '١. انشر', step1_text: 'املأ الاستمارة وأضف صورك',
        step2_title: '٢. فعّل', step2_text: 'فعّل إعلانك عبر بريدي موب',
        step3_title: '٣. ابحث', step3_text: 'يتصل بك المشترون مباشرة',
        commissions_title: 'أسعارنا', commissions_subtitle: 'شفافية كاملة',
        comm_pub: 'النشر', comm_pub_text: 'رسوم النشر لكل إعلان',
        comm_vente: 'البيع', comm_vente_text: 'عمولة عند البيع',
        comm_location: 'الإيجار', comm_location_text: 'عمولة ثابتة',
        properties_title: 'الإعلانات العقارية', properties_subtitle: 'اكتشف العقارات المتاحة',
        estimation_title: 'قيّم عقارك', estimation_subtitle: 'احصل على تقييم مبني على أسعار السوق',
        estimation_btn: 'تقييم', estimation_detailed: 'طلب تقييم مفصل',
        gestion_title: 'إدارة الإيجارات', gestion_subtitle: 'فوّضنا إدارة عقاراتك المؤجرة',
        contact_title: 'اتصل بنا', contact_subtitle: 'سؤال؟ نحن هنا لمساعدتك',
        footer_about: 'إيمو إيليت — منصة عقارية جزائرية',
        btn_whatsapp: 'واتساب', btn_details: 'التفاصيل',
        cat_appartement: 'شقة', cat_villa: 'فيلا', cat_terrain: 'أرض', cat_commercial: 'محل تجاري', cat_garage: 'مرآب', cat_bureautique: 'مكتبي',
        type_vente: 'بيع', type_location: 'إيجار',
        lang_fr: 'Français', lang_ar: 'العربية', lang_en: 'English'
    },
    en: {
        nav_annonces: 'Listings', nav_estimation: 'Estimation', nav_pros: 'Pros', nav_contact: 'Contact',
        nav_publier: 'Publish', nav_connexion: 'Login', nav_espace: 'Dashboard', nav_admin: 'Admin',
        hero_title: 'Find your property in Algeria',
        hero_subtitle: 'The first 100% Algerian real estate platform — Sale, Rental, Estimation',
        search_type: 'Sale / Rental', search_wilaya: 'All wilayas', search_category: 'Category',
        search_min: 'Min price', search_max: 'Max price', search_btn: 'Search',
        steps_title: 'How it works', steps_subtitle: 'Publish or find your property in a few steps',
        step1_title: '1. Publish', step1_text: 'Fill the form, add your photos and submit your listing',
        step2_title: '2. Activate', step2_text: 'Activate your listing via BaridiMob to make it visible',
        step3_title: '3. Find', step3_text: 'Buyers and tenants contact you directly',
        commissions_title: 'Our Pricing', commissions_subtitle: 'Full transparency on our rates',
        comm_pub: 'Publication', comm_pub_text: 'Publication fee per listing',
        comm_vente: 'Sale', comm_vente_text: 'Commission on successful sale',
        comm_location: 'Rental', comm_location_text: 'Flat fee on rental',
        properties_title: 'Real Estate Listings', properties_subtitle: 'Discover available properties',
        estimation_title: 'Estimate your property', estimation_subtitle: 'Get a market-based estimation',
        estimation_btn: 'Estimate', estimation_detailed: 'Detailed estimation request',
        gestion_title: 'Rental Management', gestion_subtitle: 'Let us manage your rental properties',
        contact_title: 'Contact us', contact_subtitle: 'A question? We are here to help',
        footer_about: 'ImmoElite — Algerian real estate platform',
        btn_whatsapp: 'WhatsApp', btn_details: 'Details',
        cat_appartement: 'Apartment', cat_villa: 'Villa', cat_terrain: 'Land', cat_commercial: 'Commercial', cat_garage: 'Garage', cat_bureautique: 'Office',
        type_vente: 'Sale', type_location: 'Rental',
        lang_fr: 'Français', lang_ar: 'العربية', lang_en: 'English'
    }
};

app.get('/api/i18n/:lang', (req, res) => {
    const lang = req.params.lang;
    if (translations[lang]) res.json(translations[lang]);
    else res.json(translations.fr);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('ImmoElite server running on port ' + PORT));