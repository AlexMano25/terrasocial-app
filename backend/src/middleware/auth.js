const jwt = require('jsonwebtoken');
const { get } = require('../db/connection');

async function isSuperAdminUser(userId) {
    const row = await get('SELECT id FROM super_admins WHERE user_id = ? AND (is_active = 1 OR is_active = true)', [userId]);
    return Boolean(row);
}

async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        if (!token) {
            return res.status(401).json({ error: 'Authentification requise' });
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await get(
            'SELECT id, role, full_name, email, phone, city, reliability_score, created_at FROM users WHERE id = ?',
            [payload.userId]
        );

        if (!user) {
            return res.status(401).json({ error: 'Utilisateur introuvable' });
        }

        req.user = user;
        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Token invalide' });
    }
}

function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Acces refuse' });
        }
        return next();
    };
}

async function requireSuperAdmin(req, res, next) {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Acces super admin refuse' });
        }

        const ok = await isSuperAdminUser(req.user.id);
        if (!ok) {
            return res.status(403).json({ error: 'Compte super admin requis' });
        }
        return next();
    } catch (error) {
        return res.status(500).json({ error: 'Verification super admin impossible' });
    }
}

module.exports = {
    requireAuth,
    requireRole,
    requireSuperAdmin,
    isSuperAdminUser
};
