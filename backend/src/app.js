const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { initializeDatabase } = require('./db/init');
const { dbClient } = require('./db/connection');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { createAuditMiddleware } = require('./middleware/audit');
const { authLimiter, globalLimiter, uploadLimiter } = require('./middleware/rateLimiters');
const { csrfProtection } = require('./middleware/csrf');
const { isSupabaseStorageEnabled } = require('./services/storage');

const uploadsPath = process.env.VERCEL
    ? '/tmp/terrasocial-uploads'
    : path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

// ── Security startup checks ─────────────────────────────────────────────
const jwtSecret = process.env.JWT_SECRET || '';
if (jwtSecret.length < 32) {
    console.error('[SECURITY] JWT_SECRET is too short (< 32 chars). Generate with: openssl rand -hex 32');
}
if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jwtSecret)) {
    console.warn('[SECURITY] JWT_SECRET looks like a UUID — use a stronger random secret.');
}
if (allowedOrigins.length === 0) {
    console.warn('[SECURITY] CORS_ORIGIN is not set — all cross-origin requests will be rejected.');
}

let initPromise = null;
function ensureInitialized() {
    if (!initPromise) {
        initPromise = initializeDatabase();
    }
    return initPromise;
}

function buildApp() {
    const app = express();

    // Important derriere Vercel/proxy pour express-rate-limit
    if (process.env.NODE_ENV !== 'test') {
        app.set('trust proxy', true);
    }

    app.use(helmet({
        crossOriginResourcePolicy: false,
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", process.env.SUPABASE_URL, "https://demo.campay.net"].filter(Boolean),
                fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"]
            }
        }
    }));
    app.use(compression());
    app.use(globalLimiter);
    app.use(cors({
        origin(origin, callback) {
            // Allow same-origin requests (no Origin header)
            if (!origin) {
                callback(null, true);
                return;
            }
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error('Origin non autorisee'));
        },
        credentials: true
    }));
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(morgan('dev'));
    app.use(createAuditMiddleware());
    app.use(csrfProtection());

    app.use(async (req, res, next) => {
        try {
            await ensureInitialized();
            next();
        } catch (error) {
            console.error('[INIT] Database initialization failed:', error.message, error.stack);
            next(error);
        }
    });

    const { requireAuth } = require('./middleware/auth');
    app.use('/uploads', requireAuth, express.static(uploadsPath));
    app.use('/api/auth', authLimiter, require('./routes/auth'));
    app.use('/api/public', require('./routes/public'));
    app.use('/api/client', require('./routes/client'));
    app.use('/api/owner', require('./routes/owner'));
    app.use('/api/payments', require('./routes/payments'));
    app.use('/api/documents', uploadLimiter, require('./routes/documents'));
    app.use('/api/admin', require('./routes/admin'));
    app.use('/api/manager', require('./routes/manager'));
    app.use('/api/super-admin', require('./routes/super-admin'));
    app.use('/api/agent', require('./routes/agent'));
    app.use('/api/webhooks', require('./routes/webhooks'));
    app.use('/api/insurer', require('./routes/insurer'));
    app.use('/api/legal', require('./routes/legal'));
    app.use('/api/chat', require('./routes/chat'));

    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            db_client: dbClient,
            storage: isSupabaseStorageEnabled() ? 'supabase' : 'local'
        });
    });

    app.use((err, req, res, next) => {
        if (err?.message === 'Origin non autorisee') {
            return res.status(403).json({ error: err.message });
        }
        if (err?.message === 'Type de fichier non autorisé') {
            return res.status(400).json({ error: err.message });
        }
        if (err?.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Fichier trop volumineux (max 8MB)' });
        }
        console.error('[ERROR]', err.message, err.stack);
        return res.status(500).json({ error: 'Erreur interne serveur' });
    });

    return app;
}

module.exports = {
    buildApp,
    ensureInitialized
};
