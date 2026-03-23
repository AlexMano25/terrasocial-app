const express = require('express');
const { get, run } = require('../db/connection');

const router = express.Router();

// Campay webhook — called by Campay when a payment status changes
router.post('/campay', async (req, res) => {
    try {
        const { status, reference, external_reference, amount, operator } = req.body;

        // Validate webhook secret if configured
        const webhookSecret = process.env.CAMPAY_WEBHOOK_SECRET;
        if (webhookSecret) {
            const signature = req.headers['x-campay-signature'] || '';
            if (signature !== webhookSecret) {
                console.error('[WEBHOOK] Invalid Campay signature');
                return res.status(403).json({ error: 'Invalid signature' });
            }
        }

        if (!reference && !external_reference) {
            return res.status(400).json({ error: 'Missing reference' });
        }

        const paymentRef = external_reference || reference;

        const payment = await get(
            'SELECT * FROM payments WHERE reference = ? AND status = ?',
            [paymentRef, 'pending']
        );

        if (!payment) {
            console.warn('[WEBHOOK] No pending payment found for ref:', paymentRef);
            return res.json({ received: true, matched: false });
        }

        if (status === 'SUCCESSFUL' || status === 'success') {
            await run(
                'UPDATE payments SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['paid', payment.id]
            );

            // Recompute reliability score
            try {
                const { recomputeReliabilityScore } = require('../services/reliability');
                await recomputeReliabilityScore(payment.user_id);
            } catch (e) {
                console.error('[WEBHOOK] Error recomputing score:', e.message);
            }

            console.log('[WEBHOOK] Payment confirmed:', payment.id, paymentRef);
        } else if (status === 'FAILED' || status === 'failed') {
            await run('DELETE FROM payments WHERE id = ?', [payment.id]);
            console.log('[WEBHOOK] Payment failed, deleted:', payment.id);
        }

        return res.json({ received: true, matched: true });
    } catch (error) {
        console.error('[WEBHOOK] Error:', error.message);
        return res.status(500).json({ error: 'Webhook processing error' });
    }
});

module.exports = router;
