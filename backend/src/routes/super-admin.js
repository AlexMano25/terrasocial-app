const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { all, get, run } = require('../db/connection');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { sanitizeOptionalText, sanitizeText, normalizeEmail, parsePositiveInt, isValidPhone } = require('../utils/validation');

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

        const user = await get('SELECT id, full_name, email, phone FROM users WHERE id = ?', [userId]);
        return res.json({
            ok: true,
            message: 'Réservation validée et compte client créé',
            user,
            contract_number: contractNumber,
            temp_password: res.locals.tempPassword || null
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

module.exports = router;
