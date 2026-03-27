const { sendEmail } = require('./email');
const { get } = require('../db/connection');

/**
 * Generates a sequential invoice number: FAC-YYYY-XXXX
 * Uses the payments table count for the year as a simple sequential counter.
 */
async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    try {
        const row = await get(
            "SELECT COUNT(*) AS cnt FROM payments WHERE status = 'paid' AND strftime('%Y', paid_at) = ?",
            [String(year)]
        );
        const seq = (Number(row?.cnt) || 0) + 1;
        return `FAC-${year}-${String(seq).padStart(4, '0')}`;
    } catch {
        // Fallback: timestamp-based
        const ts = Date.now().toString().slice(-4);
        return `FAC-${year}-${ts}`;
    }
}

/**
 * Escape HTML entities to prevent XSS in email templates
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Format a number as FCFA currency string
 */
function formatCFA(amount) {
    return Number(amount || 0).toLocaleString('fr-FR') + ' FCFA';
}

/**
 * Translate payment method code to human-readable label
 */
function formatMethod(method) {
    const methods = {
        orange_money: 'Orange Money',
        mtn_momo: 'MTN Mobile Money',
        virement: 'Virement bancaire',
        carte: 'Carte bancaire'
    };
    return methods[method] || method || '-';
}

/**
 * Format a date string to French locale
 */
function formatDate(dateStr) {
    if (!dateStr) return new Date().toLocaleDateString('fr-FR');
    try {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

/**
 * Build the professional HTML invoice email
 */
function buildInvoiceHtml({ invoiceNumber, clientName, clientEmail, clientPhone, amount, reference, method, paidAt, lotType, lotPrice }) {
    const safeName = escapeHtml(clientName);
    const safeEmail = escapeHtml(clientEmail);
    const safePhone = escapeHtml(clientPhone);
    const safeRef = escapeHtml(reference);
    const safeInvoice = escapeHtml(invoiceNumber);
    const safeLotType = escapeHtml((lotType || '').toUpperCase());
    const formattedAmount = formatCFA(amount);
    const formattedLotPrice = formatCFA(lotPrice);
    const formattedMethod = escapeHtml(formatMethod(method));
    const formattedDate = escapeHtml(formatDate(paidAt));

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:Arial,Helvetica,sans-serif; max-width:640px; margin:0 auto; padding:0; background:#f4f4f4;">

    <!-- Header -->
    <div style="background:#1B5E20; color:#fff; padding:24px 20px; text-align:center; border-radius:12px 12px 0 0;">
        <h1 style="margin:0; font-size:26px; letter-spacing:1px;">TERRASOCIAL</h1>
        <p style="margin:4px 0 0; opacity:0.85; font-size:14px;">Mano Verde Inc SA</p>
    </div>

    <!-- Invoice title bar -->
    <div style="background:#2E7D32; color:#fff; padding:12px 24px; text-align:center;">
        <h2 style="margin:0; font-size:18px; font-weight:600;">FACTURE DE PAIEMENT</h2>
        <p style="margin:4px 0 0; font-size:14px; opacity:0.9;">${safeInvoice}</p>
    </div>

    <!-- Body -->
    <div style="background:#fff; padding:28px 24px; border:1px solid #e0e0e0; border-top:none;">

        <!-- Client info -->
        <table style="width:100%; margin-bottom:20px; font-size:14px;" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding:4px 0; color:#555;">Client :</td>
                <td style="padding:4px 0; font-weight:bold; text-align:right;">${safeName}</td>
            </tr>
            <tr>
                <td style="padding:4px 0; color:#555;">Email :</td>
                <td style="padding:4px 0; text-align:right;">${safeEmail}</td>
            </tr>
            <tr>
                <td style="padding:4px 0; color:#555;">Telephone :</td>
                <td style="padding:4px 0; text-align:right;">${safePhone || '-'}</td>
            </tr>
            <tr>
                <td style="padding:4px 0; color:#555;">Date :</td>
                <td style="padding:4px 0; text-align:right;">${formattedDate}</td>
            </tr>
        </table>

        <hr style="border:none; border-top:2px solid #E8F5E9; margin:16px 0;">

        <!-- Payment details -->
        <h3 style="color:#1B5E20; margin:16px 0 12px; font-size:16px;">Details du paiement</h3>
        <div style="background:#E8F5E9; padding:16px; border-radius:8px; margin-bottom:16px;">
            <table style="width:100%; font-size:14px;" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="padding:6px 0; color:#333;">Montant paye</td>
                    <td style="padding:6px 0; font-weight:bold; text-align:right; color:#1B5E20; font-size:18px;">${formattedAmount}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0; color:#555;">Mode de paiement</td>
                    <td style="padding:6px 0; text-align:right;">${formattedMethod}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0; color:#555;">Reference</td>
                    <td style="padding:6px 0; text-align:right; font-family:monospace; font-size:13px;">${safeRef}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0; color:#555;">Statut</td>
                    <td style="padding:6px 0; text-align:right;">
                        <span style="background:#1B5E20; color:#fff; padding:3px 12px; border-radius:12px; font-size:12px; font-weight:bold;">PAYE</span>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Reservation info -->
        <h3 style="color:#1B5E20; margin:16px 0 12px; font-size:16px;">Reservation fonciere</h3>
        <div style="background:#FFF8E1; padding:16px; border-radius:8px; border-left:4px solid #F9A825; margin-bottom:20px;">
            <table style="width:100%; font-size:14px;" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="padding:6px 0; color:#555;">Type de lot</td>
                    <td style="padding:6px 0; font-weight:bold; text-align:right;">${safeLotType}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0; color:#555;">Prix total du lot</td>
                    <td style="padding:6px 0; text-align:right;">${formattedLotPrice}</td>
                </tr>
            </table>
        </div>

        <hr style="border:none; border-top:2px solid #E8F5E9; margin:16px 0;">

        <!-- CTA -->
        <p style="text-align:center; margin:24px 0;">
            <a href="https://social.manovende.com/login.html" style="background:#1B5E20; color:#fff; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:bold; display:inline-block; font-size:14px;">
                Voir mon tableau de bord
            </a>
        </p>

        <p style="font-size:13px; color:#666; text-align:center; margin:16px 0 0;">
            Conservez cette facture comme preuve de paiement.
            Pour toute question, contactez-nous.
        </p>
    </div>

    <!-- Footer -->
    <div style="background:#f0f0f0; padding:20px 24px; border-radius:0 0 12px 12px; border:1px solid #e0e0e0; border-top:none; text-align:center;">
        <p style="margin:0 0 6px; font-size:13px; color:#555; font-weight:bold;">MANO VERDE INC SA</p>
        <p style="margin:0 0 4px; font-size:12px; color:#777;">RC/YAO/2024/B/1234 &mdash; Yaounde, Cameroun</p>
        <p style="margin:0 0 4px; font-size:12px; color:#777;">WhatsApp : +237 696 875 895</p>
        <p style="margin:0 0 4px; font-size:12px; color:#777;">Email : support@manovende.com</p>
        <p style="margin:12px 0 0; font-size:11px; color:#999;">
            TERRASOCIAL &mdash; La propriete fonciere accessible a tous
        </p>
    </div>

</body>
</html>`;
}

/**
 * Build the plain text version of the invoice
 */
function buildInvoiceText({ invoiceNumber, clientName, clientEmail, clientPhone, amount, reference, method, paidAt, lotType, lotPrice }) {
    return [
        '=== TERRASOCIAL - FACTURE DE PAIEMENT ===',
        `Facture : ${invoiceNumber}`,
        '',
        `Client : ${clientName}`,
        `Email : ${clientEmail}`,
        `Telephone : ${clientPhone || '-'}`,
        `Date : ${formatDate(paidAt)}`,
        '',
        '--- Details du paiement ---',
        `Montant paye : ${formatCFA(amount)}`,
        `Mode de paiement : ${formatMethod(method)}`,
        `Reference : ${reference}`,
        `Statut : PAYE`,
        '',
        '--- Reservation fonciere ---',
        `Type de lot : ${(lotType || '').toUpperCase()}`,
        `Prix total du lot : ${formatCFA(lotPrice)}`,
        '',
        'Conservez cette facture comme preuve de paiement.',
        '',
        'MANO VERDE INC SA',
        'RC/YAO/2024/B/1234 - Yaounde, Cameroun',
        'WhatsApp : +237 696 875 895',
        'Email : support@manovende.com',
        'TERRASOCIAL - La propriete fonciere accessible a tous'
    ].join('\n');
}

/**
 * Send an invoice email after a payment is confirmed.
 *
 * @param {Object} params
 * @param {Object} params.payment  - Payment record (amount, reference, method, paid_at)
 * @param {Object} params.user     - User record (full_name, email, phone)
 * @param {Object} params.reservation - Reservation record (lot_type, lot_price)
 * @returns {Promise<{success: boolean, invoiceNumber?: string, error?: string}>}
 */
async function sendInvoiceEmail({ payment, user, reservation }) {
    try {
        if (!user?.email) {
            console.warn('[INVOICE-EMAIL] No user email, skipping invoice');
            return { success: false, error: 'No user email' };
        }

        const invoiceNumber = await generateInvoiceNumber();

        const data = {
            invoiceNumber,
            clientName: user.full_name || 'Client',
            clientEmail: user.email,
            clientPhone: user.phone || '',
            amount: payment.amount,
            reference: payment.reference || '-',
            method: payment.method || '-',
            paidAt: payment.paid_at || new Date().toISOString(),
            lotType: reservation?.lot_type || '-',
            lotPrice: reservation?.lot_price || 0
        };

        const html = buildInvoiceHtml(data);
        const text = buildInvoiceText(data);
        const subject = `TERRASOCIAL - Facture ${invoiceNumber} - Paiement de ${formatCFA(payment.amount)} confirme`;

        const result = await sendEmail(
            user.email,
            subject,
            text,
            html
        );

        if (result.success) {
            console.log(`[INVOICE-EMAIL] Invoice ${invoiceNumber} sent to ${user.email}`);
        } else {
            console.error(`[INVOICE-EMAIL] Failed to send invoice ${invoiceNumber}:`, result.error);
        }

        return { ...result, invoiceNumber };
    } catch (error) {
        console.error('[INVOICE-EMAIL] Error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Helper: fetch user + reservation data for a payment and send the invoice.
 * Designed to be called from payment confirmation routes with minimal params.
 *
 * @param {number} paymentId - The payment ID
 * @param {number} userId - The user ID
 * @param {number} [reservationId] - Optional reservation ID (fetched from payment if missing)
 */
async function sendInvoiceForPayment(paymentId, userId, reservationId) {
    try {
        const payment = await get('SELECT * FROM payments WHERE id = ?', [paymentId]);
        if (!payment) {
            console.warn('[INVOICE-EMAIL] Payment not found:', paymentId);
            return { success: false, error: 'Payment not found' };
        }

        const user = await get('SELECT full_name, email, phone FROM users WHERE id = ?', [userId]);
        if (!user) {
            console.warn('[INVOICE-EMAIL] User not found:', userId);
            return { success: false, error: 'User not found' };
        }

        const resId = reservationId || payment.reservation_id;
        let reservation = null;
        if (resId) {
            reservation = await get('SELECT lot_type, lot_price FROM reservations WHERE id = ?', [resId]);
        }

        return sendInvoiceEmail({ payment, user, reservation });
    } catch (error) {
        console.error('[INVOICE-EMAIL] sendInvoiceForPayment error:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendInvoiceEmail,
    sendInvoiceForPayment,
    generateInvoiceNumber
};
