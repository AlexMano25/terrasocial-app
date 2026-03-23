// Set env vars BEFORE requiring app
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-enough';
process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';

const { buildApp, ensureInitialized } = require('../src/app');

let app;

async function getApp() {
    if (!app) {
        app = buildApp();
        await ensureInitialized();
    }
    return app;
}

module.exports = { getApp };
