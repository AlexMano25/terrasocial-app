const rateLimit = require('express-rate-limit');

const limiterBase = {
    standardHeaders: true,
    legacyHeaders: false
};

const globalLimiter = rateLimit({
    ...limiterBase,
    windowMs: 15 * 60 * 1000,
    max: 400,
    message: { error: 'Trop de requetes, reessayez plus tard.' }
});

const authLimiter = rateLimit({
    ...limiterBase,
    windowMs: 15 * 60 * 1000,
    max: 15,
    skipSuccessfulRequests: true,
    message: { error: "Trop de tentatives d'authentification." }
});

const uploadLimiter = rateLimit({
    ...limiterBase,
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: { error: "Trop d'uploads, reessayez plus tard." }
});

const resetLimiter = rateLimit({
    ...limiterBase,
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Trop de demandes de reinitialisation.' }
});

module.exports = {
    globalLimiter,
    authLimiter,
    uploadLimiter,
    resetLimiter
};
