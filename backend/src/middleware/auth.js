const jwt = require('jsonwebtoken');
const { get } = require('../db/connection');

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

module.exports = {
    requireAuth,
    requireRole
};
