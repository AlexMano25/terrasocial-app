const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get } = require('../db/connection');
const { requireAuth, isSuperAdminUser } = require('../middleware/auth');
const {
    normalizeEmail,
    sanitizeOptionalText,
    sanitizeText,
    isStrongPassword,
    isValidPhone
} = require('../utils/validation');

const router = express.Router();

function tokenForUser(user) {
    return jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function register(req, res, role) {
    const { full_name, email, phone, city, password } = req.body;
    const safeName = sanitizeText(full_name, 120);
    const safeEmail = normalizeEmail(email);
    const safePhone = sanitizeOptionalText(phone, 30);
    const safeCity = sanitizeOptionalText(city, 80);

    if (!safeName || !safeEmail || !password) {
        return res.status(400).json({ error: 'full_name, email et password sont requis' });
    }

    if (!isStrongPassword(password)) {
        return res.status(400).json({
            error: 'Mot de passe faible (10+ caractères, majuscule, minuscule, chiffre, spécial)'
        });
    }

    if (safePhone && !isValidPhone(safePhone)) {
        return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    const existing = await get('SELECT id FROM users WHERE email = ?', [safeEmail]);
    if (existing) {
        return res.status(409).json({ error: 'Cet email existe deja' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
        'INSERT INTO users(role, full_name, email, phone, city, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
        [role, safeName, safeEmail, safePhone, safeCity, passwordHash]
    );

    const user = await get('SELECT id, role, full_name, email FROM users WHERE id = ?', [result.id]);
    await req.audit?.('auth.register', { role, user_id: user.id });
    return res.status(201).json({ token: tokenForUser(user), user });
}

router.post('/register/client', async (req, res) => {
    try {
        return await register(req, res, 'client');
    } catch (error) {
        return res.status(500).json({ error: 'Erreur inscription client' });
    }
});

router.post('/register/owner', async (req, res) => {
    try {
        return await register(req, res, 'owner');
    } catch (error) {
        return res.status(500).json({ error: 'Erreur inscription proprietaire' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const safeEmail = normalizeEmail(email);

        if (!safeEmail || !password) {
            return res.status(400).json({ error: 'email et password requis' });
        }

        const user = await get('SELECT * FROM users WHERE email = ?', [safeEmail]);
        if (!user) {
            await req.audit?.('auth.login_failed', { email: safeEmail });
            return res.status(401).json({ error: 'Identifiants invalides' });
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            await req.audit?.('auth.login_failed', { user_id: user.id });
            return res.status(401).json({ error: 'Identifiants invalides' });
        }

        await req.audit?.('auth.login_success', { user_id: user.id, role: user.role });
        const isSuperAdmin = user.role === 'admin' ? await isSuperAdminUser(user.id) : false;
        return res.json({
            token: tokenForUser(user),
            user: {
                id: user.id,
                role: user.role,
                full_name: user.full_name,
                email: user.email,
                reliability_score: user.reliability_score,
                is_super_admin: isSuperAdmin
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur connexion' });
    }
});

router.post('/request-password-reset', async (req, res) => {
    try {
        const safeEmail = normalizeEmail(req.body?.email);
        if (!safeEmail) {
            return res.status(400).json({ error: 'email requis' });
        }

        const user = await get('SELECT id, email FROM users WHERE email = ?', [safeEmail]);
        if (!user) {
            await req.audit?.('auth.password_reset_request_unknown', { email: safeEmail });
            return res.json({ message: 'Si ce compte existe, un lien de réinitialisation a été généré.' });
        }

        const rawToken = crypto.randomBytes(24).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        await run(
            `INSERT INTO password_reset_tokens(user_id, token_hash, expires_at)
             VALUES (?, ?, ?)`,
            [user.id, tokenHash, expiresAt]
        );

        await req.audit?.('auth.password_reset_requested', { user_id: user.id });
        const payload = { message: 'Si ce compte existe, un lien de réinitialisation a été généré.' };

        if (process.env.NODE_ENV !== 'production') {
            payload.debug_reset_token = rawToken;
        }

        return res.json(payload);
    } catch (error) {
        return res.status(500).json({ error: 'Erreur demande réinitialisation' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, new_password } = req.body || {};
        if (!token || !new_password) {
            return res.status(400).json({ error: 'token et new_password requis' });
        }

        if (!isStrongPassword(new_password)) {
            return res.status(400).json({
                error: 'Mot de passe faible (10+ caractères, majuscule, minuscule, chiffre, spécial)'
            });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const row = await get(
            `SELECT id, user_id, expires_at, used_at
             FROM password_reset_tokens
             WHERE token_hash = ?
             ORDER BY id DESC LIMIT 1`,
            [tokenHash]
        );

        if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
            await req.audit?.('auth.password_reset_failed', { reason: 'invalid_or_expired' });
            return res.status(400).json({ error: 'Token invalide ou expiré' });
        }

        const hash = await bcrypt.hash(new_password, 10);
        await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id]);
        await run('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);

        await req.audit?.('auth.password_reset_success', { user_id: row.user_id });
        return res.json({ message: 'Mot de passe réinitialisé avec succès' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur réinitialisation mot de passe' });
    }
});

router.get('/me', requireAuth, async (req, res) => {
    const isSuperAdmin = req.user.role === 'admin' ? await isSuperAdminUser(req.user.id) : false;
    return res.json({ user: Object.assign({}, req.user, { is_super_admin: isSuperAdmin }) });
});

module.exports = router;
