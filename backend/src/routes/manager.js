const express = require('express');
const fs = require('fs');
const path = require('path');
const { all, get, run } = require('../db/connection');
const { requireAuth, requireManager } = require('../middleware/auth');
const { sanitizeOptionalText, sanitizeText, normalizeEmail, parsePositiveInt } = require('../utils/validation');

const uploadsPath = process.env.VERCEL ? '/tmp/terrasocial-uploads' : path.join(__dirname, '..', '..', 'uploads');

const router = express.Router();

// Toutes les routes manager requièrent auth + rôle manager
router.use(requireAuth, requireManager);

// ─── OVERVIEW ──────────────────────────────────────────────────────────────
router.get('/overview', async (req, res) => {
    try {
        const usersByRole = await all(`SELECT role, COUNT(*) AS total FROM users GROUP BY role`);

        const pendingRow = await get(
            `SELECT COUNT(*) AS pending_reservations FROM reservations WHERE status = ?`,
            ['pending']
        );

        const docsRow = await get(`SELECT COUNT(*) AS total_documents FROM documents`);

        const messagesRow = await get(`SELECT COUNT(*) AS total_messages FROM admin_messages`);

        const monthlyUsers = await all(
            `SELECT SUBSTR(CAST(created_at AS TEXT), 1, 7) AS month, COUNT(*) AS total
             FROM users
             GROUP BY SUBSTR(CAST(created_at AS TEXT), 1, 7)
             ORDER BY month ASC`
        );

        return res.json({
            users_by_role: usersByRole,
            pending_reservations: Number(pendingRow?.pending_reservations || 0),
            documents_count: Number(docsRow?.total_documents || 0),
            messages_count: Number(messagesRow?.total_messages || 0),
            monthly_users: monthlyUsers
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement overview manager' });
    }
});

// ─── UTILISATEURS (lecture uniquement) ────────────────────────────────────
router.get('/users', async (req, res) => {
    try {
        const q = sanitizeOptionalText(req.query.q, 120);
        const role = sanitizeOptionalText(req.query.role, 30);

        const users = await all(
            `SELECT id, role, full_name, email, phone, city, reliability_score, created_at
             FROM users
             ORDER BY id DESC`
        );

        const filtered = users.filter((u) => {
            if (role && u.role !== role) return false;
            if (q) {
                const hay = `${u.full_name || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase();
                if (!hay.includes(q.toLowerCase())) return false;
            }
            return true;
        });

        return res.json({ users: filtered });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture utilisateurs' });
    }
});

// ─── MODIFIER UN UTILISATEUR (écriture, pas de suppression) ───────────────
router.put('/users/:id', async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (!userId) return res.status(400).json({ error: 'ID invalide' });

        const fullName = sanitizeText(req.body.full_name, 120);
        const phone = sanitizeOptionalText(req.body.phone, 30);
        const city = sanitizeOptionalText(req.body.city, 80);

        if (!fullName) return res.status(400).json({ error: 'full_name requis' });

        await run(
            `UPDATE users SET full_name = ?, phone = ?, city = ? WHERE id = ?`,
            [fullName, phone, city, userId]
        );

        await req.audit?.('manager.user_updated', { actor_id: req.user.id, user_id: userId });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise a jour utilisateur' });
    }
});

// ─── RÉSERVATIONS (lecture uniquement) ────────────────────────────────────
router.get('/reservations', async (req, res) => {
    try {
        const rows = await all(
            `SELECT r.id, r.user_id, u.full_name, u.email, u.phone,
                    r.lot_type, r.lot_price, r.duration_months, r.status, r.created_at
             FROM reservations r
             LEFT JOIN users u ON r.user_id = u.id
             ORDER BY r.id DESC
             LIMIT 500`
        );
        return res.json({ reservations: rows });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture reservations' });
    }
});

// ─── RÉSERVATION — détail ─────────────────────────────────────────────────
router.get('/reservations/:id', async (req, res) => {
    try {
        const resId = Number(req.params.id);
        if (!resId) return res.status(400).json({ error: 'ID invalide' });

        const row = await get(
            `SELECT r.id, r.user_id, u.full_name AS client_name, u.email, u.phone,
                    r.lot_type AS lot_title, r.lot_price AS price, r.monthly_amount,
                    r.duration_months, r.status, r.created_at
             FROM reservations r
             LEFT JOIN users u ON r.user_id = u.id
             WHERE r.id = ?`,
            [resId]
        );

        if (!row) return res.status(404).json({ error: 'Réservation introuvable' });
        return res.json({ reservation: row });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture réservation' });
    }
});

// ─── DOCUMENTS (lecture uniquement) ───────────────────────────────────────
router.get('/documents', async (req, res) => {
    try {
        const docs = await all(
            `SELECT d.id, d.user_id, u.full_name, u.email, u.phone,
                    d.document_type, d.file_name, d.storage_mode, d.public_url, d.uploaded_at
             FROM documents d
             LEFT JOIN users u ON d.user_id = u.id
             ORDER BY d.id DESC
             LIMIT 500`
        );
        return res.json({ documents: docs });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture documents' });
    }
});

// ─── DOCUMENT — téléchargement ────────────────────────────────────────────
router.get('/documents/:id/download', async (req, res) => {
    try {
        const docId = Number(req.params.id);
        if (!docId) return res.status(400).json({ error: 'ID invalide' });

        const doc = await get('SELECT * FROM documents WHERE id = ?', [docId]);
        if (!doc) return res.status(404).json({ error: 'Document introuvable' });

        // Supabase : rediriger vers l'URL publique
        if (doc.storage_mode === 'supabase' && doc.public_url) {
            return res.redirect(doc.public_url);
        }

        // Local : streamer le fichier
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

// ─── MESSAGES (écriture autorisée) ────────────────────────────────────────
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

        await req.audit?.('manager.message_sent', { actor_id: req.user.id, message_id: result.id });
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
             LIMIT 200`
        );
        return res.json({ messages: rows });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture messages' });
    }
});

// ─── LOTS (lecture uniquement pour le manager) ────────────────────────────
router.get('/lots', async (req, res) => {
    try {
        const rows = await all(
            `SELECT id, title, location, size_m2, price, monthly_amount, duration_months, icon, features, status, display_order
             FROM available_lots
             ORDER BY display_order ASC, id ASC`
        );
        return res.json({ lots: rows });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture lots' });
    }
});

module.exports = router;
