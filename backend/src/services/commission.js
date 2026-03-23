const { get, run, all } = require('../db/connection');

// Commission grid: based on number of active referrals
const COMMISSION_GRID = [
    { min: 26, max: 50, rate: 5 },
    { min: 11, max: 25, rate: 4 },
    { min: 6, max: 10, rate: 3 },
    { min: 3, max: 5, rate: 2 },
    { min: 1, max: 2, rate: 1 }
];

async function getCommissionRate(agentId) {
    const result = await get(
        "SELECT COUNT(*) as count FROM referrals WHERE agent_id = ? AND status = 'active'",
        [agentId]
    );
    const count = Number(result?.count || 0);
    for (const tier of COMMISSION_GRID) {
        if (count >= tier.min && count <= tier.max) return tier.rate;
    }
    if (count > 50) return 5; // cap at 5%
    return 0;
}

async function createCommission(agentId, paymentId, paymentAmount) {
    // Check for duplicate
    const existing = await get(
        'SELECT id FROM agent_commissions WHERE agent_id = ? AND source_payment_id = ?',
        [agentId, paymentId]
    );
    if (existing) return null;

    const rate = await getCommissionRate(agentId);
    if (rate <= 0) return null;

    const amount = Math.round(paymentAmount * rate / 100);
    if (amount <= 0) return null;

    const result = await run(
        `INSERT INTO agent_commissions(agent_id, source_payment_id, amount, rate_percent, commission_type, status)
         VALUES (?, ?, ?, ?, 'client_subscription', 'pending')`,
        [agentId, paymentId, amount, rate]
    );

    return { id: result.id, amount, rate };
}

async function getAgentBalance(agentId) {
    const earned = await get(
        "SELECT COALESCE(SUM(amount), 0) as total FROM agent_commissions WHERE agent_id = ? AND status IN ('pending', 'approved')",
        [agentId]
    );
    const withdrawn = await get(
        "SELECT COALESCE(SUM(amount), 0) as total FROM agent_withdrawals WHERE agent_id = ? AND status IN ('pending', 'approved', 'paid')",
        [agentId]
    );
    const totalEarned = await get(
        "SELECT COALESCE(SUM(amount), 0) as total FROM agent_commissions WHERE agent_id = ?",
        [agentId]
    );
    const totalPaid = await get(
        "SELECT COALESCE(SUM(net_amount), 0) as total FROM agent_withdrawals WHERE agent_id = ? AND status = 'paid'",
        [agentId]
    );

    return {
        available: Number(earned?.total || 0) - Number(withdrawn?.total || 0),
        total_earned: Number(totalEarned?.total || 0),
        total_paid: Number(totalPaid?.total || 0),
        pending_withdrawals: Number(withdrawn?.total || 0) - Number(totalPaid?.total || 0)
    };
}

module.exports = { getCommissionRate, createCommission, getAgentBalance, COMMISSION_GRID };
