const db = require('./db');

function createPayment(data) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO payments (user_id, property_id, amount, type, status, reference, client_rip, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [data.user_id, data.property_id, data.amount, data.type, data.status || 'pending', data.reference, data.client_rip || null, data.notes],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function confirmPayment(id, status) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE payments SET status = ? WHERE id = ?',
            [status, id],
            function(err) {
                if (err) reject(err);
                else {
                    // If publication payment confirmed, activate the property
                    if (status === 'confirmed') {
                        db.get('SELECT property_id, type FROM payments WHERE id = ?', [id], (err, row) => {
                            if (row && row.property_id && row.type === 'publication') {
                                db.run('UPDATE properties SET status = ? WHERE id = ?', ['active', row.property_id]);
                            }
                        });
                    }
                    resolve(this.changes);
                }
            }
        );
    });
}

function getPaymentsByUser(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT p.*, pr.title as property_title FROM payments p LEFT JOIN properties pr ON p.property_id = pr.id WHERE p.user_id = ? ORDER BY p.created_at DESC',
            [userId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

function getAllPayments() {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT p.*, u.name as user_name, u.phone as user_phone, pr.title as property_title FROM payments p JOIN users u ON p.user_id = u.id LEFT JOIN properties pr ON p.property_id = pr.id ORDER BY p.created_at DESC',
            [],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

function getPaymentStats() {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT 
                COUNT(*) as total_payments,
                SUM(CASE WHEN status='confirmed' THEN amount ELSE 0 END) as total_revenue,
                SUM(CASE WHEN type='publication' AND status='confirmed' THEN 1 ELSE 0 END) as publications_confirmed,
                SUM(CASE WHEN type='commission_vente' AND status='confirmed' THEN amount ELSE 0 END) as commission_vente_total,
                SUM(CASE WHEN type='commission_location' AND status='confirmed' THEN amount ELSE 0 END) as commission_location_total,
                SUM(CASE WHEN type='publication' AND status='confirmed' THEN amount ELSE 0 END) as publication_revenue
            FROM payments`,
            [],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

module.exports = { createPayment, confirmPayment, getPaymentsByUser, getAllPayments, getPaymentStats };