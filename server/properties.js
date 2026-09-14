const db = require('./db');

function createProperty(data) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO properties (user_id, type, category, title, description, price, wilaya, commune, address, surface, rooms, bathrooms, parking, condition, age, images, contact_phone, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.user_id, data.type, data.category, data.title, data.description, data.price,
             data.wilaya, data.commune, data.address, data.surface, data.rooms, data.bathrooms,
             data.parking, data.condition, data.age, JSON.stringify(data.images || []), data.contact_phone || null, 'pending'],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function getProperties(filters = {}) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT p.*, u.name as owner_name, u.phone as owner_phone, COALESCE(p.contact_phone, u.phone) as display_phone FROM properties p JOIN users u ON p.user_id = u.id WHERE p.status = ?';
        let params = ['active'];

        if (filters.type) { query += ' AND p.type = ?'; params.push(filters.type); }
        if (filters.wilaya) { query += ' AND p.wilaya = ?'; params.push(filters.wilaya); }
        if (filters.category) { query += ' AND p.category = ?'; params.push(filters.category); }
        if (filters.min_price) { query += ' AND p.price >= ?'; params.push(filters.min_price); }
        if (filters.max_price) { query += ' AND p.price <= ?'; params.push(filters.max_price); }
        if (filters.min_surface) { query += ' AND p.surface >= ?'; params.push(filters.min_surface); }
        if (filters.rooms) { query += ' AND p.rooms >= ?'; params.push(filters.rooms); }

        query += ' ORDER BY p.featured DESC, p.created_at DESC';
        if (filters.limit) { query += ' LIMIT ?'; params.push(filters.limit); }
        if (filters.offset) { query += ' OFFSET ?'; params.push(filters.offset); }

        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else {
                rows.forEach(r => { r.images = JSON.parse(r.images || '[]'); });
                resolve(rows);
            }
        });
    });
}

function getPropertyById(id) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT p.*, u.name as owner_name, u.phone as owner_phone, u.email as owner_email, COALESCE(p.contact_phone, u.phone) as display_phone FROM properties p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
            [id],
            (err, row) => {
                if (err) reject(err);
                else if (row) row.images = JSON.parse(row.images || '[]');
                resolve(row);
            }
        );
    });
}

function updateProperty(id, data, userId, role) {
    return new Promise((resolve, reject) => {
        let query, params;
        if (role === 'admin') {
            query = `UPDATE properties SET type=?, category=?, title=?, description=?, price=?, wilaya=?, commune=?, address=?, surface=?, rooms=?, bathrooms=?, parking=?, condition=?, age=?, images=?, contact_phone=?, status=?, featured=? WHERE id=?`;
            params = [data.type, data.category, data.title, data.description, data.price,
                      data.wilaya, data.commune, data.address, data.surface, data.rooms, data.bathrooms,
                      data.parking, data.condition, data.age, JSON.stringify(data.images || []),
                      data.contact_phone || null, data.status || 'active', data.featured ? 1 : 0, id];
        } else {
            query = `UPDATE properties SET type=?, category=?, title=?, description=?, price=?, wilaya=?, commune=?, address=?, surface=?, rooms=?, bathrooms=?, parking=?, condition=?, age=?, images=? WHERE id=? AND user_id=?`;
            params = [data.type, data.category, data.title, data.description, data.price,
                      data.wilaya, data.commune, data.address, data.surface, data.rooms, data.bathrooms,
                      data.parking, data.condition, data.age, JSON.stringify(data.images || []), id, userId];
        }
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function deleteProperty(id, userId, role) {
    return new Promise((resolve, reject) => {
        const query = role === 'admin'
            ? 'DELETE FROM properties WHERE id = ?'
            : 'DELETE FROM properties WHERE id = ? AND user_id = ?';
        const params = role === 'admin' ? [id] : [id, userId];
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function incrementViews(id) {
    db.run('UPDATE properties SET views = views + 1 WHERE id = ?', [id]);
}

function getAllPropertiesAdmin() {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT p.*, u.name as owner_name, u.phone as owner_phone, COALESCE(p.contact_phone, u.phone) as display_phone FROM properties p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC',
            [],
            (err, rows) => {
                if (err) reject(err);
                else {
                    rows.forEach(r => { r.images = JSON.parse(r.images || '[]'); });
                    resolve(rows);
                }
            }
        );
    });
}

module.exports = { createProperty, getProperties, getPropertyById, updateProperty, deleteProperty, incrementViews, getAllPropertiesAdmin };