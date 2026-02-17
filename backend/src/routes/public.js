const express = require('express');
const { run } = require('../db/connection');
const {
    isValidPhone,
    normalizeEmail,
    sanitizeOptionalText,
    sanitizeText,
    validateReservationPayload
} = require('../utils/validation');

const router = express.Router();

router.post('/reservations', async (req, res) => {
    try {
        const { full_name, phone, email, city, lot_type, lot_price, duration_months, source } = req.body;
        const safeName = sanitizeText(full_name, 120);
        const safePhone = sanitizeText(phone, 30);
        const safeEmail = normalizeEmail(email);
        const safeCity = sanitizeOptionalText(city, 80);
        const validation = validateReservationPayload({ lot_type, lot_price, duration_months, source });

        if (!safeName || !safePhone || !validation.ok) {
            return res.status(400).json({ error: 'Informations de reservation incompletes' });
        }

        if (!isValidPhone(safePhone)) {
            return res.status(400).json({ error: 'Numéro de téléphone invalide' });
        }

        const { lot_type: lotType, lot_price: price, duration_months: duration, source: safeSource } = validation.data;
        const deposit = Math.ceil(price * 0.1);
        const monthly = Math.ceil((price - deposit) / duration);

        await run(
            `INSERT INTO reservations(user_id, lot_type, lot_price, duration_months, deposit_amount, monthly_amount, source, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [null, lotType, price, duration, deposit, monthly, safeSource || 'site', 'lead']
        );

        await req.audit?.('public.reservation_lead_created', { lot_type: lotType, lot_price: price });
        return res.status(201).json({
            message: 'Demande recue. Un conseiller vous contactera rapidement.',
            contact: { full_name: safeName, phone: safePhone, email: safeEmail || null, city: safeCity || null }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur creation demande publique' });
    }
});

module.exports = router;
