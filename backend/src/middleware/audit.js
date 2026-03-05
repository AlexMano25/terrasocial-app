const { run } = require('../db/connection');

function createAuditMiddleware() {
    return (req, res, next) => {
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
                // Silent fail to avoid blocking functional flow.
            }
        };

        next();
    };
}

module.exports = {
    createAuditMiddleware
};
