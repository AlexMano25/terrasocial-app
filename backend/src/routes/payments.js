const express = require('express');
const crypto = require('crypto');
const { all, run } = require('../db/connection');
const { recomputeReliabilityScore } = require('../services/reliability');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parsePositiveInt, sanitizeText } = require('../utils/validation');

const router = express.Router();

router.use(requireAuth, requireRole(['client', 'owner', 'admin']));

router.get('/', async (req, res) => {
    try {
        const rows = await all(
            `SELECT id, reservation_id, owner_property_id, amount, method, due_date, paid_at, status, reference
             FROM payments
             WHERE user_id = ?
             ORDER BY paid_at DESC`,
            [req.user.id]
        );
        return res.json({ payments: rows });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture paiements' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { reservation_id, owner_property_id, amount, method, due_date, status } = req.body;
        const safeAmount = parsePositiveInt(amount);
        const safeMethod = sanitizeText(method, 40);
        const safeStatus = sanitizeText(status || 'paid', 20);

        if (!safeAmount || !safeMethod) {
            return res.status(400).json({ error: 'amount et method requis' });
        }

        if (!['paid', 'late', 'pending'].includes(safeStatus)) {
            return res.status(400).json({ error: 'Statut de paiement invalide' });
        }

        const reference = `TRX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const result = await run(
            `INSERT INTO payments(user_id, reservation_id, owner_property_id, amount, method, due_date, status, reference)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                reservation_id || null,
                owner_property_id || null,
                safeAmount,
                safeMethod,
                due_date || null,
                safeStatus,
                reference
            ]
        );

        const score = await recomputeReliabilityScore(req.user.id);
        await req.audit?.('payment.created', { user_id: req.user.id, payment_id: result.id, amount: safeAmount, status: safeStatus });
        return res.status(201).json({ id: result.id, reference, reliability_score: score });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur creation paiement' });
    }
});

module.exports = router;
