const crypto = require('crypto');

function csrfProtection() {
    return (req, res, next) => {
        // Generate CSRF token if not present in cookie
        if (!req.cookies?.csrf_token) {
            const token = crypto.randomBytes(24).toString('hex');
            res.cookie('csrf_token', token, {
                httpOnly: false, // Must be readable by JS
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000 // 24h
            });
        }

        // Skip CSRF check for safe methods, webhooks, public auth, and test environment
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return next();
        }
        if (req.path.startsWith('/api/webhooks/')) {
            return next();
        }
        // Auth routes are public (no session to hijack) — standard CSRF exemption
        if (req.path.startsWith('/api/auth/')) {
            return next();
        }
        if (process.env.NODE_ENV === 'test') {
            return next();
        }

        const cookieToken = req.cookies?.csrf_token;
        const headerToken = req.headers['x-csrf-token'];

        if (!cookieToken || !headerToken || cookieToken !== headerToken) {
            return res.status(403).json({ error: 'CSRF token invalide' });
        }

        return next();
    };
}

module.exports = { csrfProtection };
