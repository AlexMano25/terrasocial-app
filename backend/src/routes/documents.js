const path = require('path');
const express = require('express');
const multer = require('multer');
const { all, run } = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');
const { storeDocument } = require('../services/storage');

const router = express.Router();

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, path.join(__dirname, '..', '..', 'uploads'));
    },
    filename(req, file, cb) {
        const safe = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        cb(null, `${Date.now()}_${safe}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter(req, file, cb) {
        const allowedTypes = new Set([
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]);
        if (!allowedTypes.has(file.mimetype)) {
            cb(new Error('Type de fichier non autorisé'));
            return;
        }
        cb(null, true);
    }
});

router.use(requireAuth, requireRole(['client', 'owner', 'admin']));

router.get('/', async (req, res) => {
    try {
        const rows = await all(
            `SELECT id, reservation_id, owner_property_id, document_type, file_name, file_path, storage_mode, public_url, uploaded_at
             FROM documents
             WHERE user_id = ?
             ORDER BY uploaded_at DESC`,
            [req.user.id]
        );
        return res.json({ documents: rows });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur lecture documents' });
    }
});

router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Fichier requis' });
        }

        const { document_type, reservation_id, owner_property_id } = req.body;
        if (!document_type) {
            return res.status(400).json({ error: 'document_type requis' });
        }

        const stored = await storeDocument(req.file, req.user.id);

        const result = await run(
            `INSERT INTO documents(user_id, reservation_id, owner_property_id, document_type, file_name, file_path, storage_mode, public_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                reservation_id || null,
                owner_property_id || null,
                document_type,
                req.file.originalname,
                stored.file_path,
                stored.storage_mode,
                stored.public_url
            ]
        );

        await req.audit?.('document.uploaded', { user_id: req.user.id, document_id: result.id, type: document_type });
        return res.status(201).json({
            id: result.id,
            file_name: req.file.originalname,
            file_path: stored.file_path,
            storage_mode: stored.storage_mode,
            public_url: stored.public_url
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur upload document' });
    }
});

module.exports = router;
