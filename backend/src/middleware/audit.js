const { run } = require('../db/connection');
const logger = require('../utils/logger');

function createAuditMiddleware() {
    return (req, res, next) => {
        const startTime = Date.now();

        req.audit = async (action, metadata) => {
            try {
                await run(
                    `INSERT INTO audit_logs(user_id, action, method, path, ip_address, user_agent, metadata)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        req.user?.id || null,
                        action,
                        req.method,
                        req.path,
                        req.ip,
                        req.headers['user-agent'] || null,
                        metadata ? JSON.stringify(metadata) : null
                    ]
                );
            } catch (error) {
                logger.error('audit_log_failed', { action, error: error.message });
            }
        };

        res.on('finish', () => {
            const duration = Date.now() - startTime;
            if (req.path.startsWith('/api/')) {
                logger.info('request_completed', {
                    method: req.method,
                    path: req.path,
                    status: res.statusCode,
                    duration_ms: duration,
                    user_id: req.user?.id || null
                });
            }
        });

        next();
    };
}

module.exports = {
    createAuditMiddleware
};
