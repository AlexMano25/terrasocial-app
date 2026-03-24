const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { all, get, run } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { sanitizeText } = require('../utils/validation');

const router = express.Router();

// All routes require auth
router.use(requireAuth);

// Check legal firm status
async function requireLegal(req, res, next) {
    const firm = await get('SELECT * FROM law_firms WHERE user_id = ? AND is_active = TRUE', [req.user.id]);
    if (!firm) return res.status(403).json({ error: 'Accès réservé au cabinet juridique' });
    req.firm = firm;
    return next();
}

router.use(requireLegal);

// File upload config
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter(req, file, cb) {
        const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
        cb(null, allowed.has(file.mimetype));
    }
});

// ── Dashboard ────────────────────────────────────────────────────────────

// GET /api/legal/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const firmId = req.firm.id;

        const totalReviews = await get(
            'SELECT COUNT(*) as count FROM legal_reviews WHERE firm_id = ?',
            [firmId]
        );
        const pendingReviews = await get(
            "SELECT COUNT(*) as count FROM legal_reviews WHERE firm_id = ? AND status = 'pending'",
            [firmId]
        );
        const approvedReviews = await get(
            "SELECT COUNT(*) as count FROM legal_reviews WHERE firm_id = ? AND status = 'approved'",
            [firmId]
        );
        const rejectedReviews = await get(
            "SELECT COUNT(*) as count FROM legal_reviews WHERE firm_id = ? AND status = 'rejected'",
            [firmId]
        );
        const totalInvoicesAmount = await get(
            'SELECT COALESCE(SUM(total_amount), 0) as total FROM legal_invoices WHERE firm_id = ?',
            [firmId]
        );
        const pendingInvoicesAmount = await get(
            "SELECT COALESCE(SUM(total_amount), 0) as total FROM legal_invoices WHERE firm_id = ? AND status = 'pending'",
            [firmId]
        );
        const activeSubscriptions = await get(
            "SELECT COUNT(*) as count FROM reservations WHERE status = 'active'",
            []
        );

        return res.json({
            firm: {
                id: req.firm.id,
                firm_name: req.firm.firm_name,
                license_number: req.firm.license_number,
                daily_legal_fee: req.firm.daily_legal_fee
            },
            stats: {
                total_reviews: Number(totalReviews?.count || 0),
                pending_reviews: Number(pendingReviews?.count || 0),
                approved_reviews: Number(approvedReviews?.count || 0),
                rejected_reviews: Number(rejectedReviews?.count || 0),
                total_invoices_amount: Number(totalInvoicesAmount?.total || 0),
                pending_invoices_amount: Number(pendingInvoicesAmount?.total || 0),
                active_subscriptions: Number(activeSubscriptions?.count || 0)
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement dashboard' });
    }
});

// ── Reviews ──────────────────────────────────────────────────────────────

// GET /api/legal/reviews
router.get('/reviews', async (req, res) => {
    try {
        const { status, type } = req.query;
        let conditions = ['lr.firm_id = ?'];
        let params = [req.firm.id];

        if (status) {
            conditions.push('lr.status = ?');
            params.push(status);
        }
        if (type) {
            conditions.push('lr.review_type = ?');
            params.push(type);
        }

        const where = conditions.join(' AND ');

        const reviews = await all(
            `SELECT lr.*, u.full_name, u.email, u.phone, u.city,
                    r.lot_type, r.status as reservation_status, r.created_at as reservation_date,
                    lfc.full_name as assigned_name
             FROM legal_reviews lr
             JOIN users u ON lr.user_id = u.id
             LEFT JOIN reservations r ON lr.reservation_id = r.id
             LEFT JOIN law_firm_collaborators lfc ON lr.assigned_to = lfc.id
             WHERE ${where}
             ORDER BY lr.id DESC`,
            params
        );

        return res.json({ reviews });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement revues' });
    }
});

// GET /api/legal/reviews/:id
router.get('/reviews/:id', async (req, res) => {
    try {
        const review = await get(
            `SELECT lr.*, u.full_name, u.email, u.phone, u.city,
                    r.lot_type, r.status as reservation_status, r.created_at as reservation_date, r.insurance_persons,
                    lfc.full_name as assigned_name
             FROM legal_reviews lr
             JOIN users u ON lr.user_id = u.id
             LEFT JOIN reservations r ON lr.reservation_id = r.id
             LEFT JOIN law_firm_collaborators lfc ON lr.assigned_to = lfc.id
             WHERE lr.id = ? AND lr.firm_id = ?`,
            [req.params.id, req.firm.id]
        );
        if (!review) return res.status(404).json({ error: 'Revue introuvable' });

        const documents = await all(
            'SELECT * FROM legal_documents WHERE review_id = ? AND firm_id = ? ORDER BY id DESC',
            [review.id, req.firm.id]
        );

        const messages = await all(
            'SELECT * FROM legal_messages WHERE review_id = ? AND firm_id = ? ORDER BY id ASC',
            [review.id, req.firm.id]
        );

        return res.json({ review, documents, messages });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement revue' });
    }
});

// PUT /api/legal/reviews/:id
router.put('/reviews/:id', async (req, res) => {
    try {
        const review = await get(
            'SELECT * FROM legal_reviews WHERE id = ? AND firm_id = ?',
            [req.params.id, req.firm.id]
        );
        if (!review) return res.status(404).json({ error: 'Revue introuvable' });

        const { status, legal_opinion, notes } = req.body;

        const safeStatus = status || review.status;
        const safeOpinion = legal_opinion !== undefined ? sanitizeText(legal_opinion, 5000) : review.legal_opinion;
        const safeNotes = notes !== undefined ? sanitizeText(notes, 5000) : review.notes;

        const validStatuses = ['pending', 'in_review', 'approved', 'rejected', 'revision_requested', 'completed'];
        if (!validStatuses.includes(safeStatus)) {
            return res.status(400).json({ error: 'Statut invalide' });
        }

        const reviewedAt = ['approved', 'rejected', 'completed'].includes(safeStatus) ? new Date().toISOString() : review.reviewed_at;

        await run(
            'UPDATE legal_reviews SET status = ?, legal_opinion = ?, notes = ?, reviewed_at = ? WHERE id = ?',
            [safeStatus, safeOpinion, safeNotes, reviewedAt, review.id]
        );

        return res.json({ id: review.id, status: safeStatus });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise a jour revue' });
    }
});

// POST /api/legal/reviews/:id/assign
router.post('/reviews/:id/assign', async (req, res) => {
    try {
        const review = await get(
            'SELECT * FROM legal_reviews WHERE id = ? AND firm_id = ?',
            [req.params.id, req.firm.id]
        );
        if (!review) return res.status(404).json({ error: 'Revue introuvable' });

        const { collaborator_id } = req.body;
        if (!collaborator_id) return res.status(400).json({ error: 'collaborator_id requis' });

        const collaborator = await get(
            'SELECT * FROM law_firm_collaborators WHERE id = ? AND firm_id = ? AND is_active = TRUE',
            [collaborator_id, req.firm.id]
        );
        if (!collaborator) return res.status(404).json({ error: 'Collaborateur introuvable' });

        await run(
            "UPDATE legal_reviews SET assigned_to = ?, status = CASE WHEN status = 'pending' THEN 'in_review' ELSE status END WHERE id = ?",
            [collaborator.id, review.id]
        );

        return res.json({ id: review.id, assigned_to: collaborator.id, assigned_name: collaborator.full_name });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur assignation revue' });
    }
});

// ── Documents ────────────────────────────────────────────────────────────

// GET /api/legal/documents
router.get('/documents', async (req, res) => {
    try {
        const { type, status } = req.query;
        let conditions = ['ld.firm_id = ?'];
        let params = [req.firm.id];

        if (type) {
            conditions.push('ld.document_type = ?');
            params.push(type);
        }
        if (status) {
            conditions.push('ld.status = ?');
            params.push(status);
        }

        const where = conditions.join(' AND ');

        const rows = await all(
            `SELECT ld.*, u.full_name, u.email
             FROM legal_documents ld
             LEFT JOIN users u ON ld.user_id = u.id
             WHERE ${where}
             ORDER BY ld.id DESC`,
            params
        );

        // Map DB column names to frontend expected names
        const documents = rows.map(r => ({
            ...r,
            filename: r.file_name || r.filename || null,
            url: r.file_url || r.url || null,
            review_number: r.review_number || null
        }));

        return res.json({ documents });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement documents' });
    }
});

// POST /api/legal/documents/upload
router.post('/documents/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Fichier requis' });

        const { review_id, user_id, document_type, is_template } = req.body;
        if (!document_type) return res.status(400).json({ error: 'document_type requis' });

        const validTypes = ['contract_template', 'signed_contract', 'legal_notice', 'amendment',
            'power_of_attorney', 'compliance_cert', 'invoice', 'other'];
        if (!validTypes.includes(document_type)) {
            return res.status(400).json({ error: 'Type de document invalide' });
        }

        let filePath = '';
        let publicUrl = '';
        const { storeDocument } = require('../services/storage');
        try {
            const stored = await storeDocument(req.file, 'legal-documents');
            filePath = stored.path || '';
            publicUrl = stored.publicUrl || '';
        } catch (storageErr) {
            filePath = req.file.originalname;
        }

        const result = await run(
            `INSERT INTO legal_documents(firm_id, review_id, user_id, document_type, file_name, file_url, uploaded_by, is_template, version, status)
             VALUES (?, ?, ?, ?, ?, ?, 'firm', ?, 1, 'draft')`,
            [req.firm.id, review_id || null, user_id || null, document_type, req.file.originalname, publicUrl || filePath, is_template === 'true' || is_template === true ? true : false]
        );

        return res.status(201).json({
            id: result.id,
            file_name: req.file.originalname,
            document_type,
            status: 'draft'
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur upload document' });
    }
});

// PUT /api/legal/documents/:id/status
router.put('/documents/:id/status', async (req, res) => {
    try {
        const doc = await get(
            'SELECT * FROM legal_documents WHERE id = ? AND firm_id = ?',
            [req.params.id, req.firm.id]
        );
        if (!doc) return res.status(404).json({ error: 'Document introuvable' });

        const { status } = req.body;
        const validStatuses = ['draft', 'pending_review', 'approved', 'rejected', 'signed', 'archived'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Statut invalide' });
        }

        await run(
            'UPDATE legal_documents SET status = ? WHERE id = ?',
            [status, doc.id]
        );

        return res.json({ id: doc.id, status });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise a jour statut document' });
    }
});

// GET /api/legal/documents/templates
router.get('/documents/templates', async (req, res) => {
    try {
        const templates = await all(
            'SELECT * FROM legal_documents WHERE firm_id = ? AND is_template = TRUE ORDER BY id DESC',
            [req.firm.id]
        );
        return res.json({ templates });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement modeles' });
    }
});

// ── Messages ─────────────────────────────────────────────────────────────

// GET /api/legal/messages
router.get('/messages', async (req, res) => {
    try {
        const { review_id } = req.query;
        let conditions = ['lm.firm_id = ?'];
        let params = [req.firm.id];

        if (review_id) {
            conditions.push('lm.review_id = ?');
            params.push(review_id);
        }

        const where = conditions.join(' AND ');

        const messages = await all(
            `SELECT lm.*
             FROM legal_messages lm
             WHERE ${where}
             ORDER BY lm.id DESC`,
            params
        );

        return res.json({ messages });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement messages' });
    }
});

// POST /api/legal/messages
router.post('/messages', async (req, res) => {
    try {
        const { review_id, recipient_type, recipient_id, subject, body, attachment_url } = req.body;
        if (!body) return res.status(400).json({ error: 'Corps du message requis' });
        if (!recipient_type || !recipient_id) return res.status(400).json({ error: 'Destinataire requis' });

        const safeSubject = sanitizeText(subject || '', 500);
        const safeBody = sanitizeText(body, 5000);

        const result = await run(
            `INSERT INTO legal_messages(firm_id, review_id, sender_type, sender_id, recipient_type, recipient_id, subject, body, attachment_url, is_read)
             VALUES (?, ?, 'firm', ?, ?, ?, ?, ?, ?, FALSE)`,
            [req.firm.id, review_id || null, req.firm.id, recipient_type, recipient_id, safeSubject, safeBody, attachment_url || null]
        );

        return res.status(201).json({ id: result.id, subject: safeSubject });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur envoi message' });
    }
});

// PUT /api/legal/messages/:id/read
router.put('/messages/:id/read', async (req, res) => {
    try {
        const message = await get(
            'SELECT * FROM legal_messages WHERE id = ? AND firm_id = ?',
            [req.params.id, req.firm.id]
        );
        if (!message) return res.status(404).json({ error: 'Message introuvable' });

        await run(
            'UPDATE legal_messages SET is_read = TRUE WHERE id = ?',
            [message.id]
        );

        return res.json({ id: message.id, is_read: true });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur marquage message' });
    }
});

// ── Invoices ─────────────────────────────────────────────────────────────

// GET /api/legal/invoices
router.get('/invoices', async (req, res) => {
    try {
        const invoices = await all(
            `SELECT li.*, u.full_name, u.email, u.phone
             FROM legal_invoices li
             JOIN users u ON li.user_id = u.id
             WHERE li.firm_id = ?
             ORDER BY li.id DESC`,
            [req.firm.id]
        );
        return res.json({ invoices });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement factures' });
    }
});

// POST /api/legal/invoices/generate
router.post('/invoices/generate', async (req, res) => {
    try {
        const firmId = req.firm.id;
        const dailyRate = Number(req.firm.daily_legal_fee) || 100;

        // Get all active reservations
        const activeReservations = await all(
            "SELECT r.*, u.full_name, u.email FROM reservations r JOIN users u ON r.user_id = u.id WHERE r.status = 'active'",
            []
        );

        let generated = 0;
        const now = new Date();

        for (const reservation of activeReservations) {
            // Find the last invoice for this reservation from this firm
            const lastInvoice = await get(
                'SELECT * FROM legal_invoices WHERE firm_id = ? AND reservation_id = ? ORDER BY period_end DESC LIMIT 1',
                [firmId, reservation.id]
            );

            let periodStart;
            if (lastInvoice) {
                // Start from the day after last invoice period end
                periodStart = new Date(lastInvoice.period_end);
                periodStart.setDate(periodStart.getDate() + 1);
            } else {
                // Start from reservation creation date
                periodStart = new Date(reservation.created_at);
            }

            // Calculate days
            const periodEnd = new Date(now.toISOString().split('T')[0]);
            const diffMs = periodEnd - periodStart;
            const daysCount = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (daysCount <= 0) continue;

            const totalAmount = daysCount * dailyRate;

            await run(
                `INSERT INTO legal_invoices(firm_id, reservation_id, user_id, period_start, period_end, days_count, daily_rate, total_amount, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [firmId, reservation.id, reservation.user_id, periodStart.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0], daysCount, dailyRate, totalAmount]
            );

            generated++;
        }

        return res.json({ message: `${generated} facture(s) generee(s)`, generated });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur generation factures' });
    }
});

// PUT /api/legal/invoices/:id/request-payment
router.put('/invoices/:id/request-payment', async (req, res) => {
    try {
        const invoice = await get(
            'SELECT * FROM legal_invoices WHERE id = ? AND firm_id = ?',
            [req.params.id, req.firm.id]
        );
        if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });

        await run(
            "UPDATE legal_invoices SET status = 'approved' WHERE id = ?",
            [invoice.id]
        );

        return res.json({ id: invoice.id, status: 'approved' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur demande paiement' });
    }
});

// ── Collaborators ────────────────────────────────────────────────────────

// GET /api/legal/collaborators
router.get('/collaborators', async (req, res) => {
    try {
        const collaborators = await all(
            'SELECT id, firm_id, full_name, email, phone, role, permissions, is_active, created_at FROM law_firm_collaborators WHERE firm_id = ? ORDER BY id DESC',
            [req.firm.id]
        );
        return res.json({ collaborators });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement collaborateurs' });
    }
});

// POST /api/legal/collaborators
router.post('/collaborators', async (req, res) => {
    try {
        const { full_name, email, phone, role, permissions, password } = req.body;
        if (!full_name || !email || !password) {
            return res.status(400).json({ error: 'Nom, email et mot de passe requis' });
        }

        const validRoles = ['partner', 'associate', 'paralegal', 'secretary'];
        if (role && !validRoles.includes(role)) {
            return res.status(400).json({ error: 'Role invalide' });
        }

        const validPermissions = ['read', 'write', 'admin'];
        if (permissions && !validPermissions.includes(permissions)) {
            return res.status(400).json({ error: 'Permission invalide' });
        }

        // Check if email already exists for this firm
        const existing = await get(
            'SELECT id FROM law_firm_collaborators WHERE firm_id = ? AND email = ?',
            [req.firm.id, email.trim().toLowerCase()]
        );
        if (existing) return res.status(409).json({ error: 'Email deja utilise dans ce cabinet' });

        const safeName = sanitizeText(full_name, 255);
        const safeEmail = email.trim().toLowerCase();
        const safePhone = sanitizeText(phone || '', 50);
        const safeRole = role || 'associate';
        const safePermissions = permissions || 'read';

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await run(
            `INSERT INTO law_firm_collaborators(firm_id, full_name, email, phone, role, permissions, password_hash, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [req.firm.id, safeName, safeEmail, safePhone, safeRole, safePermissions, passwordHash]
        );

        return res.status(201).json({
            id: result.id,
            full_name: safeName,
            email: safeEmail,
            role: safeRole,
            permissions: safePermissions
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur creation collaborateur' });
    }
});

// PUT /api/legal/collaborators/:id
router.put('/collaborators/:id', async (req, res) => {
    try {
        const collaborator = await get(
            'SELECT * FROM law_firm_collaborators WHERE id = ? AND firm_id = ?',
            [req.params.id, req.firm.id]
        );
        if (!collaborator) return res.status(404).json({ error: 'Collaborateur introuvable' });

        const { full_name, phone, role, permissions, is_active } = req.body;

        const validRoles = ['partner', 'associate', 'paralegal', 'secretary'];
        if (role && !validRoles.includes(role)) {
            return res.status(400).json({ error: 'Role invalide' });
        }

        const validPermissions = ['read', 'write', 'admin'];
        if (permissions && !validPermissions.includes(permissions)) {
            return res.status(400).json({ error: 'Permission invalide' });
        }

        const safeName = full_name ? sanitizeText(full_name, 255) : collaborator.full_name;
        const safePhone = phone !== undefined ? sanitizeText(phone, 50) : collaborator.phone;
        const safeRole = role || collaborator.role;
        const safePermissions = permissions || collaborator.permissions;
        const safeActive = is_active !== undefined ? is_active : collaborator.is_active;

        await run(
            'UPDATE law_firm_collaborators SET full_name = ?, phone = ?, role = ?, permissions = ?, is_active = ? WHERE id = ?',
            [safeName, safePhone, safeRole, safePermissions, safeActive, collaborator.id]
        );

        return res.json({ id: collaborator.id, full_name: safeName, role: safeRole, permissions: safePermissions });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise a jour collaborateur' });
    }
});

// DELETE /api/legal/collaborators/:id
router.delete('/collaborators/:id', async (req, res) => {
    try {
        const collaborator = await get(
            'SELECT * FROM law_firm_collaborators WHERE id = ? AND firm_id = ?',
            [req.params.id, req.firm.id]
        );
        if (!collaborator) return res.status(404).json({ error: 'Collaborateur introuvable' });

        await run(
            'UPDATE law_firm_collaborators SET is_active = FALSE WHERE id = ?',
            [collaborator.id]
        );

        return res.json({ message: 'Collaborateur desactive' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur suppression collaborateur' });
    }
});

// ── Subscriptions ────────────────────────────────────────────────────────

// GET /api/legal/subscriptions
router.get('/subscriptions', async (req, res) => {
    try {
        const subscriptions = await all(
            `SELECT r.id, r.lot_type, r.status, r.insurance_persons, r.created_at,
                    u.id as user_id, u.full_name, u.email, u.phone, u.city
             FROM reservations r
             JOIN users u ON r.user_id = u.id
             WHERE r.status = 'active'
             ORDER BY r.created_at DESC`,
            []
        );
        return res.json({ subscriptions });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement souscriptions' });
    }
});

// ── Profile ──────────────────────────────────────────────────────────────

// GET /api/legal/profile
router.get('/profile', async (req, res) => {
    try {
        return res.json({ firm: req.firm });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur profil' });
    }
});

// PUT /api/legal/profile
router.put('/profile', async (req, res) => {
    try {
        const { firm_name, license_number, address, phone, email, specialties, daily_legal_fee } = req.body;

        const safeName = sanitizeText(firm_name || req.firm.firm_name, 255);
        const safeLicense = sanitizeText(license_number || req.firm.license_number || '', 100);
        const safeAddress = sanitizeText(address || req.firm.address || '', 500);
        const safePhone = sanitizeText(phone || req.firm.phone || '', 50);
        const safeEmail = sanitizeText(email || req.firm.email || '', 255);
        const safeSpecialties = sanitizeText(specialties || req.firm.specialties || '', 500);
        const safeFee = daily_legal_fee !== undefined ? Math.max(0, Number(daily_legal_fee) || 100) : req.firm.daily_legal_fee;

        await run(
            'UPDATE law_firms SET firm_name = ?, license_number = ?, address = ?, phone = ?, email = ?, specialties = ?, daily_legal_fee = ? WHERE id = ?',
            [safeName, safeLicense, safeAddress, safePhone, safeEmail, safeSpecialties, safeFee, req.firm.id]
        );

        return res.json({ message: 'Profil mis a jour' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise a jour profil' });
    }
});

module.exports = router;
