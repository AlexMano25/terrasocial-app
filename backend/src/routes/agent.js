const express = require('express');
const crypto = require('crypto');
const { all, get, run } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { sanitizeText, sanitizeOptionalText } = require('../utils/validation');

const router = express.Router();

// Middleware: vérifier que l'utilisateur est un agent actif
async function requireAgent(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentification requise' });
    const agent = await get('SELECT * FROM agents WHERE user_id = ? AND (status = ? OR is_active = TRUE)', [req.user.id, 'active']);
    if (!agent) return res.status(403).json({ error: 'Compte agent non trouvé ou inactif' });
    req.agent = agent;
    next();
}

// ── Dashboard agent ─────────────────────────────────────────────────────────
router.get('/dashboard', requireAuth, requireAgent, async (req, res) => {
    try {
        const agent = req.agent;

        // Stats
        const referrals = await all('SELECT * FROM referrals WHERE agent_id = ? ORDER BY created_at DESC LIMIT 100', [agent.id]);
        const commissions = await all('SELECT * FROM agent_commissions WHERE agent_id = ? ORDER BY created_at DESC LIMIT 100', [agent.id]);
        const promoCodes = await all('SELECT * FROM promo_codes WHERE agent_id = ? ORDER BY created_at DESC', [agent.id]);

        const totalClientsReferred = referrals.filter(r => r.referred_type === 'client').length;
        const totalOwnersReferred = referrals.filter(r => r.referred_type === 'owner').length;
        const totalCommissionsEarned = commissions.reduce((s, c) => s + Number(c.amount || 0), 0);
        const pendingCommissions = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount || 0), 0);
        const paidCommissions = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount || 0), 0);

        // Lien de parrainage unique
        const siteUrl = process.env.SITE_URL || 'https://social.manovende.com';
        const referralLink = `${siteUrl}/index.html?ref=${agent.agent_code}`;

        return res.json({
            agent: {
                id: agent.id,
                agent_code: agent.agent_code,
                company_name: agent.company_name,
                status: agent.status || (agent.is_active ? 'active' : 'pending'),
                commission_rate: agent.commission_rate,
                referral_link: referralLink
            },
            metrics: {
                total_clients: totalClientsReferred,
                total_owners: totalOwnersReferred,
                total_earned: totalCommissionsEarned,
                pending_commissions: pendingCommissions,
                paid_commissions: paidCommissions,
                total_referrals: referrals.length
            },
            referrals,
            commissions,
            promo_codes: promoCodes
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement dashboard agent' });
    }
});

// ── Créer un code promo ─────────────────────────────────────────────────────
router.post('/promo-codes', requireAuth, requireAgent, async (req, res) => {
    try {
        const description = sanitizeOptionalText(req.body.description, 200);
        const maxUses = req.body.max_uses ? Number(req.body.max_uses) : null;
        const expiresAt = req.body.expires_at || null;

        // Générer un code unique basé sur le code agent
        const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const code = req.agent.agent_code + '-' + suffix;

        await run(
            'INSERT INTO promo_codes(agent_id, code, description, max_uses, expires_at) VALUES (?, ?, ?, ?, ?)',
            [req.agent.id, code, description, maxUses, expiresAt]
        );

        return res.status(201).json({ code, description, max_uses: maxUses });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur création code promo' });
    }
});

// ── Désactiver un code promo ────────────────────────────────────────────────
router.post('/promo-codes/:id/deactivate', requireAuth, requireAgent, async (req, res) => {
    try {
        const id = Number(req.params.id);
        await run('UPDATE promo_codes SET is_active = FALSE WHERE id = ? AND agent_id = ?', [id, req.agent.id]);
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur désactivation code' });
    }
});

// ── Mes parrainages ─────────────────────────────────────────────────────────
router.get('/referrals', requireAuth, requireAgent, async (req, res) => {
    try {
        const rows = await all(
            `SELECT r.*, u.full_name AS referred_name, u.email AS referred_email, u.phone AS referred_phone
             FROM referrals r
             LEFT JOIN users u ON r.referred_user_id = u.id
             WHERE r.agent_id = ?
             ORDER BY r.created_at DESC`,
            [req.agent.id]
        );
        return res.json({ referrals: rows });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture parrainages' });
    }
});

// ── Mes commissions ─────────────────────────────────────────────────────────
router.get('/commissions', requireAuth, requireAgent, async (req, res) => {
    try {
        const rows = await all(
            'SELECT * FROM agent_commissions WHERE agent_id = ? ORDER BY created_at DESC LIMIT 200',
            [req.agent.id]
        );
        return res.json({ commissions: rows });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture commissions' });
    }
});

// ── Vérifier un code promo (route publique, sans auth) ──────────────────────
router.get('/verify-promo/:code', async (req, res) => {
    try {
        const code = sanitizeText(req.params.code, 50).toUpperCase();
        const promo = await get(
            `SELECT pc.*, a.agent_code, a.company_name, a.status AS agent_status, a.is_active AS agent_active
             FROM promo_codes pc
             JOIN agents a ON pc.agent_id = a.id
             WHERE UPPER(pc.code) = ? AND pc.is_active = TRUE`,
            [code]
        );

        if (!promo) return res.json({ valid: false, error: 'Code promo invalide ou expiré' });
        if (promo.agent_status !== 'active' && !promo.agent_active) return res.json({ valid: false, error: 'Agent partenaire inactif' });
        if (promo.max_uses && promo.usage_count >= promo.max_uses) return res.json({ valid: false, error: 'Code promo épuisé' });
        if (promo.expires_at && new Date(promo.expires_at) < new Date()) return res.json({ valid: false, error: 'Code promo expiré' });

        return res.json({
            valid: true,
            code: promo.code,
            agent_code: promo.agent_code,
            agent_name: promo.company_name || promo.agent_code,
            description: promo.description
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur vérification code' });
    }
});

// ── Vérifier un lien de parrainage (route publique) ─────────────────────────
router.get('/verify-ref/:agentCode', async (req, res) => {
    try {
        const agentCode = sanitizeText(req.params.agentCode, 50);
        const agent = await get(
            'SELECT id, agent_code, company_name, status, is_active FROM agents WHERE agent_code = ?',
            [agentCode]
        );

        if (!agent) return res.json({ valid: false });
        if (agent.status !== 'active' && !agent.is_active) return res.json({ valid: false });

        return res.json({
            valid: true,
            agent_code: agent.agent_code,
            agent_name: agent.company_name || agent.agent_code
        });
    } catch (error) {
        return res.json({ valid: false });
    }
});

// ── Profil agent ────────────────────────────────────────────────────────────
router.get('/profile', requireAuth, requireAgent, async (req, res) => {
    try {
        const user = await get('SELECT id, full_name, email, phone, city, created_at FROM users WHERE id = ?', [req.user.id]);
        return res.json({
            profile: user,
            agent: {
                agent_code: req.agent.agent_code,
                company_name: req.agent.company_name,
                orange_money: req.agent.orange_money,
                mtn_momo: req.agent.mtn_momo,
                bank_name: req.agent.bank_name,
                bank_account: req.agent.bank_account
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture profil agent' });
    }
});

router.put('/profile', requireAuth, requireAgent, async (req, res) => {
    try {
        const { full_name, phone, city, company_name, orange_money, mtn_momo, bank_name, bank_account, new_password } = req.body;

        // Mise à jour user
        const userUpdates = [];
        const userParams = [];
        if (full_name) { userUpdates.push('full_name = ?'); userParams.push(full_name.trim().slice(0, 120)); }
        if (phone) { userUpdates.push('phone = ?'); userParams.push(phone.trim().slice(0, 30)); }
        if (city !== undefined) { userUpdates.push('city = ?'); userParams.push((city || '').trim().slice(0, 80)); }
        if (userUpdates.length) {
            userParams.push(req.user.id);
            await run('UPDATE users SET ' + userUpdates.join(', ') + ' WHERE id = ?', userParams);
        }

        // Mise à jour agent
        const agentUpdates = [];
        const agentParams = [];
        if (company_name !== undefined) { agentUpdates.push('company_name = ?'); agentParams.push((company_name || '').trim().slice(0, 120)); }
        if (orange_money !== undefined) { agentUpdates.push('orange_money = ?'); agentParams.push((orange_money || '').trim().slice(0, 30)); }
        if (mtn_momo !== undefined) { agentUpdates.push('mtn_momo = ?'); agentParams.push((mtn_momo || '').trim().slice(0, 30)); }
        if (bank_name !== undefined) { agentUpdates.push('bank_name = ?'); agentParams.push((bank_name || '').trim().slice(0, 100)); }
        if (bank_account !== undefined) { agentUpdates.push('bank_account = ?'); agentParams.push((bank_account || '').trim().slice(0, 50)); }
        if (agentUpdates.length) {
            agentParams.push(req.agent.id);
            await run('UPDATE agents SET ' + agentUpdates.join(', ') + ' WHERE id = ?', agentParams);
        }

        // Changement mot de passe
        if (new_password) {
            const bcrypt = require('bcryptjs');
            if (new_password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (min 8 caractères)' });
            const hash = await bcrypt.hash(new_password, 10);
            await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
        }

        return res.json({ ok: true, message: 'Profil mis à jour' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise à jour profil agent' });
    }
});

// GET /api/agent/balance
router.get('/balance', requireAuth, async (req, res) => {
    try {
        const agent = await get('SELECT id FROM agents WHERE user_id = ? AND is_active = TRUE', [req.user.id]);
        if (!agent) return res.status(403).json({ error: 'Compte agent requis' });

        const { getAgentBalance, getCommissionRate } = require('../services/commission');
        const balance = await getAgentBalance(agent.id);
        const currentRate = await getCommissionRate(agent.id);

        return res.json({ ...balance, current_rate: currentRate });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur récupération solde' });
    }
});

// POST /api/agent/withdraw
router.post('/withdraw', requireAuth, async (req, res) => {
    try {
        const agent = await get('SELECT id FROM agents WHERE user_id = ? AND is_active = TRUE', [req.user.id]);
        if (!agent) return res.status(403).json({ error: 'Compte agent requis' });

        const { amount, method, phone } = req.body;
        const safeAmount = Number(amount);

        if (!safeAmount || safeAmount < 5000) {
            return res.status(400).json({ error: 'Montant minimum: 5 000 FCFA' });
        }
        if (!method) {
            return res.status(400).json({ error: 'Méthode de paiement requise' });
        }

        const { getAgentBalance } = require('../services/commission');
        const balance = await getAgentBalance(agent.id);

        if (safeAmount > balance.available) {
            return res.status(400).json({ error: 'Solde insuffisant (' + balance.available + ' FCFA disponible)' });
        }

        const fee = Math.ceil(safeAmount * 0.03);
        const netAmount = safeAmount - fee;

        const result = await run(
            `INSERT INTO agent_withdrawals(agent_id, amount, fee, net_amount, method, phone, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [agent.id, safeAmount, fee, netAmount, method, phone || '']
        );

        return res.status(201).json({
            id: result.id,
            amount: safeAmount,
            fee,
            net_amount: netAmount,
            method,
            status: 'pending'
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur demande de retrait' });
    }
});

// GET /api/agent/withdrawals
router.get('/withdrawals', requireAuth, async (req, res) => {
    try {
        const agent = await get('SELECT id FROM agents WHERE user_id = ? AND is_active = TRUE', [req.user.id]);
        if (!agent) return res.status(403).json({ error: 'Compte agent requis' });

        const withdrawals = await all(
            'SELECT * FROM agent_withdrawals WHERE agent_id = ? ORDER BY created_at DESC',
            [agent.id]
        );

        return res.json({ withdrawals });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur récupération retraits' });
    }
});

module.exports = router;
