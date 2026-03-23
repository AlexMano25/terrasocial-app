let app;
try {
    const { buildApp } = require('../backend/src/app');
    app = buildApp();
} catch (err) {
    console.error('[FATAL] App build failed:', err.message, err.stack);
    app = null;
}

module.exports = (req, res) => {
    if (!app) {
        return res.status(500).json({ error: 'App failed to initialize. Check build logs.' });
    }
    return app(req, res);
};
