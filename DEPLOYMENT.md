# Déploiement TERRASOCIAL

## 1) Frontend (Vercel)
Le projet racine contient désormais:
- `index.html` (accueil)
- `404.html` (redirection accueil)
- `vercel.json` (rewrite `/`)
- pages dashboard/auth/légales

### Configuration recommandée Vercel
- Framework preset: `Other`
- Root directory: `/` (ce dossier)
- Build command: vide
- Output directory: vide

### Domaine
- Branchez `social.manoverde.com` sur ce projet Vercel.
- Vérifiez que le DNS pointe vers Vercel (A/CNAME selon instruction Vercel).

## 2) Backend API
Le backend est dans `backend/`.

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Par défaut: `http://localhost:4000`

### Variables importantes
Dans `backend/.env`:
- `JWT_SECRET` (obligatoire, fort)
- `CORS_ORIGIN` (domaines frontend autorisés)
- `DB_CLIENT` (`sqlite` ou `postgres`)
- `DATABASE_URL` (requis si `DB_CLIENT=postgres`, ex: Supabase)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` (optionnel, stockage documents)

Exemple production:
```env
PORT=4000
JWT_SECRET=UN_SECRET_TRES_LONG_ET_UNIQUE
CORS_ORIGIN=https://social.manoverde.com
DB_CLIENT=postgres
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=documents
```

## 3) Connexion frontend <-> backend
Par défaut, le frontend appelle `http://localhost:4000`.

En production, définir avant chargement JS:
```html
<script>
  window.TERRASOCIAL_API_BASE = 'https://api.social.manoverde.com';
</script>
```

Ou stocker dans localStorage:
```js
localStorage.setItem('ts_api_base', 'https://api.social.manoverde.com');
```

## 4) Vérifications post-déploiement
- `/` charge l'accueil sans 404.
- `login.html` accessible.
- `password-reset.html` accessible.
- `register-client.html` et `register-owner.html` fonctionnent.
- Formulaire de `index.html` crée bien une demande via `/api/public/reservations`.
- Dashboard client/propriétaire charge sans erreurs CORS.
- Upload document fonctionne (local ou Supabase Storage selon configuration).
