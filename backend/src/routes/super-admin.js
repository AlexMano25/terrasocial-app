const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { all, get, run } = require('../db/connection');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { sanitizeOptionalText, sanitizeText, normalizeEmail, parsePositiveInt, isValidPhone } = require('../utils/validation');
const { sendWelcomeEmail, isSmtpConfigured } = require('../services/email');

const uploadsPath = process.env.VERCEL
    ? '/tmp/terrasocial-uploads'
    : path.join(__dirname, '..', '..', 'uploads');

const router = express.Router();

router.use(requireAuth, requireSuperAdmin);

function parseDateRange(from, to) {
    const fromSafe = from ? new Date(from) : null;
    const toSafe = to ? new Date(to) : null;
    if (fromSafe && Number.isNaN(fromSafe.getTime())) return { error: 'Date from invalide' };
    if (toSafe && Number.isNaN(toSafe.getTime())) return { error: 'Date to invalide' };
    return { fromSafe, toSafe };
}

function safeParseFeatures(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => sanitizeText(String(item), 120)).filter(Boolean);
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => sanitizeText(String(item), 120)).filter(Boolean);
            }
        } catch (error) {
            return value.split(',').map((item) => sanitizeText(item, 120)).filter(Boolean);
        }
    }
    return [];
}

router.get('/overview', async (req, res) => {
    try {
        const usersByRole = await all(
            `SELECT role, COUNT(*) AS total
             FROM users
             GROUP BY role`
        );

        const financeRow = await get(
            `SELECT
                COALESCE(SUM(amount), 0) AS revenue_total,
                COUNT(*) AS payments_count
             FROM payments
             WHERE status = ?`,
            ['paid']
        );

        const pendingRow = await get(
            `SELECT COUNT(*) AS pending_reservations
             FROM reservations
             WHERE status = ?`,
            ['pending']
        );

        const monthlyRevenue = await all(
            `SELECT SUBSTR(CAST(paid_at AS TEXT), 1, 7) AS month, COALESCE(SUM(amount), 0) AS amount
             FROM payments
             WHERE status = ?
             GROUP BY SUBSTR(CAST(paid_at AS TEXT), 1, 7)
             ORDER BY month ASC`,
            ['paid']
        );

        const monthlyUsers = await all(
            `SELECT SUBSTR(CAST(created_at AS TEXT), 1, 7) AS month, COUNT(*) AS total
             FROM users
             GROUP BY SUBSTR(CAST(created_at AS TEXT), 1, 7)
             ORDER BY month ASC`
        );

        const roadmap = await get('SELECT * FROM roadmap_status ORDER BY id DESC LIMIT 1');

        return res.json({
            users_by_role: usersByRole,
            revenue_total: Number(financeRow?.revenue_total || 0),
            payments_count: Number(financeRow?.payments_count || 0),
            pending_reservations: Number(pendingRow?.pending_reservations || 0),
            monthly_revenue: monthlyRevenue,
            monthly_users: monthlyUsers,
            roadmap
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement overview super admin' });
    }
});

router.get('/users', async (req, res) => {
    try {
        const role = sanitizeOptionalText(req.query.role, 30);
        const q = sanitizeOptionalText(req.query.q, 120);
        const status = sanitizeOptionalText(req.query.status, 20);
        const { fromSafe, toSafe, error } = parseDateRange(req.query.from, req.query.to);
        if (error) return res.status(400).json({ error });

        const users = await all(
            `SELECT id, role, full_name, email, phone, city, reliability_score, created_at
             FROM users
             ORDER BY id DESC`
        );

        const filtered = users.filter((u) => {
            if (role && u.role !== role) return false;
            if (status === 'active' && Number(u.reliability_score || 0) <= 0) return false;
            if (status === 'low_activity' && Number(u.reliability_score || 0) > 60) return false;
            if (q) {
                const hay = `${u.full_name || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase();
                if (!hay.includes(q.toLowerCase())) return false;
            }
            const created = new Date(u.created_at);
            if (fromSafe && created < fromSafe) return false;
            if (toSafe && created > toSafe) return false;
            return true;
        });

        return res.json({ users: filtered });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture utilisateurs' });
    }
});

router.post('/users', async (req, res) => {
    try {
        const role = sanitizeText(req.body.role, 30);
        const fullName = sanitizeText(req.body.full_name, 120);
        const email = normalizeEmail(req.body.email);
        const phone = sanitizeOptionalText(req.body.phone, 30);
        const city = sanitizeOptionalText(req.body.city, 80);
        const passwordHash = sanitizeText(req.body.password_hash || 'manual_reset_required', 255);

        if (!['client', 'owner', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'role invalide' });
        }
        if (!fullName || !email) {
            return res.status(400).json({ error: 'full_name et email requis' });
        }

        const exists = await get('SELECT id FROM users WHERE email = ?', [email]);
        if (exists) return res.status(409).json({ error: 'Email deja existant' });

        const result = await run(
            `INSERT INTO users(role, full_name, email, phone, city, password_hash)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [role, fullName, email, phone, city, passwordHash]
        );

        await req.audit?.('super_admin.user_created', { actor_id: req.user.id, user_id: result.id, role });
        return res.status(201).json({ id: result.id });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur creation utilisateur' });
    }
});

router.put('/users/:id', async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (!userId) return res.status(400).json({ error: 'ID invalide' });

        const role = sanitizeText(req.body.role, 30);
        const fullName = sanitizeText(req.body.full_name, 120);
        const phone = sanitizeOptionalText(req.body.phone, 30);
        const city = sanitizeOptionalText(req.body.city, 80);
        const score = Number(req.body.reliability_score);

        if (!['client', 'owner', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'role invalide' });
        }
        if (!fullName || Number.isNaN(score)) {
            return res.status(400).json({ error: 'full_name et reliability_score requis' });
        }

        await run(
            `UPDATE users
             SET role = ?, full_name = ?, phone = ?, city = ?, reliability_score = ?
             WHERE id = ?`,
            [role, fullName, phone, city, score, userId]
        );

        await req.audit?.('super_admin.user_updated', { actor_id: req.user.id, user_id: userId });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise a jour utilisateur' });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (!userId) return res.status(400).json({ error: 'ID invalide' });
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Suppression de votre propre compte interdite' });
        }

        const superAdminRef = await get('SELECT id FROM super_admins WHERE user_id = ?', [userId]);
        if (superAdminRef) {
            return res.status(400).json({ error: 'Impossible de supprimer un compte super admin' });
        }

        await run('DELETE FROM users WHERE id = ?', [userId]);
        await req.audit?.('super_admin.user_deleted', { actor_id: req.user.id, user_id: userId });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur suppression utilisateur' });
    }
});

router.get('/users/:id/history', async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (!userId) return res.status(400).json({ error: 'ID invalide' });

        const logs = await all(
            `SELECT id, action, method, path, metadata, created_at
             FROM audit_logs
             WHERE user_id = ?
             ORDER BY id DESC
             LIMIT 200`,
            [userId]
        );

        const payments = await all(
            `SELECT id, amount, status, method, reference, paid_at
             FROM payments
             WHERE user_id = ?
             ORDER BY id DESC
             LIMIT 100`,
            [userId]
        );

        return res.json({ logs, payments });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur historique utilisateur' });
    }
});

router.post('/messages', async (req, res) => {
    try {
        const targetScope = sanitizeText(req.body.target_scope, 20);
        const targetRole = sanitizeOptionalText(req.body.target_role, 20);
        const targetUserId = req.body.target_user_id ? Number(req.body.target_user_id) : null;
        const content = sanitizeText(req.body.content, 2000);
        const channels = Array.isArray(req.body.channels) ? req.body.channels.join(',') : 'in_app';

        if (!['all', 'role', 'user'].includes(targetScope)) {
            return res.status(400).json({ error: 'target_scope invalide' });
        }
        if (!content) return res.status(400).json({ error: 'Message requis' });

        // Collecter les destinataires email
        let recipients = [];
        if (targetScope === 'user' && targetUserId) {
            const u = await get('SELECT id, full_name, email FROM users WHERE id = ?', [targetUserId]);
            if (!u) return res.status(400).json({ error: 'Utilisateur #' + targetUserId + ' introuvable' });
            if (u.email) recipients.push(u);
        } else if (targetScope === 'role' && targetRole) {
            recipients = await all('SELECT id, full_name, email FROM users WHERE role = ?', [targetRole]);
        } else if (targetScope === 'all') {
            recipients = await all('SELECT id, full_name, email FROM users WHERE email IS NOT NULL');
        }

        // Sauvegarder le message
        const result = await run(
            `INSERT INTO admin_messages(sender_user_id, target_scope, target_role, target_user_id, content, channels, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, targetScope, targetRole, targetUserId, content, channels, 'sending']
        );

        // Envoi réel des emails si le canal email est sélectionné
        let emailsSent = 0;
        let emailErrors = [];
        if (channels.includes('email') && recipients.length > 0) {
            const { sendEmail, isSmtpConfigured } = require('../services/email');
            if (isSmtpConfigured()) {
                for (const recipient of recipients) {
                    if (recipient.email && !recipient.email.includes('@terrasocial.cm') && !recipient.email.includes('@example.com')) {
                        try {
                            const emailResult = await sendEmail(
                                recipient.email,
                                'TERRASOCIAL — Message de la direction',
                                content,
                                `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                                    <div style="background:#1B5E20;color:#fff;padding:16px;text-align:center;border-radius:8px 8px 0 0;">
                                        <h2 style="margin:0;">🏡 TERRASOCIAL</h2>
                                    </div>
                                    <div style="padding:20px;background:#fff;border:1px solid #e0e0e0;border-radius:0 0 8px 8px;">
                                        <p>Bonjour <strong>${recipient.full_name}</strong>,</p>
                                        <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;white-space:pre-wrap;">${content}</div>
                                        <hr style="border:none;border-top:1px solid #eee;">
                                        <p style="font-size:12px;color:#999;text-align:center;">TERRASOCIAL — Mano Verde Inc SA</p>
                                    </div>
                                </div>`
                            );
                            if (emailResult.success) emailsSent++;
                            else emailErrors.push(recipient.email + ': ' + emailResult.error);
                        } catch (e) { emailErrors.push(recipient.email + ': ' + e.message); }
                    }
                }
            } else {
                emailErrors.push('SMTP non configuré sur le serveur');
            }
        }

        // Mettre à jour le statut
        const finalStatus = emailsSent > 0 ? 'sent' : (channels.includes('email') ? 'partial' : 'queued');
        await run('UPDATE admin_messages SET status = ? WHERE id = ?', [finalStatus, result.id]);

        await req.audit?.('super_admin.message_broadcast', { actor_id: req.user.id, message_id: result.id, target_scope: targetScope, emails_sent: emailsSent });
        return res.status(201).json({
            id: result.id,
            status: finalStatus,
            emails_sent: emailsSent,
            recipients_count: recipients.length,
            errors: emailErrors.length > 0 ? emailErrors : undefined
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur envoi message: ' + (error.message || 'Vérifiez que l\'ID utilisateur existe') });
    }
});

router.get('/messages', async (req, res) => {
    try {
        const rows = await all(
            `SELECT id, sender_user_id, target_scope, target_role, target_user_id, content, channels, status, created_at
             FROM admin_messages
             ORDER BY id DESC
             LIMIT 300`
        );
        return res.json({ messages: rows });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture messages' });
    }
});

router.get('/documents', async (req, res) => {
    try {
        const typeFilter = sanitizeOptionalText(req.query.type, 50);
        const userFilter = req.query.user_id ? Number(req.query.user_id) : null;
        const search = sanitizeOptionalText(req.query.q, 100);

        let sql = `SELECT d.id, d.user_id, d.document_type, d.file_name, d.file_path, d.storage_mode, d.public_url, d.uploaded_at,
                          u.full_name AS user_name, u.email AS user_email, u.phone AS user_phone, u.role AS user_role
                   FROM documents d
                   LEFT JOIN users u ON d.user_id = u.id`;
        const conditions = [];
        const params = [];

        if (typeFilter) { conditions.push('d.document_type = ?'); params.push(typeFilter); }
        if (userFilter) { conditions.push('d.user_id = ?'); params.push(userFilter); }
        if (search) { conditions.push('(d.file_name LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

        if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY d.id DESC LIMIT 500';

        const docs = await all(sql, params);

        // Collecter les types distincts pour le filtre frontend
        const types = await all('SELECT DISTINCT document_type FROM documents ORDER BY document_type');

        return res.json({ documents: docs, document_types: types.map(t => t.document_type) });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture documents admin' });
    }
});

router.get('/documents/:id/download', async (req, res) => {
    try {
        const docId = Number(req.params.id);
        if (!docId) return res.status(400).json({ error: 'ID invalide' });

        const doc = await get('SELECT * FROM documents WHERE id = ?', [docId]);
        if (!doc) return res.status(404).json({ error: 'Document introuvable' });

        await req.audit?.('super_admin.document_downloaded', { actor_id: req.user.id, document_id: docId });

        // Cas Supabase Storage : rediriger vers l'URL publique ou signée
        if (doc.storage_mode === 'supabase' && doc.public_url) {
            return res.redirect(doc.public_url);
        }

        // Cas stockage local : streamer le fichier
        const localPath = path.join(uploadsPath, path.basename(doc.file_path || doc.file_name));
        if (!fs.existsSync(localPath)) {
            return res.status(404).json({ error: 'Fichier introuvable sur le serveur' });
        }

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.file_name)}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        return fs.createReadStream(localPath).pipe(res);
    } catch (error) {
        return res.status(500).json({ error: 'Erreur téléchargement document' });
    }
});

router.put('/documents/:id', async (req, res) => {
    try {
        const docId = Number(req.params.id);
        const docType = sanitizeText(req.body.document_type, 80);
        if (!docId || !docType) return res.status(400).json({ error: 'id/document_type invalides' });

        await run('UPDATE documents SET document_type = ? WHERE id = ?', [docType, docId]);
        await req.audit?.('super_admin.document_updated', { actor_id: req.user.id, document_id: docId });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise a jour document' });
    }
});

router.delete('/documents/:id', async (req, res) => {
    try {
        const docId = Number(req.params.id);
        if (!docId) return res.status(400).json({ error: 'ID invalide' });

        await run('DELETE FROM documents WHERE id = ?', [docId]);
        await req.audit?.('super_admin.document_deleted', { actor_id: req.user.id, document_id: docId });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur suppression document' });
    }
});

router.get('/lots', async (req, res) => {
    try {
        const rows = await all(
            `SELECT id, title, location, size_m2, price, monthly_amount, duration_months, icon, features, status, display_order, updated_at
             FROM available_lots
             ORDER BY display_order ASC, id ASC`
        );
        const lots = rows.map((row) => Object.assign({}, row, { features: safeParseFeatures(row.features) }));
        return res.json({ lots });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture lots' });
    }
});

router.post('/lots', async (req, res) => {
    try {
        const title = sanitizeText(req.body.title, 120);
        const location = sanitizeText(req.body.location, 120);
        const sizeM2 = parsePositiveInt(req.body.size_m2);
        const price = parsePositiveInt(req.body.price);
        const monthlyAmount = parsePositiveInt(req.body.monthly_amount) || null;
        const durationMonths = parsePositiveInt(req.body.duration_months) || null;
        const icon = sanitizeOptionalText(req.body.icon, 8) || '🏡';
        const status = sanitizeOptionalText(req.body.status, 20) || 'available';
        const displayOrder = Number(req.body.display_order || 0);
        const features = safeParseFeatures(req.body.features);

        if (!title || !location || !sizeM2 || !price) {
            return res.status(400).json({ error: 'title, location, size_m2, price requis' });
        }
        if (!['available', 'reserved', 'archived'].includes(status)) {
            return res.status(400).json({ error: 'status invalide' });
        }

        const result = await run(
            `INSERT INTO available_lots(title, location, size_m2, price, monthly_amount, duration_months, icon, features, status, display_order, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [title, location, sizeM2, price, monthlyAmount, durationMonths, icon, JSON.stringify(features), status, Number.isFinite(displayOrder) ? displayOrder : 0]
        );

        await req.audit?.('super_admin.lot_created', { actor_id: req.user.id, lot_id: result.id });
        return res.status(201).json({ id: result.id });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur creation lot' });
    }
});

router.put('/lots/:id', async (req, res) => {
    try {
        const lotId = Number(req.params.id);
        if (!lotId) return res.status(400).json({ error: 'ID lot invalide' });

        const title = sanitizeText(req.body.title, 120);
        const location = sanitizeText(req.body.location, 120);
        const sizeM2 = parsePositiveInt(req.body.size_m2);
        const price = parsePositiveInt(req.body.price);
        const monthlyAmount = parsePositiveInt(req.body.monthly_amount) || null;
        const durationMonths = parsePositiveInt(req.body.duration_months) || null;
        const icon = sanitizeOptionalText(req.body.icon, 8) || '🏡';
        const status = sanitizeOptionalText(req.body.status, 20) || 'available';
        const displayOrder = Number(req.body.display_order || 0);
        const features = safeParseFeatures(req.body.features);

        if (!title || !location || !sizeM2 || !price) {
            return res.status(400).json({ error: 'title, location, size_m2, price requis' });
        }
        if (!['available', 'reserved', 'archived'].includes(status)) {
            return res.status(400).json({ error: 'status invalide' });
        }

        await run(
            `UPDATE available_lots
             SET title = ?, location = ?, size_m2 = ?, price = ?, monthly_amount = ?, duration_months = ?, icon = ?, features = ?, status = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [title, location, sizeM2, price, monthlyAmount, durationMonths, icon, JSON.stringify(features), status, Number.isFinite(displayOrder) ? displayOrder : 0, lotId]
        );

        await req.audit?.('super_admin.lot_updated', { actor_id: req.user.id, lot_id: lotId });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise a jour lot' });
    }
});

router.delete('/lots/:id', async (req, res) => {
    try {
        const lotId = Number(req.params.id);
        if (!lotId) return res.status(400).json({ error: 'ID lot invalide' });
        await run('DELETE FROM available_lots WHERE id = ?', [lotId]);
        await req.audit?.('super_admin.lot_deleted', { actor_id: req.user.id, lot_id: lotId });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur suppression lot' });
    }
});

router.get('/payments/:userId/export-pdf', async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        if (!userId) return res.status(400).json({ error: 'ID utilisateur invalide' });

        const user = await get('SELECT id, full_name, email FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

        const payments = await all(
            `SELECT amount, method, status, reference, paid_at
             FROM payments
             WHERE user_id = ?
             ORDER BY id DESC`,
            [userId]
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="historique-paiements-${userId}.pdf"`);

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        doc.pipe(res);

        doc.fontSize(18).text('TERRASOCIAL - Historique de Paiements', { align: 'left' });
        doc.moveDown(0.5);
        doc.fontSize(11).text(`Client: ${user.full_name} (${user.email})`);
        doc.text(`Date: ${new Date().toISOString()}`);
        doc.moveDown();

        let total = 0;
        payments.forEach((p, index) => {
            total += Number(p.amount || 0);
            doc.fontSize(10).text(
                `${index + 1}. ${p.reference || '-'} | ${Number(p.amount || 0).toLocaleString('fr-FR')} FCFA | ${p.method} | ${p.status} | ${p.paid_at || '-'}`
            );
        });

        doc.moveDown();
        doc.fontSize(12).text(`Total: ${total.toLocaleString('fr-FR')} FCFA`);
        doc.end();

        await req.audit?.('super_admin.payment_history_exported', { actor_id: req.user.id, user_id: userId, rows: payments.length });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur export PDF' });
    }
});

router.get('/roadmap', async (req, res) => {
    try {
        const latest = await get('SELECT * FROM roadmap_status ORDER BY id DESC LIMIT 1');
        return res.json({ roadmap: latest });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture roadmap' });
    }
});

router.put('/roadmap', async (req, res) => {
    try {
        const versionLabel = sanitizeText(req.body.version_label, 60);
        const deploymentStatus = sanitizeOptionalText(req.body.deployment_status, 60);
        const notes = sanitizeOptionalText(req.body.notes, 4000);

        if (!versionLabel) return res.status(400).json({ error: 'version_label requis' });

        await run(
            `INSERT INTO roadmap_status(version_label, deployment_status, notes, updated_by)
             VALUES (?, ?, ?, ?)`,
            [versionLabel, deploymentStatus, notes, req.user.id]
        );

        await req.audit?.('super_admin.roadmap_updated', { actor_id: req.user.id, version: versionLabel });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise a jour roadmap' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// RÉSERVATIONS / LEADS — Workflow complet
// ══════════════════════════════════════════════════════════════════════════════

// Liste toutes les réservations (leads inclus)
router.get('/reservations', async (req, res) => {
    try {
        const status = sanitizeOptionalText(req.query.status, 30);
        let sql = `SELECT r.*, u.full_name AS client_name, u.email AS client_email, u.phone AS client_phone
                    FROM reservations r
                    LEFT JOIN users u ON r.user_id = u.id
                    ORDER BY r.id DESC LIMIT 500`;
        let params = [];

        if (status) {
            sql = `SELECT r.*, u.full_name AS client_name, u.email AS client_email, u.phone AS client_phone
                   FROM reservations r
                   LEFT JOIN users u ON r.user_id = u.id
                   WHERE r.status = ?
                   ORDER BY r.id DESC LIMIT 500`;
            params = [status];
        }

        const rows = await all(sql, params);
        return res.json({ reservations: rows });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture réservations' });
    }
});

// Détails d'une réservation
router.get('/reservations/:id', async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalide' });

        const reservation = await get(
            `SELECT r.*, u.full_name AS client_name, u.email AS client_email, u.phone AS client_phone, u.city AS client_city
             FROM reservations r
             LEFT JOIN users u ON r.user_id = u.id
             WHERE r.id = ?`, [id]
        );
        if (!reservation) return res.status(404).json({ error: 'Réservation introuvable' });

        const payments = await all(
            'SELECT * FROM payments WHERE reservation_id = ? ORDER BY paid_at DESC', [id]
        );
        const contract = await get(
            'SELECT * FROM contracts WHERE reservation_id = ? ORDER BY id DESC LIMIT 1', [id]
        );

        return res.json({ reservation, payments, contract });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture réservation' });
    }
});

// Valider un lead → créer compte client + activer réservation
router.post('/reservations/:id/validate', async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalide' });

        const reservation = await get('SELECT * FROM reservations WHERE id = ?', [id]);
        if (!reservation) return res.status(404).json({ error: 'Réservation introuvable' });
        if (reservation.status !== 'lead' && reservation.status !== 'pending') {
            return res.status(400).json({ error: 'Cette réservation est déjà traitée (statut: ' + reservation.status + ')' });
        }

        const { full_name, phone, email, city } = req.body;
        const safeName = sanitizeText(full_name, 120);
        const safePhone = sanitizeText(phone, 30);
        const safeEmail = normalizeEmail(email);
        const safeCity = sanitizeOptionalText(city, 80);

        if (!safeName || !safePhone) {
            return res.status(400).json({ error: 'Nom et téléphone du client requis' });
        }

        let userId = reservation.user_id;

        // Si pas d'utilisateur lié (lead public), créer un compte client
        if (!userId) {
            // Vérifier si email déjà pris
            if (safeEmail) {
                const existing = await get('SELECT id FROM users WHERE email = ?', [safeEmail]);
                if (existing) {
                    // Lier à l'utilisateur existant
                    userId = existing.id;
                } else {
                    // Créer nouveau compte
                    const tempPassword = 'TS' + Date.now().toString(36) + '!' + Math.random().toString(36).slice(2, 6).toUpperCase();
                    const passwordHash = await bcrypt.hash(tempPassword, 10);
                    const created = await run(
                        'INSERT INTO users(role, full_name, email, phone, city, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
                        ['client', safeName, safeEmail || `lead.${id}@terrasocial.cm`, safePhone, safeCity || '', passwordHash]
                    );
                    userId = created.id;

                    // Stocker le mot de passe temporaire dans la réponse (admin le communique au client)
                    res.locals.tempPassword = tempPassword;
                }
            } else {
                // Pas d'email → créer avec email généré
                const tempPassword = 'TS' + Date.now().toString(36) + '!' + Math.random().toString(36).slice(2, 6).toUpperCase();
                const passwordHash = await bcrypt.hash(tempPassword, 10);
                const generatedEmail = `client.${id}.${Date.now()}@terrasocial.cm`;
                const created = await run(
                    'INSERT INTO users(role, full_name, email, phone, city, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
                    ['client', safeName, generatedEmail, safePhone, safeCity || '', passwordHash]
                );
                userId = created.id;
                res.locals.tempPassword = tempPassword;
            }
        }

        // Activer la réservation
        await run(
            'UPDATE reservations SET user_id = ?, status = ? WHERE id = ?',
            [userId, 'active', id]
        );

        // Générer un numéro de contrat
        const contractNumber = 'TS-CTR-' + String(id).padStart(5, '0') + '-' + new Date().getFullYear();
        const existingContract = await get('SELECT id FROM contracts WHERE reservation_id = ?', [id]);
        if (!existingContract) {
            await run(
                'INSERT INTO contracts(user_id, reservation_id, contract_number, contract_type, status, signed_at) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, id, contractNumber, 'reservation', 'draft', null]
            );
        }

        await req.audit?.('super_admin.reservation_validated', { actor_id: req.user.id, reservation_id: id, user_id: userId });

        // Notification in-app
        const notifContent = `Votre réservation ${contractNumber} a été validée. Lot : ${(reservation.lot_type || '').toUpperCase()} — ${Number(reservation.lot_price || 0).toLocaleString('fr-FR')} FCFA.`;
        try {
            await run(
                `INSERT INTO admin_messages(sender_user_id, target_scope, target_role, target_user_id, content, channels, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [req.user.id, 'user', null, userId, notifContent, 'in_app', 'queued']
            );
        } catch (msgErr) { /* non-bloquant */ }

        // Envoi email réel via SMTP
        let emailResult = { success: false, error: 'Email non envoyé' };
        const clientEmail = safeEmail || (await get('SELECT email FROM users WHERE id = ?', [userId]))?.email;
        if (clientEmail && !clientEmail.includes('@terrasocial.cm')) {
            try {
                emailResult = await sendWelcomeEmail(clientEmail, safeName, {
                    contractNumber,
                    lotType: reservation.lot_type,
                    lotPrice: reservation.lot_price,
                    tempPassword: res.locals.tempPassword || null,
                    loginUrl: 'https://social.manovende.com/login.html'
                });
            } catch (emailErr) {
                emailResult = { success: false, error: emailErr.message };
            }
        }

        const user = await get('SELECT id, full_name, email, phone FROM users WHERE id = ?', [userId]);
        return res.json({
            ok: true,
            message: emailResult.success
                ? 'Réservation validée, compte créé et email envoyé à ' + clientEmail
                : 'Réservation validée et compte créé' + (isSmtpConfigured() ? ' (email: ' + (emailResult.error || 'échec') + ')' : ' (SMTP non configuré)'),
            user,
            contract_number: contractNumber,
            temp_password: res.locals.tempPassword || null,
            email_sent: emailResult.success,
            email_error: emailResult.success ? null : emailResult.error
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur validation réservation: ' + error.message });
    }
});

// Rejeter un lead
router.post('/reservations/:id/reject', async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalide' });

        const reason = sanitizeOptionalText(req.body.reason, 500) || 'Non précisé';

        await run('UPDATE reservations SET status = ? WHERE id = ?', ['cancelled', id]);
        await req.audit?.('super_admin.reservation_rejected', { actor_id: req.user.id, reservation_id: id, reason });

        return res.json({ ok: true, message: 'Réservation rejetée' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur rejet réservation' });
    }
});

// Modifier le statut d'une réservation
router.put('/reservations/:id', async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalide' });

        const newStatus = sanitizeText(req.body.status, 30);
        const validStatuses = ['lead', 'pending', 'active', 'completed', 'cancelled'];
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({ error: 'Statut invalide: ' + validStatuses.join(', ') });
        }

        await run('UPDATE reservations SET status = ? WHERE id = ?', [newStatus, id]);
        await req.audit?.('super_admin.reservation_status_updated', { actor_id: req.user.id, reservation_id: id, status: newStatus });

        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise à jour réservation' });
    }
});

// Générer contrat PDF pour une réservation
router.get('/reservations/:id/contract-pdf', async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalide' });

        const reservation = await get(
            `SELECT r.*, u.full_name, u.email, u.phone, u.city
             FROM reservations r
             LEFT JOIN users u ON r.user_id = u.id
             WHERE r.id = ?`, [id]
        );
        if (!reservation) return res.status(404).json({ error: 'Réservation introuvable' });

        const contract = await get('SELECT * FROM contracts WHERE reservation_id = ? ORDER BY id DESC LIMIT 1', [id]);
        const contractNumber = contract ? contract.contract_number : 'TS-CTR-' + String(id).padStart(5, '0');

        const lotPrice = Number(reservation.lot_price || 0);
        const deposit = Number(reservation.deposit_amount || 0);
        const monthly = Number(reservation.monthly_amount || 0);
        const duration = Number(reservation.duration_months || 24);
        const dailyAmount = Number(reservation.daily_amount || 1500);

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="contrat-${contractNumber}.pdf"`);
        doc.pipe(res);

        // En-tête
        doc.fontSize(22).font('Helvetica-Bold').text('TERRASOCIAL', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('Mano Verde Inc SA — Société par Actions', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).font('Helvetica-Bold').text('CONTRAT DE RÉSERVATION FONCIÈRE', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(`Contrat N° ${contractNumber}`, { align: 'center' });
        doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
        doc.moveDown(1.5);

        // Ligne de séparation
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1B5E20');
        doc.moveDown(1);

        // Article 1 — Parties
        doc.fontSize(13).font('Helvetica-Bold').text('Article 1 — Les Parties');
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica');
        doc.text('LE VENDEUR : MANO VERDE INC SA, société de droit camerounais, immatriculée au RCCM,');
        doc.text('représentée par son Président Directeur Général.');
        doc.moveDown(0.5);
        doc.text(`L'ACQUÉREUR : ${reservation.full_name || 'Non renseigné'}`);
        doc.text(`Téléphone : ${reservation.phone || 'Non renseigné'}`);
        doc.text(`Email : ${reservation.email || 'Non renseigné'}`);
        doc.text(`Ville : ${reservation.city || 'Non renseigné'}`);
        doc.moveDown(1);

        // Article 2 — Objet
        doc.fontSize(13).font('Helvetica-Bold').text('Article 2 — Objet du Contrat');
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Le présent contrat porte sur la réservation d'un terrain de type ${(reservation.lot_type || '').toUpperCase()}.`);
        doc.text(`Surface : ${reservation.lot_size_m2 || 200} m²`);
        doc.text(`Prix total : ${lotPrice.toLocaleString('fr-FR')} FCFA`);
        if (reservation.price_per_m2) doc.text(`Prix au m² : ${Number(reservation.price_per_m2).toLocaleString('fr-FR')} FCFA/m²`);
        doc.moveDown(1);

        // Article 3 — Modalités de paiement
        doc.fontSize(13).font('Helvetica-Bold').text('Article 3 — Modalités de Paiement');
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Montant journalier minimum : ${dailyAmount.toLocaleString('fr-FR')} FCFA/jour`);
        doc.text(`Montant mensuel indicatif : ${monthly.toLocaleString('fr-FR')} FCFA/mois`);
        doc.text(`Durée de paiement : ${duration} mois`);
        doc.text(`Fréquence : ${reservation.payment_frequency || 'quotidien'}`);
        doc.moveDown(0.3);
        doc.text('Le paiement peut être effectué par Orange Money, MTN Mobile Money ou carte bancaire.');
        doc.text('Chaque franc versé avance le compteur de l\'acquéreur vers la propriété complète.');
        doc.moveDown(1);

        // Article 4 — Assurance
        doc.fontSize(13).font('Helvetica-Bold').text('Article 4 — Assurance (optionnelle)');
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica');
        const insurancePersons = Number(reservation.insurance_persons || 0);
        if (insurancePersons > 0) {
            doc.text(`Nombre de personnes assurées : ${insurancePersons}`);
            doc.text(`Coût assurance : ${(insurancePersons * 350).toLocaleString('fr-FR')} FCFA/jour`);
        } else {
            doc.text('Aucune assurance famille souscrite à ce jour.');
        }
        doc.text('Couverture : invalidité, décès, maladie — 500 000 FCFA/an par personne.');
        doc.moveDown(1);

        // Article 5 — Engagements
        doc.fontSize(13).font('Helvetica-Bold').text('Article 5 — Engagements des Parties');
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica');
        doc.text('Le vendeur s\'engage à :');
        doc.text('  - Garantir la disponibilité du terrain réservé');
        doc.text('  - Fournir un titre foncier sécurisé à la fin du paiement');
        doc.text('  - Délivrer un procès-verbal de jouissance à 50% du paiement');
        doc.moveDown(0.3);
        doc.text('L\'acquéreur s\'engage à :');
        doc.text('  - Respecter les échéances de paiement convenues');
        doc.text('  - Payer les frais d\'ouverture de dossier de 10 000 FCFA');
        doc.text('  - Informer le vendeur de tout changement de coordonnées');
        doc.moveDown(1);

        // Article 6 — Clause de résiliation
        doc.fontSize(13).font('Helvetica-Bold').text('Article 6 — Résiliation');
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica');
        doc.text('En cas de non-paiement pendant 3 mois consécutifs, le vendeur se réserve le droit de résilier');
        doc.text('le présent contrat. Les sommes versées seront remboursées sous 30 jours, déduction faite');
        doc.text('des frais de dossier et d\'une indemnité forfaitaire de 10% des sommes versées.');
        doc.moveDown(1.5);

        // Signatures
        doc.fontSize(13).font('Helvetica-Bold').text('Signatures', { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica');
        doc.text('Le Vendeur                                                    L\'Acquéreur');
        doc.moveDown(2);
        doc.text('_______________________                            _______________________');
        doc.text('MANO VERDE INC SA                                   ' + (reservation.full_name || ''));
        doc.moveDown(1);
        doc.fontSize(8).text(`Document généré le ${new Date().toLocaleString('fr-FR')} — Contrat N° ${contractNumber}`, { align: 'center' });

        doc.end();

        await req.audit?.('super_admin.contract_pdf_generated', { actor_id: req.user.id, reservation_id: id, contract: contractNumber });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur génération contrat PDF' });
    }
});

// Envoyer email de bienvenue complet (contrat PDF en pièce jointe + credentials)
router.post('/reservations/:id/send-welcome', async (req, res) => {
    try {
        const id = parsePositiveInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalide' });

        const reservation = await get(
            `SELECT r.*, u.full_name, u.email, u.phone, u.city
             FROM reservations r
             LEFT JOIN users u ON r.user_id = u.id
             WHERE r.id = ?`, [id]
        );
        if (!reservation) return res.status(404).json({ error: 'Réservation introuvable' });
        if (!reservation.user_id) return res.status(400).json({ error: 'Réservation non validée (pas de compte client lié)' });

        const clientEmail = reservation.email;
        if (!clientEmail || clientEmail.includes('@terrasocial.cm')) {
            return res.status(400).json({ error: 'Pas d\'email client valide pour cette réservation' });
        }

        // Générer un nouveau mot de passe temporaire et mettre à jour le compte
        const tempPassword = 'TS-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Date.now().toString(36).slice(-4).toUpperCase();
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        await run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, reservation.user_id]);

        const contract = await get('SELECT * FROM contracts WHERE reservation_id = ? ORDER BY id DESC LIMIT 1', [id]);
        const contractNumber = contract ? contract.contract_number : 'TS-CTR-' + String(id).padStart(5, '0');

        const lotPrice = Number(reservation.lot_price || 0);
        const dailyAmount = Number(reservation.daily_amount || 1500);
        const insurancePersons = Number(reservation.insurance_persons || 0);
        const lotType = (reservation.lot_type || '').toUpperCase();
        const surface = reservation.lot_size_m2 || 200;

        // Générer le contrat PDF officiel basé sur le modèle notarié
        const pdfBuffers = [];
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.on('data', (chunk) => pdfBuffers.push(chunk));
        const pdfReady = new Promise((resolve) => doc.on('end', resolve));

        const fmt = (v) => Number(v || 0).toLocaleString('fr-FR');
        const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        const duration = Number(reservation.duration_months || 24);
        const clientName = reservation.full_name || 'Non renseigné';
        const pricePerM2 = reservation.price_per_m2 ? `${fmt(reservation.price_per_m2)} FCFA/m²` : '';

        // ═══ EN-TÊTE ═══
        doc.fontSize(10).font('Helvetica').text('Projet TERRASOCIAL — MANO VERDE INC SA', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(18).font('Helvetica-Bold').text('CONTRAT DE RÉSERVATION DE LOT', { align: 'center' });
        doc.fontSize(14).text('AVEC PAIEMENT ÉCHELONNÉ', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(`Contrat N° ${contractNumber}  —  ${dateStr}`, { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1B5E20');
        doc.moveDown(1);

        // ═══ ART. 1 — PARTIES ═══
        doc.fontSize(12).font('Helvetica-Bold').text('1. PARTIES AU CONTRAT');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        doc.text('Le présent contrat est conclu entre :');
        doc.text(`  • VENDEUR : MANO VERDE INC SA, société par actions de droit camerounais,`);
        doc.text(`    représentée par son Président Directeur Général.`);
        doc.text(`  • ACQUÉREUR : ${clientName}`);
        doc.text(`    Téléphone : ${reservation.phone || '-'}  |  Email : ${reservation.email || '-'}`);
        doc.text(`    Ville de résidence : ${reservation.city || '-'}`);
        doc.moveDown(0.8);

        // ═══ ART. 2 — OBJET ═══
        doc.fontSize(12).font('Helvetica-Bold').text('2. OBJET DU CONTRAT');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Par ce contrat, le Vendeur s'engage à réserver à l'Acquéreur un lot de terrain situé :`);
        doc.text(`  • Localisation : Région du Centre, Cameroun — Projet TERRASOCIAL`);
        doc.text(`  • Type de lot : ${lotType}`);
        doc.text(`  • Superficie : ${surface} m²`);
        doc.text(`  • Description : Terrain nu, rural, situé dans le projet TERRASOCIAL`);
        doc.moveDown(0.8);

        // ═══ ART. 3 — PRIX ET CONDITIONS ═══
        doc.fontSize(12).font('Helvetica-Bold').text('3. PRIX ET CONDITIONS DE PAIEMENT');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        doc.text(`  Désignation                           Montant`);
        doc.text(`  ─────────────────────────────────────────────────`);
        doc.text(`  Prix total du lot                     ${fmt(lotPrice)} FCFA`);
        if (pricePerM2) doc.text(`  Prix au mètre carré                  ${pricePerM2}`);
        doc.text(`  Frais d'ouverture de dossier          10 000 FCFA`);
        doc.text(`  Durée de l'échelonnement              ${duration} mois`);
        doc.text(`  Versement journalier minimum          ${fmt(dailyAmount)} FCFA/jour`);
        doc.text(`  Fréquence de paiement                 ${reservation.payment_frequency || 'quotidien'}`);
        doc.moveDown(0.3);
        doc.text('Moyens de paiement acceptés : Orange Money, MTN Mobile Money, Carte bancaire.');
        doc.text(`Chaque versement est comptabilisé et avance le compteur de l'Acquéreur.`);
        doc.moveDown(0.8);

        // ═══ ART. 4 — ÉCHÉANCIER ═══
        doc.fontSize(12).font('Helvetica-Bold').text('4. ÉCHÉANCIER DE PAIEMENT');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        doc.text('Les paiements sont effectués selon la fréquence choisie par l\'Acquéreur :');
        doc.text(`  • Quotidien : ${fmt(dailyAmount)} FCFA minimum par jour`);
        doc.text(`  • Hebdomadaire : ${fmt(dailyAmount * 7)} FCFA/semaine`);
        doc.text(`  • Mensuel : ${fmt(dailyAmount * 30)} FCFA/mois`);
        doc.text('Le suivi des versements est accessible depuis l\'espace client TERRASOCIAL.');
        doc.moveDown(0.8);

        // ═══ ART. 5 — CONDITIONS SUSPENSIVES ═══
        doc.fontSize(12).font('Helvetica-Bold').text('5. CONDITIONS SUSPENSIVES');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        doc.text('La réservation du lot est soumise aux conditions suspensives suivantes :');
        doc.text('  • Obtention de la conformité cadastrale');
        doc.text('  • Vérification de la non-inscription d\'hypothèque');
        doc.text('  • Agrément administratif (le cas échéant)');
        doc.text('  • Validation par les autorités locales');
        doc.moveDown(0.8);

        // ═══ ART. 6 — CLAUSE RÉSOLUTOIRE ═══
        doc.fontSize(12).font('Helvetica-Bold').text('6. CLAUSE RÉSOLUTOIRE');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        doc.text('En cas de défaut de paiement d\'une ou plusieurs échéances :');
        doc.text('  • Un délai de grâce de 30 jours calendaires sera accordé');
        doc.text('  • Passé ce délai, le contrat pourra être résilié de plein droit');
        doc.text('  • Les sommes versées seront remboursées sous 30 jours, déduction faite');
        doc.text('    des frais de dossier et d\'une indemnité forfaitaire de 10%');
        doc.moveDown(0.8);

        // ═══ ART. 7 — JOUISSANCE ANTICIPÉE ═══
        doc.fontSize(12).font('Helvetica-Bold').text('7. JOUISSANCE ANTICIPÉE');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        doc.text('L\'Acquéreur aura la jouissance anticipée du lot dès le versement de 50% du prix total.');
        doc.text('Cette jouissance sera matérialisée par un procès-verbal de mise en jouissance anticipée.');
        doc.text('Elle ne constitue pas un titre de propriété et demeure strictement personnelle.');
        doc.moveDown(0.8);

        // ═══ ART. 8 — ASSURANCE FAMILLE ═══
        doc.fontSize(12).font('Helvetica-Bold').text('8. ASSURANCE FAMILLE (OPTIONNELLE)');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        if (insurancePersons > 0) {
            doc.text(`L'Acquéreur a souscrit à l'assurance famille pour ${insurancePersons} personne(s).`);
            doc.text(`  • Coût : ${fmt(insurancePersons * 350)} FCFA/jour (350 FCFA/jour/personne)`);
            doc.text('  • Couverture : invalidité, décès, maladie — 500 000 FCFA/an/personne');
        } else {
            doc.text('L\'Acquéreur n\'a pas souscrit à l\'assurance famille à ce jour.');
            doc.text('Option disponible à tout moment : 350 FCFA/jour/personne (invalidité + décès + maladie).');
        }
        doc.moveDown(0.8);

        // ═══ ART. 9 — OBLIGATIONS ═══
        doc.fontSize(12).font('Helvetica-Bold').text('9. OBLIGATIONS DES PARTIES');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        doc.font('Helvetica-Bold').text('Obligations du Vendeur :');
        doc.font('Helvetica');
        doc.text('  • Assurer la quiétude de jouissance du lot');
        doc.text('  • Procédure d\'immatriculation auprès du cadastre');
        doc.text('  • Fournir tous les documents nécessaires');
        doc.text('  • Délivrer l\'acte authentique après paiement intégral');
        doc.text('  • Délivrer un PV de jouissance anticipée à 50% du paiement');
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').text('Obligations de l\'Acquéreur :');
        doc.font('Helvetica');
        doc.text('  • Effectuer les paiements selon la fréquence convenue');
        doc.text('  • Payer les frais d\'ouverture de dossier (10 000 FCFA)');
        doc.text('  • Supporter les frais de mutation (droits d\'enregistrement)');
        doc.text('  • Respecter la destination du lot (vocation résidentielle)');
        doc.moveDown(0.8);

        // ═══ ART. 10 — DISPOSITIONS DIVERSES ═══
        doc.fontSize(12).font('Helvetica-Bold').text('10. DISPOSITIONS DIVERSES');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        doc.text('  • Droit applicable : Lois de la République du Cameroun');
        doc.text('  • Compétence : Tribunaux du Centre');
        doc.text('  • Frais de rédaction : À la charge du Vendeur');
        doc.text('  • Enregistrement : À la charge de l\'Acquéreur');
        doc.text('  • Signature électronique : acceptée via l\'espace client TERRASOCIAL');
        doc.text(`  • Espace client : https://social.manovende.com/login.html`);
        doc.moveDown(1.5);

        // ═══ SIGNATURES ═══
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1B5E20');
        doc.moveDown(1);
        doc.fontSize(11).font('Helvetica-Bold').text('SIGNATURES', { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica');
        doc.text('Pour le Vendeur :                                              Pour l\'Acquéreur :');
        doc.moveDown(2.5);
        doc.text('_______________________________                    _______________________________');
        doc.text('MANO VERDE INC SA                                         ' + clientName);
        doc.text('Président Directeur Général');
        doc.moveDown(1.5);
        doc.fontSize(8).font('Helvetica').fillColor('#666666');
        doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')} — Contrat N° ${contractNumber}`, { align: 'center' });
        doc.text('Ce document doit être signé et retourné via votre espace client TERRASOCIAL.', { align: 'center' });

        doc.end();
        await pdfReady;

        const pdfBuffer = Buffer.concat(pdfBuffers);

        // Envoyer l'email avec le PDF en pièce jointe
        const { sendEmail } = require('../services/email');
        const nodemailer = require('nodemailer');

        const loginUrl = 'https://social.manovende.com/login.html';
        const subject = `✅ TERRASOCIAL — Contrat ${contractNumber} — Bienvenue ${reservation.full_name} !`;

        const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#1B5E20;color:#fff;padding:20px;text-align:center;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:24px;">🏡 TERRASOCIAL</h1>
        <p style="margin:4px 0 0;opacity:0.9;">Mano Verde Inc SA</p>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e0e0e0;border-radius:0 0 12px 12px;">
        <h2 style="color:#1B5E20;margin-top:0;">Bonjour ${reservation.full_name},</h2>
        <p>Félicitations ! Votre réservation foncière a été <strong style="color:#1B5E20;">validée</strong>.</p>

        <div style="background:#E8F5E9;padding:16px;border-radius:8px;margin:16px 0;">
            <p style="margin:0;font-weight:bold;">📋 Détails de votre réservation</p>
            <p style="margin:6px 0 0;">Contrat : <strong>${contractNumber}</strong></p>
            <p style="margin:4px 0 0;">Lot : <strong>${lotType}</strong> — ${surface} m²</p>
            <p style="margin:4px 0 0;">Prix : <strong>${lotPrice.toLocaleString('fr-FR')} FCFA</strong></p>
            <p style="margin:4px 0 0;">Versement minimum : <strong>${dailyAmount.toLocaleString('fr-FR')} FCFA/jour</strong></p>
            ${insurancePersons > 0 ? `<p style="margin:4px 0 0;">🛡️ Assurance : <strong>${insurancePersons} personne(s)</strong> — ${(insurancePersons * 350).toLocaleString('fr-FR')} FCFA/jour</p>` : ''}
        </div>

        <div style="background:#FFF3E0;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #FF9800;">
            <p style="margin:0;font-weight:bold;color:#E65100;">🔐 Vos identifiants de connexion</p>
            <p style="margin:6px 0 0;">Email : <strong>${clientEmail}</strong></p>
            <p style="margin:6px 0 0;">Mot de passe provisoire : <strong style="font-size:16px;letter-spacing:1px;color:#C62828;">${tempPassword}</strong></p>
            <p style="margin:10px 0 0;font-size:13px;color:#C62828;font-weight:bold;">⚠️ Ce mot de passe est temporaire. Veuillez le changer dès votre première connexion.</p>
        </div>

        <p style="text-align:center;margin:24px 0;">
            <a href="${loginUrl}" style="background:#1B5E20;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                Accéder à mon espace client →
            </a>
        </p>

        <div style="background:#E3F2FD;padding:16px;border-radius:8px;margin:16px 0;">
            <p style="margin:0;font-weight:bold;color:#1565C0;">📄 Contrat en pièce jointe</p>
            <p style="margin:6px 0 0;font-size:13px;">Veuillez <strong>signer le contrat ci-joint</strong> et le retourner via votre espace client (section Documents), ou par email à cette adresse.</p>
        </div>

        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:13px;color:#666;">
            Vous pouvez commencer vos versements dès maintenant via Orange Money, MTN MoMo ou carte bancaire.
        </p>
        <p style="font-size:12px;color:#999;text-align:center;margin-top:20px;">
            TERRASOCIAL — Mano Verde Inc SA<br>La propriété foncière accessible à tous
        </p>
    </div>
</div>`;

        const text = `Bonjour ${reservation.full_name},\n\nVotre réservation TERRASOCIAL a été validée !\n\nContrat : ${contractNumber}\nLot : ${lotType} — ${surface} m²\nPrix : ${lotPrice.toLocaleString('fr-FR')} FCFA\nVersement min : ${dailyAmount.toLocaleString('fr-FR')} FCFA/jour\n${insurancePersons > 0 ? `Assurance : ${insurancePersons} pers. — ${(insurancePersons * 350).toLocaleString('fr-FR')} FCFA/jour\n` : ''}\nVos identifiants :\nEmail : ${clientEmail}\nMot de passe provisoire : ${tempPassword}\n⚠️ Changez ce mot de passe dès votre première connexion.\n\nConnexion : ${loginUrl}\n\nLe contrat est en pièce jointe. Veuillez le signer et le retourner via votre espace client (section Documents).\n\nMerci de votre confiance !\nTERRASOCIAL — Mano Verde Inc SA`;

        // Utiliser nodemailer directement pour les pièces jointes
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const smtpFrom = process.env.SMTP_FROM || smtpUser;

        if (!smtpUser || !smtpPass) {
            return res.json({ email_sent: false, error: 'SMTP non configuré', contract_number: contractNumber });
        }

        const transport = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT || 587),
            secure: false,
            auth: { user: smtpUser, pass: smtpPass },
            tls: { rejectUnauthorized: false }
        });

        const info = await transport.sendMail({
            from: smtpFrom,
            to: clientEmail,
            subject,
            text,
            html,
            attachments: [{
                filename: `contrat-${contractNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        });

        // Mettre à jour le statut du contrat
        if (contract) {
            await run('UPDATE contracts SET status = ? WHERE id = ?', ['sent', contract.id]);
        }

        await req.audit?.('super_admin.welcome_email_sent', { actor_id: req.user.id, reservation_id: id, recipient: clientEmail, contract: contractNumber });

        return res.json({
            email_sent: true,
            recipient: clientEmail,
            contract_number: contractNumber,
            message_id: info.messageId
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur envoi email: ' + error.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// AGENTS / PARTENAIRES — Gestion des demandes
// ══════════════════════════════════════════════════════════════════════════════

router.get('/agents', async (req, res) => {
    try {
        const status = sanitizeOptionalText(req.query.status, 20);
        let sql = `SELECT a.*, u.full_name, u.email, u.phone, u.city
                    FROM agents a
                    LEFT JOIN users u ON a.user_id = u.id
                    ORDER BY a.created_at DESC LIMIT 200`;
        let params = [];
        if (status) {
            sql = `SELECT a.*, u.full_name, u.email, u.phone, u.city
                   FROM agents a
                   LEFT JOIN users u ON a.user_id = u.id
                   WHERE a.status = ?
                   ORDER BY a.created_at DESC LIMIT 200`;
            params = [status];
        }
        const agents = await all(sql, params);
        return res.json({ agents });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture agents' });
    }
});

// Valider un agent partenaire
router.post('/agents/:id/approve', async (req, res) => {
    try {
        const agentId = req.params.id;
        await run(
            'UPDATE agents SET status = ?, is_active = TRUE, approved_at = NOW(), approved_by = ? WHERE id = ?',
            ['active', req.user.id, agentId]
        );

        // Envoyer email de bienvenue agent si SMTP configuré
        const agent = await get(
            'SELECT a.*, u.full_name, u.email FROM agents a JOIN users u ON a.user_id = u.id WHERE a.id = ?',
            [agentId]
        );
        if (agent && agent.email) {
            try {
                const { sendEmail } = require('../services/email');
                await sendEmail(
                    agent.email,
                    '✅ TERRASOCIAL — Votre partenariat est activé !',
                    `Bonjour ${agent.full_name},\n\nVotre demande de partenariat TERRASOCIAL a été approuvée !\n\nVotre code agent : ${agent.agent_code}\nLien de parrainage : https://social.manovende.com/index.html?ref=${agent.agent_code}\n\nConnectez-vous pour créer vos codes promo et suivre vos commissions.\n\nBienvenue dans l'équipe !\nTERRASOCIAL — Mano Verde Inc SA`,
                    `<div style="font-family:Arial;max-width:600px;margin:auto;"><div style="background:#1B5E20;color:#fff;padding:20px;text-align:center;border-radius:12px 12px 0 0;"><h1 style="margin:0;">🤝 TERRASOCIAL</h1></div><div style="background:#fff;padding:24px;border:1px solid #e0e0e0;border-radius:0 0 12px 12px;"><h2 style="color:#1B5E20;">Bienvenue ${agent.full_name} !</h2><p>Votre partenariat a été <strong style="color:#1B5E20;">approuvé</strong>.</p><div style="background:#E8F5E9;padding:16px;border-radius:8px;margin:16px 0;"><p style="margin:0;"><strong>Code agent :</strong> ${agent.agent_code}</p><p style="margin:6px 0 0;"><strong>Lien de parrainage :</strong><br><a href="https://social.manovende.com/index.html?ref=${agent.agent_code}">https://social.manovende.com/?ref=${agent.agent_code}</a></p></div><div style="background:#FFF3E0;padding:16px;border-radius:8px;margin:16px 0;"><p style="margin:0;font-weight:bold;color:#E65100;">💰 Vos commissions</p><p style="margin:6px 0 0;">Client souscrit : <strong>500 FCFA</strong></p><p style="margin:4px 0 0;">Propriétaire : <strong>1% à 4%</strong> par versement/Ha</p></div><p style="text-align:center;"><a href="https://social.manovende.com/login.html" style="background:#1B5E20;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Accéder à mon espace agent →</a></p></div></div>`
                );
            } catch (emailErr) { /* non-bloquant */ }
        }

        await req.audit?.('super_admin.agent_approved', { actor_id: req.user.id, agent_id: agentId });
        return res.json({ ok: true, message: 'Agent approuvé et notifié' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur approbation agent' });
    }
});

// Rejeter un agent
router.post('/agents/:id/reject', async (req, res) => {
    try {
        const agentId = req.params.id;
        const reason = sanitizeOptionalText(req.body.reason, 500);
        await run('UPDATE agents SET status = ?, is_active = FALSE WHERE id = ?', ['rejected', agentId]);
        await req.audit?.('super_admin.agent_rejected', { actor_id: req.user.id, agent_id: agentId, reason });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur rejet agent' });
    }
});

// Suspendre un agent
router.post('/agents/:id/suspend', async (req, res) => {
    try {
        const agentId = req.params.id;
        await run('UPDATE agents SET status = ?, is_active = FALSE WHERE id = ?', ['suspended', agentId]);
        await req.audit?.('super_admin.agent_suspended', { actor_id: req.user.id, agent_id: agentId });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur suspension agent' });
    }
});

module.exports = router;
