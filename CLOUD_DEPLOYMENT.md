# Déploiement cloud complet (Vercel + API + Base de données)

## Date de référence
Plan préparé le 16 février 2026.

## Architecture cible
- Frontend statique: Vercel sur `https://social.manoverde.com`
- API backend: `https://api.social.manoverde.com`
- Base de données: PostgreSQL Supabase
- Stockage documents: Supabase Storage

## Setup recommandé (Supabase)
1. Créer projet Supabase.
2. Exécuter `backend/sql/postgres_schema.sql` dans SQL editor.
3. Configurer backend:
   - `DB_CLIENT=postgres`
   - `DATABASE_URL` (string Supabase pooler/session)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET=documents`
4. Migrer les données historiques SQLite:
   - `npm run migrate:sqlite-to-postgres`
5. Activer observabilité (logs, alerting, uptime checks).

## DNS conseillé
- `social.manoverde.com` -> Vercel
- `api.social.manoverde.com` -> provider API

## Sécurité minimale production
- `JWT_SECRET` long et unique
- CORS strict: uniquement domaine frontend
- HTTPS obligatoire
- Rotation des clés
- Sauvegardes base + documents
- Purge périodique tokens reset expirés
- Clé `SUPABASE_SERVICE_ROLE_KEY` stockée uniquement côté backend (jamais frontend)

## Commandes conteneurs (self-host)
```bash
docker compose -f docker-compose.cloud.yml up -d --build
```
Frontend: `http://localhost:8080`
API: `http://localhost:4000`

## Variable frontend API
Le frontend lit `window.TERRASOCIAL_API_BASE` puis `localStorage.ts_api_base`.
En production, définir:
```html
<script>
  window.TERRASOCIAL_API_BASE = 'https://api.social.manoverde.com';
</script>
```
