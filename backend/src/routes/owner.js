const express = require('express');
const { all, get, run } = require('../db/connection');
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

// ── Messages juridiques (proprietaire → cabinet) ────────────────────────────
router.get('/legal-messages', async (req, res) => {
    try {
        const messages = await all(
            `SELECT lm.*, lr.review_type, lr.status as review_status
             FROM legal_messages lm
             LEFT JOIN legal_reviews lr ON lm.review_id = lr.id
             WHERE (lm.sender_type = 'owner' AND lm.sender_id = ?)
                OR (lm.recipient_type = 'owner' AND lm.recipient_id = ?)
             ORDER BY lm.created_at DESC`,
            [req.user.id, req.user.id]
        );
        res.json({ messages });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/legal-messages', async (req, res) => {
    try {
        const { subject, body, review_id } = req.body;
        if (!body || body.trim().length === 0) {
            return res.status(400).json({ error: 'Le message ne peut pas etre vide' });
        }
        // Find the law firm handling this owner's reviews
        const firm = await get(
            `SELECT lf.id as firm_id, lf.user_id as firm_user_id FROM law_firms lf
             JOIN legal_reviews lr ON lr.firm_id = lf.id
             WHERE lr.user_id = ? AND lf.is_active = 1
             LIMIT 1`,
            [req.user.id]
        );
        // If no firm found via reviews, get any active firm
        const targetFirm = firm || await get('SELECT id as firm_id, user_id as firm_user_id FROM law_firms WHERE is_active = 1 LIMIT 1');
        if (!targetFirm) {
            return res.status(404).json({ error: 'Aucun cabinet juridique disponible' });
        }
        const result = await run(
            `INSERT INTO legal_messages(firm_id, review_id, sender_type, sender_id, recipient_type, recipient_id, subject, body, is_read)
             VALUES (?, ?, 'owner', ?, 'firm', ?, ?, ?, 0)`,
            [targetFirm.firm_id, review_id || null, req.user.id, targetFirm.firm_user_id, subject || 'Message proprietaire', body.trim()]
        );
        res.status(201).json({ success: true, message_id: result.id });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ── Documents juridiques partagés avec le proprietaire ──────────────────────
router.get('/legal-documents', async (req, res) => {
    try {
        const docs = await all(
            `SELECT ld.id, ld.document_type, ld.file_name, ld.file_url, ld.status, ld.version, ld.created_at
             FROM legal_documents ld
             WHERE ld.user_id = ? AND ld.status != 'draft'
             ORDER BY ld.created_at DESC`,
            [req.user.id]
        );
        res.json({ documents: docs });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
