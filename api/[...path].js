const { buildApp } = require('../backend/src/app');

const app = buildApp();

module.exports = (req, res) => app(req, res);
