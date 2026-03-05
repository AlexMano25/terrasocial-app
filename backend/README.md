# TERRASOCIAL Backend

## Stack
- Node.js + Express
- SQLite (fichier local)
- JWT (auth)
- Multer (upload documents)
- Rate limiting + audit logs + password reset tokenisé

## Installation
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API locale: `http://localhost:4000`

## Endpoints principaux
- `POST /api/auth/register/client`
- `POST /api/auth/register/owner`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/request-password-reset`
- `POST /api/auth/reset-password`
- `POST /api/public/reservations` (depuis la page d'accueil)
- `GET /api/client/dashboard`
- `POST /api/client/reservations`
- `GET /api/owner/dashboard`
- `POST /api/owner/properties`
- `GET /api/payments`
- `POST /api/payments`
- `GET /api/documents`
- `POST /api/documents`
- `GET /api/admin/audit-logs` (admin uniquement)

## Supabase / PostgreSQL
Pour utiliser Supabase PostgreSQL:
1. Mettre `DB_CLIENT=postgres` dans `.env`
2. Renseigner `DATABASE_URL` (ou `SUPABASE_DB_URL`)
3. Lancer l'API (`npm run dev`)

Migration des données SQLite existantes vers PostgreSQL:
```bash
DB_CLIENT=postgres DATABASE_URL=\"...\" npm run migrate:sqlite-to-postgres
```

## Supabase Storage (documents)
Optionnel, pour stocker les documents hors disque local:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (défaut: `documents`)

## Compte admin initial
- Email: `admin@terrasocial.cm`
- Mot de passe: `Admin@12345`

Changez ce mot de passe immédiatement en production.

## Sécurité
- `helmet` activé
- CORS strict basé sur `CORS_ORIGIN`
- Limitation du débit globale + auth + upload
- Validation serveur des entrées principales
- Fichiers upload limités (PDF/images/DOC/DOCX, max 8MB)
- Journal d'audit en base (`audit_logs`)
