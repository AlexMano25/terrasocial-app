const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Trop de tentatives d'authentification. Reessaie dans quelques minutes."
  }
});

module.exports = {
  authLimiter
};
