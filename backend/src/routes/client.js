const express = require('express');
const { all, get, run } = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateReservationPayload } = require('../utils/validation');

const router = express.Router();

router.use(requireAuth, requireRole(['client', 'admin']));

// ── Helpers échéancier ─────────────────────────────────────────────────────
function buildPaymentSchedule(reservation, payments) {
    const schedule = [];
    const startDate = new Date(reservation.created_at);
    const paidPayments = payments.filter((p) => p.status === 'paid');
    let totalPaid = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
    const monthly = Number(reservation.monthly_amount) || 0;
    const totalDue = Number(reservation.lot_price) || 0;
    const now = new Date();

    for (let i = 0; i < reservation.duration_months; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i + 1);
        const dueDateStr = dueDate.toISOString().slice(0, 10);

        const amountDue = Math.min(monthly, totalDue - (monthly * i));
        const allocated = Math.min(monthly, Math.max(0, totalPaid));
        totalPaid -= allocated;

        let status = 'pending';
        if (allocated >= amountDue) {
            status = 'paid';
        } else if (dueDate < now && allocated < amountDue) {
            status = 'late';
        }

        schedule.push({
            month: i + 1,
            due_date: dueDateStr,
            amount_due: amountDue,
            amount_paid: allocated,
            remaining: Math.max(0, amountDue - allocated),
            status
        });
    }
    return schedule;
}

function computeReservationSummary(reservation, payments) {
    const paidPayments = payments.filter((p) => p.status === 'paid');
    const paidTotal = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalDue = Number(reservation.lot_price) || 0;
    const remaining = Math.max(0, totalDue - paidTotal);
    const monthly = Number(reservation.monthly_amount) || 0;
    const schedule = buildPaymentSchedule(reservation, payments);
    const lateMonths = schedule.filter((m) => m.status === 'late');
    const lateAmount = lateMonths.reduce((s, m) => s + m.remaining, 0);
    const progressPercent = totalDue > 0 ? Math.round((paidTotal / totalDue) * 100) : 0;
    const canGetPossession = progressPercent >= 50;

    return {
        reservation_id: reservation.id,
        lot_type: reservation.lot_type,
        lot_price: totalDue,
        duration_months: reservation.duration_months,
        monthly_amount: monthly,
        deposit_amount: reservation.deposit_amount,
        status: reservation.status,
        created_at: reservation.created_at,
        paid_total: paidTotal,
        remaining_total: remaining,
        progress_percent: progressPercent,
        can_get_possession: canGetPossession,
        late_months_count: lateMonths.length,
        late_amount: lateAmount,
        schedule
    };
}

// ── Dashboard enrichi ──────────────────────────────────────────────────────
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

        // Résumés par réservation
        const reservationSummaries = reservations.map((r) => {
            const resPayments = payments.filter(
                (p) => p.reservation_id === r.id || (!p.reservation_id && reservations.length === 1)
            );
            return computeReservationSummary(r, resPayments);
        });

        // Totaux globaux
        const commitmentTotal = reservations.reduce((s, r) => s + Number(r.lot_price), 0);
        const paidTotalRow = await get(
            'SELECT COALESCE(SUM(amount), 0) AS paid_total FROM payments WHERE user_id = ? AND status = ?',
            [userId, 'paid']
        );
        const paidTotal = Number(paidTotalRow?.paid_total || 0);
        const remainingTotal = Math.max(0, commitmentTotal - paidTotal);
        const totalLateAmount = reservationSummaries.reduce((s, r) => s + r.late_amount, 0);
        const totalLateMonths = reservationSummaries.reduce((s, r) => s + r.late_months_count, 0);

        // Mensualité minimum pour le versement (basée sur la réservation active)
        const activeReservation = reservations.find((r) => r.status !== 'cancelled') || reservations[0];
        const minPaymentAmount = activeReservation ? Number(activeReservation.monthly_amount) : 0;

        return res.json({
            profile: req.user,
            metrics: {
                commitment_total: commitmentTotal,
                paid_total: paidTotal,
                remaining_total: remainingTotal,
                reliability_score: req.user.reliability_score,
                late_amount: totalLateAmount,
                late_months_count: totalLateMonths,
                min_payment_amount: minPaymentAmount
            },
            reservations: reservationSummaries,
            payments,
            contracts,
            possession
        });
    } catch (error) {
        console.error('Dashboard client error:', error);
        return res.status(500).json({ error: 'Erreur dashboard client' });
    }
});

// ── Effectuer un versement ─────────────────────────────────────────────────
router.post('/versement', async (req, res) => {
    try {
        const userId = req.user.id;
        const { reservation_id, amount, method } = req.body;
        const safeAmount = Number(amount);
        const validMethods = ['orange_money', 'mtn_momo', 'virement', 'carte'];

        if (!method || !validMethods.includes(method)) {
            return res.status(400).json({ error: 'Mode de paiement invalide' });
        }

        // Trouver la réservation
        let reservation;
        if (reservation_id) {
            reservation = await get(
                'SELECT * FROM reservations WHERE id = ? AND user_id = ?',
                [reservation_id, userId]
            );
        } else {
            reservation = await get(
                'SELECT * FROM reservations WHERE user_id = ? AND status != ? ORDER BY id DESC LIMIT 1',
                [userId, 'cancelled']
            );
        }

        if (!reservation) {
            return res.status(400).json({ error: 'Aucune réservation active trouvée' });
        }

        const minAmount = Number(reservation.monthly_amount) || 0;
        if (!safeAmount || safeAmount < minAmount) {
            return res.status(400).json({
                error: `Le montant minimum est de ${minAmount.toLocaleString('fr-FR')} FCFA (mensualité)`,
                min_amount: minAmount
            });
        }

        // Vérifier qu'on ne dépasse pas le reste à payer
        const paidRow = await get(
            'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE user_id = ? AND reservation_id = ? AND status = ?',
            [userId, reservation.id, 'paid']
        );
        const alreadyPaid = Number(paidRow?.paid || 0);
        const remaining = Math.max(0, Number(reservation.lot_price) - alreadyPaid);

        if (safeAmount > remaining) {
            return res.status(400).json({
                error: `Le montant dépasse le reste à payer (${remaining.toLocaleString('fr-FR')} FCFA)`,
                remaining
            });
        }

        const crypto = require('crypto');
        const reference = `TRX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        const result = await run(
            `INSERT INTO payments(user_id, reservation_id, amount, method, due_date, status, reference)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, reservation.id, safeAmount, method, new Date().toISOString().slice(0, 10), 'paid', reference]
        );

        // Recalculer le score de fiabilité
        const { recomputeReliabilityScore } = require('../services/reliability');
        const score = await recomputeReliabilityScore(userId);

        await req.audit?.('client.versement', {
            user_id: userId,
            reservation_id: reservation.id,
            payment_id: result.id,
            amount: safeAmount,
            method
        });

        return res.status(201).json({
            id: result.id,
            reference,
            amount: safeAmount,
            method,
            reservation_id: reservation.id,
            reliability_score: score
        });
    } catch (error) {
        console.error('Versement error:', error);
        return res.status(500).json({ error: 'Erreur lors du versement' });
    }
});

// ── Création de réservation ────────────────────────────────────────────────
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

// ── Police d'assurance (génération PDF) ────────────────────────────────────
router.get('/insurance-policy', async (req, res) => {
    try {
        const userId = req.user.id;

        const reservation = await get(
            'SELECT * FROM reservations WHERE user_id = ? AND status != ? ORDER BY id DESC LIMIT 1',
            [userId, 'cancelled']
        );

        if (!reservation) {
            return res.status(404).json({ error: 'Aucune réservation active pour générer la police' });
        }

        const paidRow = await get(
            'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE user_id = ? AND reservation_id = ? AND status = ?',
            [userId, reservation.id, 'paid']
        );
        const paidTotal = Number(paidRow?.paid || 0);
        const remaining = Math.max(0, Number(reservation.lot_price) - paidTotal);
        const progressPercent = reservation.lot_price > 0 ? Math.round((paidTotal / reservation.lot_price) * 100) : 0;

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=police-assurance-${reservation.id}.pdf`);
        doc.pipe(res);

        // En-tête
        doc.fontSize(10).fillColor('#666')
            .text('MANO VERDE INC SA — Société Anonyme au capital de 10 000 000 FCFA', { align: 'center' })
            .text('RCCM: RC/DLA/2025/B/0742 — Contribuable: M012500011770X', { align: 'center' })
            .moveDown(0.5);

        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#2E7D32').lineWidth(2).stroke();
        doc.moveDown(1);

        // Titre
        doc.fontSize(20).fillColor('#2E7D32').text("POLICE D'ASSURANCE FONCIÈRE", { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(11).fillColor('#666').text(`N° PA-${reservation.id}-${new Date().getFullYear()}`, { align: 'center' });
        doc.moveDown(1.5);

        // Parties
        doc.fontSize(13).fillColor('#1B5E20').text('ARTICLE 1 — LES PARTIES');
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#333')
            .text('Assureur : MANO VERDE INC SA, représentée par son Président Directeur Général')
            .text('Siège social : Douala, Cameroun')
            .moveDown(0.3)
            .text(`Assuré(e) : ${req.user.full_name}`)
            .text(`Email : ${req.user.email || '-'}   |   Tél : ${req.user.phone || '-'}`)
            .moveDown(1);

        // Objet
        doc.fontSize(13).fillColor('#1B5E20').text("ARTICLE 2 — OBJET DE L'ASSURANCE");
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#333')
            .text("La présente police couvre l'acquisition foncière suivante :", { continued: false })
            .moveDown(0.3);

        const tableY = doc.y;
        const col1 = 50; const col2 = 280;
        const fields = [
            ['Type de lot', reservation.lot_type],
            ['Prix du terrain', `${Number(reservation.lot_price).toLocaleString('fr-FR')} FCFA`],
            ['Durée du plan', `${reservation.duration_months} mois`],
            ['Mensualité', `${Number(reservation.monthly_amount).toLocaleString('fr-FR')} FCFA`],
            ['Total versé', `${paidTotal.toLocaleString('fr-FR')} FCFA`],
            ['Reste à payer', `${remaining.toLocaleString('fr-FR')} FCFA`],
            ['Avancement', `${progressPercent}%`]
        ];

        fields.forEach(([label, value], i) => {
            const y = tableY + i * 20;
            const bg = i % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
            doc.rect(col1, y, 495, 20).fill(bg);
            doc.fontSize(10).fillColor('#333').text(label, col1 + 5, y + 5, { width: 220 });
            doc.fontSize(10).fillColor('#1B5E20').text(value, col2 + 5, y + 5, { width: 220 });
        });

        doc.y = tableY + fields.length * 20 + 15;
        doc.moveDown(1);

        // Garanties
        doc.fontSize(13).fillColor('#1B5E20').text('ARTICLE 3 — GARANTIES');
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#333');
        const guarantees = [
            'Garantie de propriété : Le terrain objet de la présente police sera transféré en pleine propriété à l\'assuré dès le paiement intégral du prix.',
            'Protection contre l\'éviction : Mano Verde garantit l\'assuré contre toute revendication de tiers sur le terrain pendant et après la période de paiement.',
            'Garantie de conformité cadastrale : Le terrain est conforme au plan cadastral et dispose de tous les titres nécessaires.',
            'Droit de jouissance provisoire : Dès que 50% du prix total est versé, l\'assuré obtient un Procès-Verbal de Jouissance Provisoire.',
            'Protection contre les vices cachés : Mano Verde garantit l\'absence de servitudes non déclarées et de vices cachés affectant le terrain.'
        ];
        guarantees.forEach((g, i) => {
            doc.text(`${i + 1}. ${g}`, { indent: 10 });
            doc.moveDown(0.3);
        });
        doc.moveDown(0.5);

        // Conditions
        doc.fontSize(13).fillColor('#1B5E20').text('ARTICLE 4 — CONDITIONS');
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#333')
            .text("• L'assuré s'engage à respecter l'échéancier de paiement mensuel.")
            .text("• En cas de retard de paiement de plus de 2 mensualités consécutives, la police peut être suspendue.")
            .text("• L'assuré peut effectuer des versements anticipés sans frais ni pénalités.")
            .text("• La police est automatiquement résiliée en cas de remboursement intégral et transfert de propriété.")
            .moveDown(1);

        // Droit de rétractation
        doc.fontSize(13).fillColor('#1B5E20').text('ARTICLE 5 — DROIT DE RÉTRACTATION');
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#333')
            .text("L'assuré dispose d'un droit de rétractation de 7 jours calendaires à compter de la date de souscription. " +
                  "En cas de rétractation, les sommes versées seront intégralement remboursées dans un délai de 14 jours ouvrables.")
            .moveDown(1);

        // Date et signatures
        doc.fontSize(13).fillColor('#1B5E20').text('ARTICLE 6 — DATE D\'EFFET ET SIGNATURES');
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#333')
            .text(`Date d'effet : ${new Date(reservation.created_at).toLocaleDateString('fr-FR')}`)
            .text(`Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`)
            .moveDown(1.5);

        // Signatures
        const sigY = doc.y;
        doc.fontSize(10).fillColor('#333')
            .text('Pour MANO VERDE INC SA', 50, sigY)
            .text("L'Assuré(e)", 350, sigY)
            .moveDown(0.5);
        doc.text('Le Président Directeur Général', 50)
            .text(req.user.full_name, 350);
        doc.moveDown(2);
        doc.text('________________________', 50)
            .text('________________________', 350);

        // Pied de page
        doc.moveDown(2);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').lineWidth(0.5).stroke();
        doc.moveDown(0.5);
        doc.fontSize(8).fillColor('#999')
            .text('MANO VERDE INC SA — Siège social : Douala, Cameroun — contact@manovende.com — www.manovende.com', { align: 'center' })
            .text('Ce document est généré automatiquement et fait foi de police d\'assurance foncière.', { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Insurance policy error:', error);
        return res.status(500).json({ error: 'Erreur génération police d\'assurance' });
    }
});

module.exports = router;
