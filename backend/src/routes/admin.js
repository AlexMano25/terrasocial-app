const express = require('express');
const { all } = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole(['admin']));

router.get('/audit-logs', async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 100, 500);
        const rows = await all(
            `SELECT id, user_id, action, method, path, ip_address, user_agent, metadata, created_at
             FROM audit_logs
             ORDER BY id DESC
             LIMIT ?`,
            [limit]
        );
        return res.json({ logs: rows });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture audit logs' });
    }
});

module.exports = router;
