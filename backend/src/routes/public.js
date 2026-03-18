const express = require('express');
const { run, all } = require('../db/connection');
const {
    isValidPhone,
    normalizeEmail,
    sanitizeOptionalText,
    sanitizeText,
    validateReservationPayload
} = require('../utils/validation');

const router = express.Router();

router.get('/lots', async (req, res) => {
    try {
        const rows = await all(
            `SELECT id, title, location, size_m2, price, monthly_amount, duration_months, icon, features, status, display_order
             FROM available_lots
             WHERE status = ?
             ORDER BY display_order ASC, id ASC`,
            ['available']
        );

        const lots = rows.map((row) => {
            let features = [];
            try {
                features = JSON.parse(row.features || '[]');
            } catch (error) {
                features = [];
            }
            return Object.assign({}, row, { features });
        });

        return res.json({ lots });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture lots disponibles' });
    }
});

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
            `INSERT INTO reservations(user_id, lot_type, lot_price, duration_months, deposit_amount, monthly_amount, source, status, lead_name, lead_phone, lead_email, lead_city)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [null, lotType, price, duration, deposit, monthly, safeSource || 'site', 'lead', safeName, safePhone, safeEmail || null, safeCity || null]
        );

        await req.audit?.('public.reservation_lead_created', { lot_type: lotType, lot_price: price, lead_name: safeName, lead_phone: safePhone });
        return res.status(201).json({
            message: 'Demande recue. Un conseiller vous contactera rapidement.',
            contact: { full_name: safeName, phone: safePhone, email: safeEmail || null, city: safeCity || null }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur creation demande publique' });
    }
});

// ── Demande de partenariat (formulaire public) ──────────────────────────────
router.post('/partnership', async (req, res) => {
    try {
        const { full_name, phone, email, city, company_name, motivation } = req.body;
        const safeName = sanitizeText(full_name, 120);
        const safePhone = sanitizeText(phone, 30);
        const safeEmail = normalizeEmail(email);
        const safeCompany = sanitizeOptionalText(company_name, 120);
        const safeMotivation = sanitizeOptionalText(motivation, 1000);

        if (!safeName || !safePhone) {
            return res.status(400).json({ error: 'Nom et téléphone requis' });
        }

        // Créer un compte utilisateur agent (inactif jusqu'à validation)
        const bcrypt = require('bcryptjs');
        const tempPassword = 'AG-' + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        const agentEmail = safeEmail || `agent.${Date.now()}@terrasocial.cm`;

        // Vérifier si email déjà utilisé
        const existing = await get('SELECT id FROM users WHERE email = ?', [agentEmail]);
        let userId;
        if (existing) {
            userId = existing.id;
        } else {
            const created = await run(
                'INSERT INTO users(role, full_name, email, phone, city, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
                ['admin', safeName, agentEmail, safePhone, safeCity || city || '', passwordHash]
            );
            userId = created.id;
        }

        // Créer l'entrée agent
        const agentCode = 'AG-' + safeName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') + '-' + String(Date.now()).slice(-5);
        const existingAgent = await get('SELECT id FROM agents WHERE user_id = ?', [userId]);
        if (existingAgent) {
            return res.status(400).json({ error: 'Une demande de partenariat existe déjà pour ce compte' });
        }

        await run(
            `INSERT INTO agents(user_id, agent_code, status, company_name, motivation, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, agentCode, 'pending', safeCompany || safeName, safeMotivation, false]
        );

        return res.status(201).json({
            message: 'Demande de partenariat enregistrée ! Nous vous contacterons après validation.',
            agent_code: agentCode
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur enregistrement demande partenariat: ' + error.message });
    }
});

module.exports = router;
