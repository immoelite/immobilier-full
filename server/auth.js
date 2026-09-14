const db = require('./db');
const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('md5').update(password).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Simple token store (in production use JWT or Redis)
const activeTokens = {};

function authMiddleware(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token || !activeTokens[token]) {
        return res.status(401).json({ error: 'Non autoris\u00e9' });
    }
    req.userId = activeTokens[token].userId;
    req.userRole = activeTokens[token].role;
    next();
}

function adminMiddleware(req, res, next) {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Acc\u00e8s refus\u00e9' });
    }
    next();
}

function register(name, email, phone, password) {
    return new Promise((resolve, reject) => {
        const hashed = hashPassword(password);
        db.run(
            'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)',
            [name, email, phone, hashed],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function login(email, password) {
    return new Promise((resolve, reject) => {
        const hashed = hashPassword(password);
        db.get(
            'SELECT id, name, email, phone, role, baridimob_rip FROM users WHERE email = ? AND password = ?',
            [email, hashed],
            (err, row) => {
                if (err) reject(err);
                else if (!row) reject(new Error('Email ou mot de passe incorrect'));
                else {
                    const token = generateToken();
                    activeTokens[token] = { userId: row.id, role: row.role };
                    resolve({ token, user: row });
                }
            }
        );
    });
}

function getProfile(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT id, name, email, phone, role, baridimob_rip, created_at FROM users WHERE id = ?',
            [userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

function updateProfile(userId, data) {
    return new Promise((resolve, reject) => {
        const fields = [];
        const values = [];
        if (data.name) { fields.push('name = ?'); values.push(data.name); }
        if (data.phone) { fields.push('phone = ?'); values.push(data.phone); }
        if (data.baridimob_rip) { fields.push('baridimob_rip = ?'); values.push(data.baridimob_rip); }
        if (data.password) { fields.push('password = ?'); values.push(hashPassword(data.password)); }
        values.push(userId);
        db.run(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values,
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

module.exports = { authMiddleware, adminMiddleware, register, login, getProfile, updateProfile, activeTokens };