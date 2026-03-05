const { get, run } = require('../db/connection');

async function recomputeReliabilityScore(userId) {
    const stats = await get(
        `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
            SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late_count
         FROM payments
         WHERE user_id = ?`,
        [userId]
    );

    const total = stats?.total || 0;
    if (total === 0) {
        await run('UPDATE users SET reliability_score = ? WHERE id = ?', [100, userId]);
        return 100;
    }

    const paidCount = stats?.paid_count || 0;
    const lateCount = stats?.late_count || 0;

    let score = Math.round((paidCount / total) * 100) - (lateCount * 5);
    if (score < 0) score = 0;
    if (score > 100) score = 100;

    await run('UPDATE users SET reliability_score = ? WHERE id = ?', [score, userId]);
    return score;
}

module.exports = {
    recomputeReliabilityScore
};
