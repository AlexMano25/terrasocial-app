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
const { createAuditMiddleware } = require('./middleware/audit');
const { authLimiter, globalLimiter, uploadLimiter } = require('./middleware/rateLimiters');
const { isSupabaseStorageEnabled } = require('./services/storage');

const uploadsPath = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(globalLimiter);
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('Origin non autorisee'));
    }
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(createAuditMiddleware());

app.use('/uploads', express.static(uploadsPath));
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/client', require('./routes/client'));
app.use('/api/owner', require('./routes/owner'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/documents', uploadLimiter, require('./routes/documents'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/super-admin', require('./routes/super-admin'));

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
    return res.status(500).json({ error: 'Erreur interne serveur' });
});

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            // eslint-disable-next-line no-console
            console.log(`TERRASOCIAL backend running on http://localhost:${PORT} (db=${dbClient}, storage=${isSupabaseStorageEnabled() ? 'supabase' : 'local'})`);
        });
    })
    .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Database initialization failed:', error);
        process.exit(1);
    });
