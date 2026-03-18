const nodemailer = require('nodemailer');

// Configuration Gmail SMTP
// Variables d'environnement requises sur Vercel :
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=mothoalex@manovende.com
//   SMTP_PASS=xxxx xxxx xxxx xxxx  (mot de passe d'application Google)
//   SMTP_FROM=TERRASOCIAL <mothoalex@manovende.com>

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
        return null; // SMTP non configuré
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
    });

    return transporter;
}

/**
 * Envoie un email
 * @param {string} to - Adresse email du destinataire
 * @param {string} subject - Sujet
 * @param {string} text - Corps en texte brut
 * @param {string} [html] - Corps en HTML (optionnel)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail(to, subject, text, html) {
    const transport = getTransporter();
    if (!transport) {
        console.warn('[EMAIL] SMTP non configuré (SMTP_USER/SMTP_PASS manquants)');
        return { success: false, error: 'SMTP non configuré' };
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    try {
        const info = await transport.sendMail({
            from,
            to,
            subject,
            text,
            html: html || undefined
        });
        console.log('[EMAIL] Envoyé à', to, '— ID:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur envoi à', to, ':', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Email de bienvenue après validation de réservation
 */
async function sendWelcomeEmail(clientEmail, clientName, data) {
    const { contractNumber, lotType, lotPrice, tempPassword, loginUrl } = data;

    const subject = `✅ TERRASOCIAL — Votre réservation ${contractNumber} est validée !`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto; padding:20px; background:#f9f9f9;">
    <div style="background:#1B5E20; color:#fff; padding:20px; text-align:center; border-radius:12px 12px 0 0;">
        <h1 style="margin:0; font-size:24px;">🏡 TERRASOCIAL</h1>
        <p style="margin:4px 0 0; opacity:0.9;">Mano Verde Inc SA</p>
    </div>
    <div style="background:#fff; padding:24px; border-radius:0 0 12px 12px; border:1px solid #e0e0e0;">
        <h2 style="color:#1B5E20; margin-top:0;">Bonjour ${clientName},</h2>
        <p>Votre réservation foncière a été <strong style="color:#1B5E20;">validée avec succès</strong> !</p>

        <div style="background:#E8F5E9; padding:16px; border-radius:8px; margin:16px 0;">
            <p style="margin:0;"><strong>📋 Contrat :</strong> ${contractNumber}</p>
            <p style="margin:6px 0 0;"><strong>🏡 Lot :</strong> ${(lotType || '').toUpperCase()}</p>
            <p style="margin:6px 0 0;"><strong>💰 Prix :</strong> ${Number(lotPrice || 0).toLocaleString('fr-FR')} FCFA</p>
        </div>

        ${tempPassword ? `
        <div style="background:#FFF3E0; padding:16px; border-radius:8px; margin:16px 0; border-left:4px solid #FF9800;">
            <p style="margin:0; font-weight:bold; color:#E65100;">🔐 Vos accès client</p>
            <p style="margin:6px 0 0;">Email : <strong>${clientEmail}</strong></p>
            <p style="margin:6px 0 0;">Mot de passe : <strong>${tempPassword}</strong></p>
            <p style="margin:10px 0 0; font-size:13px; color:#666;">Changez votre mot de passe après la première connexion.</p>
        </div>
        <p style="text-align:center; margin:20px 0;">
            <a href="${loginUrl || 'https://social.manovende.com/login.html'}" style="background:#1B5E20; color:#fff; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:bold; display:inline-block;">
                Accéder à mon espace client →
            </a>
        </p>
        ` : ''}

        <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
        <p style="font-size:13px; color:#666;">
            Vous pouvez commencer vos versements dès maintenant via Orange Money, MTN MoMo ou carte bancaire depuis votre tableau de bord client.
        </p>
        <p style="font-size:13px; color:#666;">
            Pour toute question, contactez-nous par WhatsApp ou email.
        </p>
        <p style="margin-top:20px; font-size:13px; color:#999; text-align:center;">
            TERRASOCIAL — Mano Verde Inc SA<br>
            La propriété foncière accessible à tous
        </p>
    </div>
</body>
</html>`;

    const text = `Bonjour ${clientName},\n\nVotre réservation TERRASOCIAL a été validée !\n\nContrat : ${contractNumber}\nLot : ${(lotType || '').toUpperCase()}\nPrix : ${Number(lotPrice || 0).toLocaleString('fr-FR')} FCFA\n\n${tempPassword ? `Vos accès :\nEmail : ${clientEmail}\nMot de passe : ${tempPassword}\nConnexion : ${loginUrl || 'https://social.manovende.com/login.html'}\n\n` : ''}Merci de votre confiance !\nTERRASOCIAL — Mano Verde Inc SA`;

    return sendEmail(clientEmail, subject, text, html);
}

function isSmtpConfigured() {
    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

module.exports = {
    sendEmail,
    sendWelcomeEmail,
    isSmtpConfigured
};
