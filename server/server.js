const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { authMiddleware, adminMiddleware, register, login, getProfile, updateProfile } = require('./auth');
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
    else cb(new Error('Seules les images sont autoris\u00e9es'));
}});

// ========== AUTH ROUTES ==========
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        if (!name || !email || !phone || !password) return res.status(400).json({ error: 'Tous les champs sont requis' });
        const id = await register(name, email, phone, password);
        res.json({ success: true, userId: id });
    } catch (e) { res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Email d\u00e9j\u00e0 utilis\u00e9' : e.message }); }
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
        if (!prop) return res.status(404).json({ error: 'Annonce non trouv\u00e9e' });
        incrementViews(req.params.id);
        res.json(prop);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/properties', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const images = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];
        const data = { ...req.body, user_id: req.userId, images };
        data.price = parseInt(data.price);
        // If user chose platform phone, get admin_whatsapp from settings
        if (data.contact_phone === 'platform') {
            const s = await new Promise(r => db.get("SELECT value FROM settings WHERE key = 'admin_whatsapp'", [], (e, row) => r(row)));
            data.contact_phone = s?.value ? '0' + s.value.replace(/^213/, '') : null;
        } else if (data.contact_phone === 'mine') {
            const u = await new Promise(r => db.get('SELECT phone FROM users WHERE id = ?', [req.userId], (e, row) => r(row)));
            data.contact_phone = u?.phone || null;
        }
        data.surface = parseInt(data.surface);
        data.rooms = parseInt(data.rooms) || 0;
        data.bathrooms = parseInt(data.bathrooms) || 0;
        data.age = parseInt(data.age) || 0;
        const id = await createProperty(data);
        // Create publication payment
        const setting = await new Promise((resolve) => {
            db.get("SELECT value FROM settings WHERE key = 'frais_publication'", [], (err, row) => resolve(row));
        });
        const frais = parseInt(setting?.value || '1000');
        await createPayment({ user_id: req.userId, property_id: id, amount: frais, type: 'publication', status: 'pending', notes: 'Frais de publication' });
        res.json({ success: true, propertyId: id, fraisPublication: frais });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/properties/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const images = req.files && req.files.length ? req.files.map(f => '/uploads/' + f.filename) : (req.body.images ? JSON.parse(typeof req.body.images === 'string' ? req.body.images : JSON.stringify(req.body.images)) : []);
        const data = { ...req.body, images };
        // Admin can change owner_phone
        if (req.userRole === 'admin' && req.body.owner_phone) {
            // Update the property owner's phone
            db.run('UPDATE users SET phone = ? WHERE id = (SELECT user_id FROM properties WHERE id = ?)', [req.body.owner_phone, req.params.id]);
        }
        // Admin can also set contact_phone directly
        if (req.userRole === 'admin' && req.body.contact_phone) {
            data.contact_phone = req.body.contact_phone;
        }
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

// ========== ADMIN: All properties ==========
app.get('/api/admin/properties', authMiddleware, adminMiddleware, async (req, res) => {
    try { res.json(await getAllPropertiesAdmin()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== ADMIN: Users management ==========
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    db.all('SELECT id, name, email, phone, role, baridimob_rip, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/admin/users/:id/role', authMiddleware, adminMiddleware, (req, res) => {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'R\u00f4le invalide' });
    db.run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    const id = req.params.id;
    // First delete user's properties and payments
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

// ========== ADMIN: Create property ==========
app.post('/api/admin/properties', authMiddleware, adminMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const images = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];
        const data = { ...req.body, user_id: req.userId, images };
        data.price = parseInt(data.price);
        data.surface = parseInt(data.surface);
        data.rooms = parseInt(data.rooms) || 0;
        data.bathrooms = parseInt(data.bathrooms) || 0;
        data.age = parseInt(data.age) || 0;
        // Admin-created properties are active by default
        data.status = data.status || 'active';
        data.featured = parseInt(data.featured) || 0;
        const id = await createProperty(data);
        res.json({ success: true, propertyId: id });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('ImmoElite server running on port ' + PORT));