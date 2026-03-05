const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get } = require('../db/connection');
const { requireAuth, isSuperAdminUser, isManagerUser } = require('../middleware/auth');
const {
    normalizeEmail,
    sanitizeOptionalText,
    sanitizeText,
    isStrongPassword,
    isValidPhone
} = require('../utils/validation');

const router = express.Router();

function normalizePhone(value) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, '');
}

function tokenForUser(user) {
    return jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function register(req, res, role) {
    const { full_name, email, phone, city, password } = req.body;
    const safeName = sanitizeText(full_name, 120);
    const safeEmail = normalizeEmail(email) || null;
    const safePhone = normalizePhone(phone) || null;
    const safeCity = sanitizeOptionalText(city, 80);

    if (!safeName || !password) {
        return res.status(400).json({ error: 'full_name et password sont requis' });
    }

    // Au moins email OU téléphone valide obligatoire
    if (!safeEmail && (!safePhone || !isValidPhone(safePhone))) {
        return res.status(400).json({ error: 'Un email valide ou un numéro de téléphone valide est requis' });
    }

    if (safeEmail && !safeEmail.includes('@')) {
        return res.status(400).json({ error: 'Adresse email invalide' });
    }

    if (safePhone && !isValidPhone(safePhone)) {
        return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    if (!isStrongPassword(password)) {
        return res.status(400).json({
            error: 'Mot de passe faible (10+ caractères, majuscule, minuscule, chiffre, spécial)'
        });
    }

    // Vérifier unicité email
    if (safeEmail) {
        const existingEmail = await get('SELECT id FROM users WHERE email = ?', [safeEmail]);
        if (existingEmail) {
            return res.status(409).json({ error: 'Cet email est déjà utilisé' });
        }
    }

    // Vérifier unicité téléphone
    if (safePhone) {
        const existingPhone = await get('SELECT id FROM users WHERE phone = ?', [safePhone]);
        if (existingPhone) {
            return res.status(409).json({ error: 'Ce numéro de téléphone est déjà utilisé' });
        }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
        'INSERT INTO users(role, full_name, email, phone, city, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
        [role, safeName, safeEmail, safePhone, safeCity, passwordHash]
    );

    const user = await get('SELECT id, role, full_name, email, phone FROM users WHERE id = ?', [result.id]);
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
        const { identifier, email, phone, password } = req.body;

        // Accepter: identifier (email ou tel), ou email, ou phone séparément
        const rawIdentifier = identifier || email || phone || '';
        const trimmed = rawIdentifier.trim();

        if (!trimmed || !password) {
            return res.status(400).json({ error: 'Identifiant (email ou téléphone) et mot de passe requis' });
        }

        // Chercher par email OU par téléphone
        const user = await get(
            'SELECT * FROM users WHERE email = ? OR phone = ?',
            [trimmed.toLowerCase(), trimmed]
        );

        if (!user) {
            await req.audit?.('auth.login_failed', { identifier: trimmed });
            return res.status(401).json({ error: 'Identifiants invalides' });
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            await req.audit?.('auth.login_failed', { user_id: user.id });
            return res.status(401).json({ error: 'Identifiants invalides' });
        }

        await req.audit?.('auth.login_success', { user_id: user.id, role: user.role });

        const isSuperAdmin = user.role === 'admin' ? await isSuperAdminUser(user.id) : false;
        const isManager = (!isSuperAdmin && user.role === 'admin') ? await isManagerUser(user.id) : false;

        return res.json({
            token: tokenForUser(user),
            user: {
                id: user.id,
                role: user.role,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                reliability_score: user.reliability_score,
                is_super_admin: isSuperAdmin,
                is_manager: isManager
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur connexion' });
    }
});

router.post('/request-password-reset', async (req, res) => {
    try {
        const rawIdentifier = (req.body?.identifier || req.body?.email || '').trim();
        if (!rawIdentifier) {
            return res.status(400).json({ error: 'Email ou numéro de téléphone requis' });
        }

        const user = await get(
            'SELECT id, email FROM users WHERE email = ? OR phone = ?',
            [rawIdentifier.toLowerCase(), rawIdentifier]
        );
        if (!user) {
            await req.audit?.('auth.password_reset_request_unknown', { identifier: rawIdentifier });
            return res.json({ message: 'Si ce compte existe, un lien de réinitialisation a été généré.' });
        }

        const rawToken = crypto.randomBytes(24).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        await run(
            `INSERT INTO password_reset_tokens(user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
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
    const isManager = (!isSuperAdmin && req.user.role === 'admin') ? await isManagerUser(req.user.id) : false;
    return res.json({ user: Object.assign({}, req.user, { is_super_admin: isSuperAdmin, is_manager: isManager }) });
});

// ─── GOOGLE OAUTH ──────────────────────────────────────────────────────────
router.get('/google', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(501).json({
            error: 'Google OAuth non configuré',
            instructions: 'Ajoutez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans les variables Vercel'
        });
    }
    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account'
    });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.redirect(`${appUrl}/login.html?error=google_not_configured`);
    }

    const { code, error } = req.query;
    if (error || !code) {
        return res.redirect(`${appUrl}/login.html?error=google_denied`);
    }

    try {
        // 1. Échanger le code contre un access_token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: `${appUrl}/api/auth/google/callback`,
                grant_type: 'authorization_code'
            })
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            return res.redirect(`${appUrl}/login.html?error=google_token_failed`);
        }

        // 2. Récupérer le profil Google
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const profile = await profileRes.json();

        if (!profile.sub || !profile.email) {
            return res.redirect(`${appUrl}/login.html?error=google_profile_failed`);
        }

        // 3. Trouver ou créer l'utilisateur
        let user = await get('SELECT * FROM users WHERE google_id = ?', [profile.sub]);

        if (!user && profile.email) {
            // Chercher par email si déjà inscrit
            user = await get('SELECT * FROM users WHERE email = ?', [profile.email.toLowerCase()]);
            if (user) {
                // Lier le google_id au compte existant
                await run('UPDATE users SET google_id = ? WHERE id = ?', [profile.sub, user.id]);
            }
        }

        if (!user) {
            // Créer un nouveau compte client
            const result = await run(
                'INSERT INTO users(role, full_name, email, google_id) VALUES (?, ?, ?, ?)',
                ['client', profile.name || profile.email, profile.email.toLowerCase(), profile.sub]
            );
            user = await get('SELECT * FROM users WHERE id = ?', [result.id]);
        }

        // 4. Générer le JWT et les flags
        const isSuperAdmin = user.role === 'admin' ? await isSuperAdminUser(user.id) : false;
        const isManager = (!isSuperAdmin && user.role === 'admin') ? await isManagerUser(user.id) : false;

        const token = tokenForUser(user);
        const userPayload = JSON.stringify({
            id: user.id,
            role: user.role,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            reliability_score: user.reliability_score,
            is_super_admin: isSuperAdmin,
            is_manager: isManager
        });

        await req.audit?.('auth.google_login', { user_id: user.id });

        // 5. Rediriger vers le frontend avec le token dans le fragment URL
        const encoded = Buffer.from(userPayload).toString('base64');
        return res.redirect(`${appUrl}/login.html#google_token=${token}&google_user=${encoded}`);
    } catch (err) {
        return res.redirect(`${appUrl}/login.html?error=google_server_error`);
    }
});

module.exports = router;
