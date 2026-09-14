const db = require('./db');

// Average price per m2 by wilaya (DZD) - realistic estimates for Algeria
const basePrices = {
    'Alger': { appartement: 280000, villa: 220000, terrain: 85000, commercial: 350000 },
    'Oran': { appartement: 210000, villa: 180000, terrain: 65000, commercial: 270000 },
    'Constantine': { appartement: 170000, villa: 145000, terrain: 50000, commercial: 220000 },
    'Annaba': { appartement: 155000, villa: 130000, terrain: 45000, commercial: 200000 },
    'Setif': { appartement: 140000, villa: 115000, terrain: 40000, commercial: 180000 },
    'Blida': { appartement: 195000, villa: 160000, terrain: 60000, commercial: 240000 },
    'Tizi Ouzou': { appartement: 160000, villa: 135000, terrain: 45000, commercial: 195000 },
    'Batna': { appartement: 110000, villa: 95000, terrain: 30000, commercial: 145000 },
    'Bejaia': { appartement: 150000, villa: 125000, terrain: 42000, commercial: 190000 },
    'Djelfa': { appartement: 95000, villa: 80000, terrain: 25000, commercial: 120000 },
};

function calculateEstimation(wilaya, category, surface, condition, age, parking) {
    const base = basePrices[wilaya]?.[category] || 120000;
    let pricePerM2 = base;

    // Condition adjustment
    if (condition === 'excellent') pricePerM2 *= 1.15;
    else if (condition === 'neuf') pricePerM2 *= 1.25;
    else if (condition === 'renover') pricePerM2 *= 0.85;
    else if (condition === 'mauvais') pricePerM2 *= 0.70;

    // Age adjustment
    if (age > 0 && age <= 5) pricePerM2 *= 0.95;
    else if (age > 5 && age <= 15) pricePerM2 *= 0.88;
    else if (age > 15 && age <= 25) pricePerM2 *= 0.78;
    else if (age > 25) pricePerM2 *= 0.68;

    // Parking
    if (parking === 'oui') pricePerM2 *= 1.08;

    const total = Math.round(pricePerM2 * surface);
    return { pricePerM2: Math.round(pricePerM2), total, base };
}

function saveEstimation(userId, data) {
    return new Promise((resolve, reject) => {
        const result = calculateEstimation(data.wilaya, data.category, data.surface, data.condition, data.age, data.parking);
        db.run(
            'INSERT INTO estimations (user_id, wilaya, category, surface, condition_val, age, parking, estimated_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, data.wilaya, data.category, data.surface, data.condition, data.age, data.parking, result.total],
            function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, ...result });
            }
        );
    });
}

function getEstimations(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM estimations WHERE user_id = ? ORDER BY created_at DESC',
            [userId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

module.exports = { calculateEstimation, saveEstimation, getEstimations, basePrices };