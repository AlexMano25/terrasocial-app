const express = require('express');
const { all, get, run } = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateReservationPayload } = require('../utils/validation');

const router = express.Router();

router.use(requireAuth, requireRole(['client', 'admin']));

router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user.id;

        const reservations = await all(
            `SELECT id, lot_type, lot_price, duration_months, deposit_amount, monthly_amount, status, created_at
             FROM reservations
             WHERE user_id = ?
             ORDER BY id DESC`,
            [userId]
        );

        const payments = await all(
            `SELECT id, reservation_id, amount, method, due_date, paid_at, status, reference
             FROM payments
             WHERE user_id = ?
             ORDER BY paid_at DESC`,
            [userId]
        );

        const contracts = await all(
            `SELECT id, contract_number, contract_type, status, signed_at, file_url
             FROM contracts
             WHERE user_id = ?
             ORDER BY id DESC`,
            [userId]
        );

        const possession = await all(
            `SELECT id, pv_number, status, issued_at, file_url
             FROM possession_records
             WHERE user_id = ?
             ORDER BY id DESC`,
            [userId]
        );

        const paidTotalRow = await get(
            'SELECT COALESCE(SUM(amount), 0) AS paid_total FROM payments WHERE user_id = ? AND status = ?',
            [userId, 'paid']
        );

        const latestReservation = reservations[0];
        const commitmentTotal = latestReservation ? latestReservation.lot_price : 0;
        const paidTotal = paidTotalRow?.paid_total || 0;
        const remaining = Math.max(0, commitmentTotal - paidTotal);

        return res.json({
            profile: req.user,
            metrics: {
                commitment_total: commitmentTotal,
                paid_total: paidTotal,
                remaining_total: remaining,
                reliability_score: req.user.reliability_score
            },
            reservations,
            payments,
            contracts,
            possession
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur dashboard client' });
    }
});

router.post('/reservations', async (req, res) => {
    try {
        const validation = validateReservationPayload(req.body || {});
        if (!validation.ok) {
            return res.status(400).json({ error: validation.error });
        }

        const { lot_type, lot_price, duration_months, source } = validation.data;
        const price = lot_price;
        const duration = duration_months;
        const deposit = Math.ceil(price * 0.1);
        const monthly = Math.ceil((price - deposit) / duration);

        const result = await run(
            `INSERT INTO reservations(user_id, lot_type, lot_price, duration_months, deposit_amount, monthly_amount, source)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, lot_type, price, duration, deposit, monthly, source || null]
        );

        await req.audit?.('client.reservation_created', { user_id: req.user.id, reservation_id: result.id });

        return res.status(201).json({
            id: result.id,
            lot_type,
            lot_price: price,
            duration_months: duration,
            deposit_amount: deposit,
            monthly_amount: monthly
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur creation reservation' });
    }
});

module.exports = router;
