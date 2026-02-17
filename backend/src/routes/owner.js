const express = require('express');
const { all, run } = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parsePositiveInt, sanitizeOptionalText, sanitizeText } = require('../utils/validation');

const router = express.Router();

router.use(requireAuth, requireRole(['owner', 'admin']));

router.get('/dashboard', async (req, res) => {
    try {
        const ownerId = req.user.id;

        const properties = await all(
            `SELECT id, property_title, location, size_m2, expected_price, preferred_payment_mode, payment_calendar, status, created_at
             FROM owner_properties
             WHERE owner_id = ?
             ORDER BY id DESC`,
            [ownerId]
        );

        const propertyIds = properties.map((p) => p.id);
        let payments = [];
        if (propertyIds.length > 0) {
            const placeholders = propertyIds.map(() => '?').join(',');
            payments = await all(
                `SELECT id, owner_property_id, amount, method, paid_at, status, reference
                 FROM payments
                 WHERE owner_property_id IN (${placeholders})
                 ORDER BY paid_at DESC`,
                propertyIds
            );
        }

        return res.json({ profile: req.user, properties, payments });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur dashboard proprietaire' });
    }
});

router.post('/properties', async (req, res) => {
    try {
        const {
            property_title,
            location,
            size_m2,
            expected_price,
            preferred_payment_mode,
            payment_calendar
        } = req.body;

        const safeTitle = sanitizeText(property_title, 120);
        const safeLocation = sanitizeText(location, 120);
        const safeMode = sanitizeOptionalText(preferred_payment_mode, 40);
        const safeCalendar = sanitizeOptionalText(payment_calendar, 40);
        const safeSize = size_m2 ? parsePositiveInt(size_m2) : null;
        const safePrice = expected_price ? parsePositiveInt(expected_price) : null;

        if (!safeTitle || !safeLocation) {
            return res.status(400).json({ error: 'property_title et location requis' });
        }

        const result = await run(
            `INSERT INTO owner_properties(owner_id, property_title, location, size_m2, expected_price, preferred_payment_mode, payment_calendar)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                safeTitle,
                safeLocation,
                safeSize,
                safePrice,
                safeMode,
                safeCalendar
            ]
        );

        await req.audit?.('owner.property_created', { owner_id: req.user.id, property_id: result.id });
        return res.status(201).json({ id: result.id });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur creation bien proprietaire' });
    }
});

module.exports = router;
