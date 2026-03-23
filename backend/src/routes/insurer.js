const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { all, get, run } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { sanitizeText } = require('../utils/validation');

const router = express.Router();

// All routes require auth
router.use(requireAuth);

// Check insurer status
async function requireInsurer(req, res, next) {
    const insurer = await get('SELECT * FROM insurers WHERE user_id = ? AND is_active = TRUE', [req.user.id]);
    if (!insurer) return res.status(403).json({ error: 'Compte assureur requis' });
    req.insurer = insurer;
    return next();
}

router.use(requireInsurer);

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

// GET /api/insurer/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const insurerId = req.insurer.id;

        const totalSubscribers = await get(
            "SELECT COUNT(DISTINCT ipd.user_id) as count FROM insured_persons_details ipd WHERE ipd.insurer_id = ? AND ipd.is_active = TRUE",
            [insurerId]
        );
        const activeContracts = await get(
            "SELECT COUNT(*) as count FROM insurer_contracts WHERE insurer_id = ? AND status IN ('draft', 'signature_requested')",
            [insurerId]
        );
        const signedContracts = await get(
            "SELECT COUNT(*) as count FROM insurer_contracts WHERE insurer_id = ? AND status = 'signed'",
            [insurerId]
        );
        const totalPersons = await get(
            "SELECT COUNT(*) as count FROM insured_persons_details WHERE insurer_id = ? AND is_active = TRUE",
            [insurerId]
        );

        return res.json({
            insurer: {
                id: req.insurer.id,
                company_name: req.insurer.company_name,
                daily_premium_cost: req.insurer.daily_premium_cost,
                license_number: req.insurer.license_number
            },
            stats: {
                total_subscribers: Number(totalSubscribers?.count || 0),
                active_contracts: Number(activeContracts?.count || 0),
                signed_contracts: Number(signedContracts?.count || 0),
                total_insured_persons: Number(totalPersons?.count || 0)
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement dashboard' });
    }
});

// GET /api/insurer/subscribers
router.get('/subscribers', async (req, res) => {
    try {
        const subscribers = await all(
            `SELECT u.id, u.full_name, u.email, u.phone, u.city,
                    r.id as reservation_id, r.lot_type, r.lot_price, r.insurance_persons, r.status as reservation_status,
                    r.created_at as subscription_date
             FROM reservations r
             JOIN users u ON r.user_id = u.id
             WHERE r.insurer_id = ? AND r.insurance_persons > 0
             ORDER BY r.created_at DESC`,
            [req.insurer.id]
        );
        return res.json({ subscribers });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement souscripteurs' });
    }
});

// POST /api/insurer/contracts/upload-template
router.post('/contracts/upload-template', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Fichier requis' });

        const { reservation_id, user_id } = req.body;
        if (!reservation_id || !user_id) {
            return res.status(400).json({ error: 'reservation_id et user_id requis' });
        }

        const contractNumber = 'ASS-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

        // Store file (use Supabase storage if available, otherwise local)
        let filePath = '';
        let publicUrl = '';
        const { storeDocument } = require('../services/storage');
        try {
            const stored = await storeDocument(req.file, 'insurance-contracts');
            filePath = stored.path || '';
            publicUrl = stored.publicUrl || '';
        } catch (storageErr) {
            // Fallback: store info without file
            filePath = req.file.originalname;
        }

        const result = await run(
            `INSERT INTO insurer_contracts(insurer_id, reservation_id, user_id, contract_number, template_file_path, template_public_url, status)
             VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
            [req.insurer.id, reservation_id, user_id, contractNumber, filePath, publicUrl]
        );

        return res.status(201).json({
            id: result.id,
            contract_number: contractNumber,
            status: 'draft'
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur upload contrat' });
    }
});

// POST /api/insurer/contracts/:id/request-signature
router.post('/contracts/:id/request-signature', async (req, res) => {
    try {
        const contract = await get(
            'SELECT * FROM insurer_contracts WHERE id = ? AND insurer_id = ?',
            [req.params.id, req.insurer.id]
        );
        if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });

        await run(
            "UPDATE insurer_contracts SET status = 'signature_requested', signature_requested_at = CURRENT_TIMESTAMP WHERE id = ?",
            [contract.id]
        );

        return res.json({ id: contract.id, status: 'signature_requested' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur demande signature' });
    }
});

// POST /api/insurer/contracts/:id/mark-signed
router.post('/contracts/:id/mark-signed', upload.single('file'), async (req, res) => {
    try {
        const contract = await get(
            'SELECT * FROM insurer_contracts WHERE id = ? AND insurer_id = ?',
            [req.params.id, req.insurer.id]
        );
        if (!contract) return res.status(404).json({ error: 'Contrat introuvable' });

        let signedPath = '';
        let signedUrl = '';
        if (req.file) {
            const { storeDocument } = require('../services/storage');
            try {
                const stored = await storeDocument(req.file, 'signed-contracts');
                signedPath = stored.path || '';
                signedUrl = stored.publicUrl || '';
            } catch (e) {
                signedPath = req.file.originalname;
            }
        }

        await run(
            "UPDATE insurer_contracts SET status = 'signed', signed_at = CURRENT_TIMESTAMP, signed_file_path = ?, signed_public_url = ? WHERE id = ?",
            [signedPath, signedUrl, contract.id]
        );

        return res.json({ id: contract.id, status: 'signed' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur marquage signature' });
    }
});

// GET /api/insurer/insured-persons
router.get('/insured-persons', async (req, res) => {
    try {
        const persons = await all(
            `SELECT ipd.*, u.full_name as subscriber_name, u.email as subscriber_email, u.phone as subscriber_phone
             FROM insured_persons_details ipd
             JOIN users u ON ipd.user_id = u.id
             WHERE ipd.insurer_id = ? AND ipd.is_active = TRUE
             ORDER BY ipd.created_at DESC`,
            [req.insurer.id]
        );
        return res.json({ persons });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement assures' });
    }
});

// POST /api/insurer/insured-persons/:id/generate-card
router.post('/insured-persons/:id/generate-card', async (req, res) => {
    try {
        const person = await get(
            'SELECT ipd.*, u.full_name as subscriber_name FROM insured_persons_details ipd JOIN users u ON ipd.user_id = u.id WHERE ipd.id = ? AND ipd.insurer_id = ?',
            [req.params.id, req.insurer.id]
        );
        if (!person) return res.status(404).json({ error: 'Assure introuvable' });

        // Generate QR code data
        const qrData = JSON.stringify({
            id: person.id,
            name: person.full_name,
            subscriber: person.subscriber_name,
            insurer: req.insurer.company_name,
            reservation_id: person.reservation_id,
            generated_at: new Date().toISOString()
        });

        await run(
            'UPDATE insured_persons_details SET qr_code_data = ?, card_generated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [qrData, person.id]
        );

        return res.json({
            id: person.id,
            qr_code_data: qrData,
            card_generated_at: new Date().toISOString()
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur generation carte' });
    }
});

// GET /api/insurer/insured-persons/:id/card — Generate PDF card with QR
router.get('/insured-persons/:id/card', async (req, res) => {
    try {
        const person = await get(
            'SELECT ipd.*, u.full_name as subscriber_name FROM insured_persons_details ipd JOIN users u ON ipd.user_id = u.id WHERE ipd.id = ? AND ipd.insurer_id = ?',
            [req.params.id, req.insurer.id]
        );
        if (!person) return res.status(404).json({ error: 'Assure introuvable' });

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: [350, 200], margin: 20 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="carte-assure-${person.id}.pdf"`);
        doc.pipe(res);

        // Card header
        doc.fontSize(14).font('Helvetica-Bold').text('CARTE D\'ASSURE FONCIER', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(req.insurer.company_name, { align: 'center' });
        doc.moveDown(0.5);

        // Person info
        doc.fontSize(10).font('Helvetica-Bold').text('Assure: ').font('Helvetica').text(person.full_name || '-', { continued: false });
        doc.fontSize(9).text('Souscripteur: ' + (person.subscriber_name || '-'));
        if (person.id_number) doc.text('N° ID: ' + person.id_number);
        if (person.date_of_birth) doc.text('Date de naissance: ' + person.date_of_birth);
        doc.moveDown(0.3);
        doc.fontSize(8).fillColor('#666').text('Genere le: ' + new Date().toLocaleDateString('fr-FR'));

        doc.end();
    } catch (error) {
        return res.status(500).json({ error: 'Erreur generation carte PDF' });
    }
});

// GET /api/insurer/profile
router.get('/profile', async (req, res) => {
    try {
        return res.json({ insurer: req.insurer });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur profil' });
    }
});

// PUT /api/insurer/profile
router.put('/profile', async (req, res) => {
    try {
        const { company_name, license_number, phone, email, daily_premium_cost } = req.body;
        const safeName = sanitizeText(company_name || req.insurer.company_name, 255);
        const safeLicense = sanitizeText(license_number || '', 100);
        const safePhone = sanitizeText(phone || '', 50);
        const safeEmail = sanitizeText(email || '', 255);
        const safeCost = Math.max(100, Math.min(349, Number(daily_premium_cost) || 100));

        await run(
            `UPDATE insurers SET company_name = ?, license_number = ?, phone = ?, email = ?, daily_premium_cost = ? WHERE id = ?`,
            [safeName, safeLicense, safePhone, safeEmail, safeCost, req.insurer.id]
        );

        return res.json({ message: 'Profil mis a jour' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur mise a jour profil' });
    }
});

// ── Analytics ──────────────────────────────────────────────────────────

// GET /api/insurer/analytics — subscription analytics with filters
router.get('/analytics', async (req, res) => {
    try {
        const insurerId = req.insurer.id;
        const { date_from, date_to, city } = req.query;

        let conditions = ['ipd.insurer_id = ?'];
        let params = [insurerId];

        if (date_from) {
            conditions.push('ipd.created_at >= ?');
            params.push(date_from);
        }
        if (date_to) {
            conditions.push('ipd.created_at <= ?');
            params.push(date_to + 'T23:59:59');
        }
        if (city) {
            conditions.push('u.city LIKE ?');
            params.push('%' + city + '%');
        }

        const where = conditions.join(' AND ');

        // Subscribers filtered
        const subscribers = await all(
            `SELECT u.id, u.full_name, u.email, u.phone, u.city,
                    r.id as reservation_id, r.lot_type, r.lot_price, r.insurance_persons,
                    r.duration_months, r.status as reservation_status, r.created_at as subscription_date,
                    ipd.full_name as insured_name, ipd.created_at as insured_since
             FROM insured_persons_details ipd
             JOIN users u ON ipd.user_id = u.id
             LEFT JOIN reservations r ON ipd.reservation_id = r.id
             WHERE ${where} AND ipd.is_active = TRUE
             ORDER BY ipd.created_at DESC`,
            params
        );

        // Stats by city (geolocation)
        const byCity = await all(
            `SELECT u.city, COUNT(DISTINCT ipd.user_id) as subscriber_count, COUNT(ipd.id) as persons_count
             FROM insured_persons_details ipd
             JOIN users u ON ipd.user_id = u.id
             WHERE ipd.insurer_id = ? AND ipd.is_active = TRUE AND u.city IS NOT NULL AND u.city != ''
             GROUP BY u.city ORDER BY subscriber_count DESC`,
            [insurerId]
        );

        // Stats by month (try/catch for SQLite compatibility — TO_CHAR is PostgreSQL-specific)
        let byMonth = [];
        try {
            byMonth = await all(
                `SELECT TO_CHAR(ipd.created_at, 'YYYY-MM') as month, COUNT(*) as count
                 FROM insured_persons_details ipd
                 WHERE ipd.insurer_id = ? AND ipd.is_active = TRUE
                 GROUP BY TO_CHAR(ipd.created_at, 'YYYY-MM')
                 ORDER BY month DESC LIMIT 12`,
                [insurerId]
            );
        } catch (e) {
            // SQLite fallback using strftime
            try {
                byMonth = await all(
                    `SELECT strftime('%Y-%m', ipd.created_at) as month, COUNT(*) as count
                     FROM insured_persons_details ipd
                     WHERE ipd.insurer_id = ? AND ipd.is_active = TRUE
                     GROUP BY strftime('%Y-%m', ipd.created_at)
                     ORDER BY month DESC LIMIT 12`,
                    [insurerId]
                );
            } catch (e2) { /* ignore */ }
        }

        // Prime calculations
        const dailyCost = Number(req.insurer.daily_premium_cost || 100);
        const totalPersons = subscribers.length;
        const dailyRevenue = totalPersons * dailyCost;
        const monthlyRevenue = dailyRevenue * 30;
        const annualRevenue = dailyRevenue * 365;
        const dailyCollection = totalPersons * 350; // what TERRASOCIAL collects from clients
        const monthlyCollection = dailyCollection * 30;

        return res.json({
            subscribers,
            stats: {
                total_filtered: subscribers.length,
                by_city: byCity,
                by_month: byMonth
            },
            primes: {
                daily_premium_cost: dailyCost,
                total_insured_persons: totalPersons,
                daily_revenue: dailyRevenue,
                monthly_revenue: monthlyRevenue,
                annual_revenue: annualRevenue,
                daily_collection_from_clients: dailyCollection,
                monthly_collection_from_clients: monthlyCollection,
                mano_verde_daily_margin: dailyCollection - dailyRevenue,
                mano_verde_monthly_margin: monthlyCollection - monthlyRevenue
            }
        });
    } catch (error) {
        console.error('[INSURER ANALYTICS]', error.message);
        return res.status(500).json({ error: 'Erreur chargement analytics' });
    }
});

// ── Hospitals ──────────────────────────────────────────────────────────

// GET /api/insurer/hospitals
router.get('/hospitals', async (req, res) => {
    try {
        const hospitals = await all(
            'SELECT * FROM insurer_hospitals WHERE insurer_id = ? AND is_active = TRUE ORDER BY city, name',
            [req.insurer.id]
        );
        return res.json({ hospitals });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur chargement hopitaux' });
    }
});

// POST /api/insurer/hospitals
router.post('/hospitals', async (req, res) => {
    try {
        const { name, city, address, phone, specialty } = req.body;
        if (!name || !city) return res.status(400).json({ error: 'Nom et ville requis' });

        const safeName = sanitizeText(name, 255);
        const safeCity = sanitizeText(city, 100);
        const safeAddress = sanitizeText(address || '', 500);
        const safePhone = sanitizeText(phone || '', 50);
        const safeSpecialty = sanitizeText(specialty || '', 200);

        const result = await run(
            'INSERT INTO insurer_hospitals(insurer_id, name, city, address, phone, specialty) VALUES (?, ?, ?, ?, ?, ?)',
            [req.insurer.id, safeName, safeCity, safeAddress, safePhone, safeSpecialty]
        );

        return res.status(201).json({ id: result.id, name: safeName, city: safeCity });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur ajout hopital' });
    }
});

// DELETE /api/insurer/hospitals/:id
router.delete('/hospitals/:id', async (req, res) => {
    try {
        await run(
            'UPDATE insurer_hospitals SET is_active = FALSE WHERE id = ? AND insurer_id = ?',
            [req.params.id, req.insurer.id]
        );
        return res.json({ message: 'Hopital retire' });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur suppression hopital' });
    }
});

module.exports = router;
