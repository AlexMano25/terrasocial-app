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

    let cumulativeDue = 0;

    for (let i = 0; i < reservation.duration_months; i++) {
        // Calcul du montant restant à planifier
        const remainingTotal = totalDue - cumulativeDue;

        // Si tout est planifié, arrêter l'échéancier
        if (remainingTotal <= 0) break;

        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i + 1);
        const dueDateStr = dueDate.toISOString().slice(0, 10);

        // Dernier versement : si le reste est inférieur à la mensualité
        const isFinalPayment = remainingTotal < monthly;
        const amountDue = isFinalPayment ? remainingTotal : monthly;
        const label = isFinalPayment ? 'Versement final' : null;

        cumulativeDue += amountDue;

        const allocated = Math.min(amountDue, Math.max(0, totalPaid));
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
            status,
            label
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

    // Calcul du montant journalier pour cette réservation
    const insurancePersons = Number(reservation.insurance_persons) || 0;
    const dailyLot = Number(reservation.daily_amount) || 1500;
    const dailyInsurance = insurancePersons * 350;
    const dailyTotal = dailyLot + dailyInsurance;
    const lotSizeM2 = Number(reservation.lot_size_m2) || 200;

    return {
        reservation_id: reservation.id,
        lot_type: reservation.lot_type,
        lot_price: totalDue,
        lot_size_m2: lotSizeM2,
        duration_months: reservation.duration_months,
        monthly_amount: monthly,
        deposit_amount: reservation.deposit_amount,
        daily_amount: dailyLot,
        insurance_persons: insurancePersons,
        daily_insurance: dailyInsurance,
        daily_total: dailyTotal,
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
            `SELECT id, lot_type, lot_price, duration_months, deposit_amount, monthly_amount,
                    status, created_at, insurance_persons, daily_amount, lot_size_m2
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
        const activeReservations = reservations.filter((r) => r.status !== 'cancelled');
        const reservationSummaries = activeReservations.map((r) => {
            const resPayments = payments.filter(
                (p) => p.reservation_id === r.id || (!p.reservation_id && activeReservations.length === 1)
            );
            return computeReservationSummary(r, resPayments);
        });

        // Totaux globaux
        const commitmentTotal = activeReservations.reduce((s, r) => s + Number(r.lot_price), 0);
        const paidTotalRow = await get(
            'SELECT COALESCE(SUM(amount), 0) AS paid_total FROM payments WHERE user_id = ? AND status = ?',
            [userId, 'paid']
        );
        const paidTotal = Number(paidTotalRow?.paid_total || 0);
        const remainingTotal = Math.max(0, commitmentTotal - paidTotal);
        const totalLateAmount = reservationSummaries.reduce((s, r) => s + r.late_amount, 0);
        const totalLateMonths = reservationSummaries.reduce((s, r) => s + r.late_months_count, 0);

        // Totaux journaliers globaux (somme de toutes les souscriptions actives)
        const totalDailyLots = reservationSummaries.reduce((s, r) => s + r.daily_amount, 0);
        const totalInsurancePersons = reservationSummaries.reduce((s, r) => s + r.insurance_persons, 0);
        const totalDailyInsurance = totalInsurancePersons * 350;
        const totalDailyAmount = totalDailyLots + totalDailyInsurance;
        const totalActiveLots = activeReservations.length;

        return res.json({
            profile: req.user,
            metrics: {
                commitment_total: commitmentTotal,
                paid_total: paidTotal,
                remaining_total: remainingTotal,
                reliability_score: req.user.reliability_score,
                late_amount: totalLateAmount,
                late_months_count: totalLateMonths,
                // Starter model metrics
                total_active_lots: totalActiveLots,
                total_daily_lots: totalDailyLots,
                total_insurance_persons: totalInsurancePersons,
                total_daily_insurance: totalDailyInsurance,
                total_daily_amount: totalDailyAmount,
                // Backward compat
                min_daily_amount: totalDailyAmount || 1500,
                monthly_amount: totalDailyAmount * 30
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

// ── Gérer les personnes assurées sur une réservation ──────────────────────
router.post('/reservations/:id/insurance-persons', async (req, res) => {
    try {
        const userId = req.user.id;
        const resId = req.params.id;
        const { count } = req.body;
        const safeCount = Math.max(0, Math.floor(Number(count) || 0));

        const reservation = await get(
            'SELECT * FROM reservations WHERE id = ? AND user_id = ? AND status != ?',
            [resId, userId, 'cancelled']
        );

        if (!reservation) {
            return res.status(404).json({ error: 'Réservation introuvable' });
        }

        await run(
            'UPDATE reservations SET insurance_persons = ? WHERE id = ?',
            [safeCount, reservation.id]
        );

        const dailyLot = Number(reservation.daily_amount) || 1500;
        const dailyInsurance = safeCount * 350;
        const dailyTotal = dailyLot + dailyInsurance;

        return res.json({
            reservation_id: reservation.id,
            insurance_persons: safeCount,
            daily_lot: dailyLot,
            daily_insurance: dailyInsurance,
            daily_total: dailyTotal
        });
    } catch (error) {
        console.error('Insurance persons error:', error);
        return res.status(500).json({ error: 'Erreur mise à jour assurance' });
    }
});

// ── Initier un versement (crée un paiement PENDING → CamPay le confirme) ──
router.post('/versement', async (req, res) => {
    try {
        const userId = req.user.id;
        const { reservation_id, amount, method, phone } = req.body;
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

        // Montant minimum = journalier (lot daily + insurance persons × 350)
        const dailyLot = Number(reservation.daily_amount) || 1500;
        const insurancePersons = Number(reservation.insurance_persons) || 0;
        const dailyInsurance = insurancePersons * 350;
        const minDaily = dailyLot + dailyInsurance;

        if (!safeAmount || safeAmount < minDaily) {
            return res.status(400).json({
                error: `Le montant minimum est de ${minDaily.toLocaleString('fr-FR')} FCFA/jour (lot: ${dailyLot.toLocaleString('fr-FR')} + assurance: ${dailyInsurance.toLocaleString('fr-FR')})`,
                min_amount: minDaily
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

        // Créer le paiement en statut PENDING (sera confirmé par CamPay webhook)
        const result = await run(
            `INSERT INTO payments(user_id, reservation_id, amount, method, due_date, status, reference)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, reservation.id, safeAmount, method, new Date().toISOString().slice(0, 10), 'pending', reference]
        );

        await req.audit?.('client.versement_initiated', {
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
            status: 'pending',
            reservation_id: reservation.id,
            user_name: req.user.full_name,
            user_email: req.user.email,
            user_phone: phone || req.user.phone
        });
    } catch (error) {
        console.error('Versement error:', error);
        return res.status(500).json({ error: 'Erreur lors du versement' });
    }
});

// ── Confirmer un versement (appelé après confirmation CamPay côté client) ──
router.post('/versement/:id/confirm', async (req, res) => {
    try {
        const userId = req.user.id;
        const paymentId = req.params.id;
        const { campay_reference } = req.body;

        const payment = await get(
            'SELECT * FROM payments WHERE id = ? AND user_id = ? AND status = ?',
            [paymentId, userId, 'pending']
        );

        if (!payment) {
            return res.status(404).json({ error: 'Paiement pending introuvable' });
        }

        // Marquer comme payé
        await run(
            'UPDATE payments SET status = ?, paid_at = CURRENT_TIMESTAMP, reference = ? WHERE id = ?',
            ['paid', campay_reference || payment.reference, payment.id]
        );

        const { recomputeReliabilityScore } = require('../services/reliability');
        const score = await recomputeReliabilityScore(userId);

        await req.audit?.('client.versement_confirmed', {
            user_id: userId,
            payment_id: payment.id,
            campay_reference
        });

        return res.json({
            id: payment.id,
            status: 'paid',
            reliability_score: score
        });
    } catch (error) {
        console.error('Versement confirm error:', error);
        return res.status(500).json({ error: 'Erreur confirmation versement' });
    }
});

// ── Annuler un versement pending (timeout ou échec CamPay) ─────────────────
router.post('/versement/:id/cancel', async (req, res) => {
    try {
        const userId = req.user.id;
        const paymentId = req.params.id;

        const payment = await get(
            'SELECT * FROM payments WHERE id = ? AND user_id = ? AND status = ?',
            [paymentId, userId, 'pending']
        );

        if (!payment) {
            return res.status(404).json({ error: 'Paiement pending introuvable' });
        }

        await run('DELETE FROM payments WHERE id = ?', [payment.id]);

        return res.json({ message: 'Versement annulé' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur annulation' });
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

        // Prix au m² et surfaces par type de lot
        const LOT_CONFIG = {
            starter:  { price_per_m2: 200,   surface: 200, total: 40000 },
            standard: { price_per_m2: 6500,  surface: 200, total: 1300000 },
            confort:  { price_per_m2: 8500,  surface: 400, total: 3400000 },
            premium:  { price_per_m2: 10000, surface: 500, total: 5000000 }
        };
        const config = LOT_CONFIG[lot_type] || LOT_CONFIG.starter;
        const lotSize = config.surface;
        const pricePerM2 = config.price_per_m2;

        // Souscriptions : chaque 200m² = 1 souscription, minimum 1500 FCFA/jour/souscription
        const subscriptions = Math.ceil(lotSize / 200);
        const dailyAmount = subscriptions * 1500;

        // Fréquence par défaut : Starter = quotidien uniquement
        const defaultFreq = lot_type === 'starter' ? 'quotidien' : 'quotidien';

        const result = await run(
            `INSERT INTO reservations(user_id, lot_type, lot_price, duration_months, deposit_amount, monthly_amount, source, insurance_persons, daily_amount, lot_size_m2, price_per_m2, payment_frequency)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, lot_type, price || config.total, duration, deposit, monthly, source || null, 0, dailyAmount, lotSize, pricePerM2, defaultFreq]
        );

        await req.audit?.('client.reservation_created', { user_id: req.user.id, reservation_id: result.id });

        return res.status(201).json({
            id: result.id,
            lot_type,
            lot_price: price || config.total,
            lot_size_m2: lotSize,
            price_per_m2: pricePerM2,
            duration_months: duration,
            deposit_amount: deposit,
            monthly_amount: monthly,
            daily_amount: dailyAmount,
            insurance_persons: 0,
            payment_frequency: defaultFreq
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur creation reservation' });
    }
});

// ── Police d'assurance (génération PDF) ────────────────────────────────────
router.get('/insurance-policy', async (req, res) => {
    try {
        const userId = req.user.id;

        // Toutes les réservations actives pour la police
        const reservations = await all(
            'SELECT * FROM reservations WHERE user_id = ? AND status != ? ORDER BY id DESC',
            [userId, 'cancelled']
        );

        if (!reservations || reservations.length === 0) {
            return res.status(404).json({ error: 'Aucune réservation active pour générer la police' });
        }

        // Calcul des totaux
        let totalPrice = 0;
        let totalPaid = 0;
        let totalInsurancePersons = 0;
        let totalDailyAmount = 0;

        for (const reservation of reservations) {
            totalPrice += Number(reservation.lot_price) || 0;
            totalInsurancePersons += Number(reservation.insurance_persons) || 0;
            const dailyLot = Number(reservation.daily_amount) || 1500;
            const dailyIns = (Number(reservation.insurance_persons) || 0) * 350;
            totalDailyAmount += dailyLot + dailyIns;

            const paidRow = await get(
                'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE user_id = ? AND reservation_id = ? AND status = ?',
                [userId, reservation.id, 'paid']
            );
            totalPaid += Number(paidRow?.paid || 0);
        }

        const totalRemaining = Math.max(0, totalPrice - totalPaid);
        const progressPercent = totalPrice > 0 ? Math.round((totalPaid / totalPrice) * 100) : 0;

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=police-assurance-terrasocial.pdf`);
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
        doc.fontSize(11).fillColor('#666').text(`N° PA-${reservations[0].id}-${new Date().getFullYear()}`, { align: 'center' });
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
            .text("La présente police couvre les acquisitions foncières suivantes :", { continued: false })
            .moveDown(0.3);

        // Tableau des lots souscrits
        const tableY = doc.y;
        const col1 = 50; const col2 = 200; const col3 = 320; const col4 = 420;

        // Header
        doc.rect(col1, tableY, 495, 18).fill('#2E7D32');
        doc.fontSize(9).fillColor('#fff')
            .text('Lot', col1 + 5, tableY + 4, { width: 140 })
            .text('Superficie', col2 + 5, tableY + 4, { width: 110 })
            .text('Prix', col3 + 5, tableY + 4, { width: 90 })
            .text('Assurés', col4 + 5, tableY + 4, { width: 80 });

        let rowY = tableY + 18;
        reservations.forEach((r, i) => {
            const bg = i % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
            doc.rect(col1, rowY, 495, 18).fill(bg);
            doc.fontSize(9).fillColor('#333')
                .text(r.lot_type.toUpperCase(), col1 + 5, rowY + 4, { width: 140 })
                .text(`${Number(r.lot_size_m2 || 200)} m²`, col2 + 5, rowY + 4, { width: 110 })
                .text(`${Number(r.lot_price).toLocaleString('fr-FR')} FCFA`, col3 + 5, rowY + 4, { width: 90 })
                .text(`${Number(r.insurance_persons || 0)} pers.`, col4 + 5, rowY + 4, { width: 80 });
            rowY += 18;
        });

        doc.y = rowY + 10;
        doc.moveDown(0.5);

        // Résumé financier
        const summaryFields = [
            ['Nombre de lots souscrits', `${reservations.length}`],
            ['Prix total terrains', `${totalPrice.toLocaleString('fr-FR')} FCFA`],
            ['Personnes assurées', `${totalInsurancePersons} (${(totalInsurancePersons * 350).toLocaleString('fr-FR')} FCFA/jour)`],
            ['Montant journalier total', `${totalDailyAmount.toLocaleString('fr-FR')} FCFA`],
            ['Total versé à ce jour', `${totalPaid.toLocaleString('fr-FR')} FCFA`],
            ['Reste à payer', `${totalRemaining.toLocaleString('fr-FR')} FCFA`],
            ['Avancement global', `${progressPercent}%`]
        ];

        const sumY = doc.y;
        summaryFields.forEach(([label, value], i) => {
            const y = sumY + i * 18;
            const bg = i % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
            doc.rect(col1, y, 495, 18).fill(bg);
            doc.fontSize(9).fillColor('#333').text(label, col1 + 5, y + 4, { width: 260 });
            doc.fontSize(9).fillColor('#1B5E20').text(value, 320, y + 4, { width: 220 });
        });

        doc.y = sumY + summaryFields.length * 18 + 15;
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
            'Protection contre les vices cachés : Mano Verde garantit l\'absence de servitudes non déclarées et de vices cachés affectant le terrain.',
            'Assurance des personnes : Les personnes enregistrées sur ce contrat bénéficient de la couverture d\'assurance foncière de Mano Verde.'
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
            .text("• L'assuré s'engage à respecter l'échéancier de paiement journalier ou mensuel.")
            .text("• En cas de retard de paiement de plus de 2 mensualités consécutives, la police peut être suspendue.")
            .text("• L'assuré peut effectuer des versements anticipés sans frais ni pénalités.")
            .text("• La police est automatiquement résiliée en cas de remboursement intégral et transfert de propriété.")
            .text("• L'assurance des personnes est active dès la souscription et reste valide tant que les paiements sont à jour.")
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
            .text(`Date d'effet : ${new Date(reservations[reservations.length - 1].created_at).toLocaleDateString('fr-FR')}`)
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
