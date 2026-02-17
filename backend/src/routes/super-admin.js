const express = require('express');
const PDFDocument = require('pdfkit');
const { all, get, run } = require('../db/connection');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { sanitizeOptionalText, sanitizeText, normalizeEmail } = require('../utils/validation');

const router = express.Router();

router.use(requireAuth, requireSuperAdmin);

function parseDateRange(from, to) {
    const fromSafe = from ? new Date(from) : null;
    const toSafe = to ? new Date(to) : null;
    if (fromSafe && Number.isNaN(fromSafe.getTime())) return { error: 'Date from invalide' };
    if (toSafe && Number.isNaN(toSafe.getTime())) return { error: 'Date to invalide' };
    return { fromSafe, toSafe };
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

        const result = await run(
            `INSERT INTO admin_messages(sender_user_id, target_scope, target_role, target_user_id, content, channels, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, targetScope, targetRole, targetUserId, content, channels, 'queued']
        );

        await req.audit?.('super_admin.message_broadcast', { actor_id: req.user.id, message_id: result.id, target_scope: targetScope });
        return res.status(201).json({ id: result.id, status: 'queued' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur envoi message' });
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
        const docs = await all(
            `SELECT id, user_id, document_type, file_name, file_path, storage_mode, public_url, uploaded_at
             FROM documents
             ORDER BY id DESC
             LIMIT 500`
        );
        return res.json({ documents: docs });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture documents admin' });
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

module.exports = router;
