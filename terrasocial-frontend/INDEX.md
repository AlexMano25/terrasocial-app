# INDEX - TERRASOCIAL Frontend PWA

Navigation rapide vers tous les fichiers et leur documentation.

## 📋 Table des Matières

- [Configuration Principale](#configuration-principale)
- [JavaScript Modules](#javascript-modules)
- [Styles](#styles)
- [Vues HTML](#vues-html)
- [Déploiement](#déploiement)
- [Documentation](#documentation)

---

## Configuration Principale

### index.html
**Chemin:** `/index.html`
**Description:** Page principale (SPA - Single Page Application)
**Contient:**
- Structure HTML5 sémantique
- Enregistrement Service Worker
- Navigation globale
- Modals container
- Footer avec disclaimer

**À Personnaliser:**
- Logo dans `.logo-icon`
- Domaine (CORS)
- Texte menu navigation

**Clé d'intégration:**
```html
<!-- Modifié en production pour votre URL -->
<link rel="manifest" href="manifest.json">
<script src="js/supabase-client.js"></script>
```

---

### manifest.json
**Chemin:** `/manifest.json`
**Description:** Configuration PWA
**Contient:**
- Métadonnées app
- Icônes PWA
- Couleurs thème
- Shortcuts

**À Personnaliser:**
- `start_url` si pas à la racine
- `icons` chemin vers vos assets
- Couleurs thème

**Exemple de configuration:**
```json
{
  "name": "TERRASOCIAL - Accès à la terre",
  "theme_color": "#2E7D32",
  "icons": [...]
}
```

---

## JavaScript Modules

### js/app.js
**Chemin:** `/js/app.js`
**Taille:** ~21 KB
**Description:** Orchestration principale de l'application
**Exports:** Classe `TermaSocialApp`
**Principales Fonctionnalités:**
- Initialisation routes
- Gestion des vues dynamiques
- Gestion des modals
- Toasts et notifications
- Utilitaires globaux

**Points d'Entrée:**
```javascript
// Au chargement DOM
document.addEventListener('DOMContentLoaded', async () => {
    const app = new TermaSocialApp();
    await app.init();
});
```

**Routes Clés:**
```javascript
router.register('/', () => loadView('views/public.html'))
router.register('/offres', () => loadView('views/offres.html'))
router.register('/client', () => loadView('views/client.html'))
```

---

### js/supabase-client.js
**Chemin:** `/js/supabase-client.js`
**Taille:** ~7.3 KB
**Description:** Client Supabase personnalisé
**Exports:** Classe `SupabaseClient`
**À Configurer:**
```javascript
const supabase = new SupabaseClient(
  'https://YOUR_PROJECT_ID.supabase.co',
  'YOUR_ANON_KEY'
);
```

**Méthodes Principales:**
```javascript
// Auth
supabase.signUp(email, password, userData)
supabase.signIn(email, password)
supabase.getCurrentUser()

// Data
supabase.select(table, options)
supabase.insert(table, data)
supabase.update(table, data, id)
supabase.delete(table, id)
```

---

### js/offline-manager.js
**Chemin:** `/js/offline-manager.js`
**Taille:** ~9.1 KB
**Description:** Gestion du mode hors ligne et synchronisation
**Exports:** Classe `OfflineManager`
**IndexedDB Stores:**
- `lots` - Terrains disponibles
- `subscriptions` - Souscriptions clients
- `payments` - Historique paiements
- `prospects` - Prospects agents
- `syncQueue` - File d'attente sync
- `cache` - Cache générique avec TTL

**Utilisation:**
```javascript
const offlineManager = new OfflineManager();
await offlineManager.init();

// Sauvegarder données
await offlineManager.saveData('lots', lotsArray);

// Récupérer données
const lots = await offlineManager.getAllData('lots');

// Ajouter à la file de sync
await offlineManager.addToSyncQueue({
  url: '/api/subscription',
  method: 'POST',
  body: data
});
```

---

### js/router.js
**Chemin:** `/js/router.js`
**Taille:** ~6.7 KB
**Description:** Router SPA simple
**Exports:** Classe `Router`
**Features:**
- Hash-based routing (#/)
- Routes dynamiques (/:id)
- Middlewares
- Hooks before/after

**Utilisation:**
```javascript
const router = new Router();

// Routes statiques
router.register('/accueil', viewHandler);

// Routes dynamiques
router.registerDynamic('/user/:id', viewHandler);

// Middlewares
router.use(async (path, route) => {
  // Vérification authentification, etc.
});

// Hooks
router.before(async (path) => showLoading(true));
router.after(async (path) => showLoading(false));

// Navigation
router.navigate('/accueil');
```

---

### js/auth.js
**Chemin:** `/js/auth.js`
**Taille:** ~9.4 KB
**Description:** Gestion complète de l'authentification
**Exports:** Classe `AuthManager`
**État Global:**
```javascript
const auth = new AuthManager(); // Instance globale

// Propriétés
auth.currentUser      // Objet utilisateur
auth.isAuthenticated  // Boolean
auth.userRole         // 'client', 'agent', 'admin'
```

**Méthodes:**
```javascript
await auth.signUp(email, password, userData)
await auth.signIn(email, password)
await auth.signOut()
auth.checkAuthStatus()
auth.hasRole(role)
auth.subscribe(callback) // Observer pattern
```

---

## Styles

### css/main.css
**Chemin:** `/css/main.css`
**Taille:** ~19 KB
**Description:** Système de design complet
**Contient:**
- Variables CSS (couleurs, espacements)
- Reset et styles globaux
- Composants réutilisables
- Grilles responsive
- Animations

**Variables Principales:**
```css
--primary-color: #2E7D32
--accent-color: #FF9800
--text-primary: #212121
--bg-primary: #FFFFFF
```

**Classes Utilitaires:**
```css
/* Spacing */
.mt-1, .mt-2, .mt-3
.mb-1, .mb-2, .mb-3
.p-1, .p-2, .p-3

/* Layout */
.grid-2, .grid-3
.flex, .flex-between, .flex-center
.gap-1, .gap-2

/* Text */
.text-center, .text-muted, .text-small

/* Colors */
.bg-primary, .bg-secondary

/* Responsive */
/* Media queries: 768px, 480px */
```

---

## Vues HTML

### views/public.html
**Chemin:** `/views/public.html`
**Description:** Accueil public
**Sections:**
- Hero section
- Features (6 cartes)
- Statistiques
- Dernières offres
- Comment ça marche
- Témoignages
- FAQ interactive
- Newsletter
- Disclaimer

**À Personnaliser:**
- Hero subtitle
- Features descriptions
- Testimonials
- FAQ content

---

### views/offres.html
**Chemin:** `/views/offres.html`
**Description:** Affichage et gestion des offres
**Features:**
- Recherche en temps réel
- Filtrage (location, prix, superficie)
- Vue grille/liste
- Détails modals
- Souscription depuis carte

**API Calls:**
```javascript
await supabase.getLots()
await supabase.getLotById(id)
await supabase.searchLots(query)
```

---

### views/client.html
**Chemin:** `/views/client.html`
**Description:** Espace personnel client
**Onglets:**
1. Mes Souscriptions
2. Historique Paiements
3. Documents
4. Support

**KPIs:**
- Souscriptions Actives
- Total Investi
- Paiements Complétés

---

### views/agent.html
**Chemin:** `/views/agent.html`
**Description:** Espace agent immobilier
**Onglets:**
1. Mes Prospects
2. Mes Commissions
3. Performance

**Fonctionnalités:**
- Ajouter prospect rapidement
- Filtrer par statut
- Voir statistiques
- Suivre commissions

---

### views/admin.html
**Chemin:** `/views/admin.html`
**Description:** Dashboard administrateur
**Onglets:**
1. Aperçu
2. Utilisateurs
3. Lots
4. Transactions
5. Rapports

**KPIs Affichés:**
- Utilisateurs totaux
- Lots publiés
- Montant total
- Transactions complétées
- En attente
- Taux conversion

---

### views/auth/signin.html
**Chemin:** `/views/auth/signin.html`
**Description:** Connexion
**Formulaire:**
- Email
- Mot de passe
- "Se souvenir de moi"

**Layout:** Deux colonnes (formulaire + side info)

---

### views/auth/signup.html
**Chemin:** `/views/auth/signup.html`
**Description:** Inscription
**Formulaire:**
- Prénom, Nom
- Email
- Téléphone
- Rôle (Client/Agent)
- Mot de passe

**Validation:** Mots de passe doivent correspondre

---

## Déploiement

### .htaccess
**Chemin:** `/.htaccess`
**Pour:** Apache 2.4+
**Contient:**
- Rewriting URL (SPA)
- Redirection HTTP → HTTPS
- Compression GZIP
- Cache headers
- Security headers (CSP, X-Frame-Options)

**À Adapter:**
- Chemins SSL si différents
- Domaine dans les headers

---

### nginx.conf
**Chemin:** `/nginx.conf`
**Pour:** Nginx
**Contient:**
- Configuration serveur HTTPS
- Rewriting URL
- Gzip compression
- Cache control
- Security headers
- Proxy API (optionnel)

**À Adapter:**
- Chemins SSL
- Domaine
- Root directory

---

## Documentation

### README.md
**Chemin:** `/README.md`
**Contient:**
- Vue d'ensemble technique
- Structure du projet
- Technologies utilisées
- Configuration requise
- Installation
- Optimisations
- Dépannage

**À Lire:**
- Avant déploiement
- Pour comprendre l'architecture
- Pour dépannage

---

### DEPLOYMENT.md
**Chemin:** `/DEPLOYMENT.md`
**Contient:**
- Prérequis
- Checklist déploiement
- Procédures Apache/Nginx
- Configuration SSL/TLS
- Tests post-déploiement
- Monitoring
- Troubleshooting
- Scaling
- Updates

**À Consulter:**
- Lors du déploiement
- Configuration production
- Monitoring en production

---

## Flux de Données

```
┌─────────────────┐
│   Application   │
│    (index.html) │
└────────┬────────┘
         │
         ├─→ js/app.js (orchestration)
         │      │
         │      ├─→ js/router.js (navigation)
         │      ├─→ js/auth.js (authentification)
         │      └─→ js/offline-manager.js (cache)
         │
         ├─→ css/main.css (styles)
         │
         └─→ views/*.html (contenu dynamique)
                  │
                  └─→ js/supabase-client.js
                         │
                         └─→ Supabase (backend)
```

---

## Configuration Checklist

**Avant Déploiement:**

- [ ] Modifier `js/supabase-client.js` avec vos URLs/clés
- [ ] Personnaliser `manifest.json` (nom, icônes)
- [ ] Adapter `.htaccess` ou `nginx.conf` (SSL paths)
- [ ] Créer assets (images, logos 192x512)
- [ ] Tester tous les formulaires
- [ ] Vérifier Service Worker enregistrement
- [ ] Tester mode offline
- [ ] Vérifier performance (Lighthouse)
- [ ] Configurer domaine et DNS
- [ ] Obtenir certificat SSL/TLS

---

## Points d'Entrée Clés

**Pour Développeurs:**
- `/js/app.js` - Logique principale
- `/index.html` - Structure HTML
- `/css/main.css` - Design system

**Pour DevOps:**
- `/.htaccess` (Apache) ou `/nginx.conf` (Nginx)
- `/manifest.json` - Configuration PWA
- `/sw.js` - Service Worker

**Pour QA/Testing:**
- `/views/auth/signin.html` - Auth testing
- `/views/offres.html` - Data loading
- `/sw.js` - Offline testing

---

## Ressources Externes

### Documentation
- [Supabase Docs](https://supabase.io/docs)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

### Tools
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Performance
- [Can I Use](https://caniuse.com/) - Browser compatibility
- [Let's Encrypt](https://letsencrypt.org/) - SSL/TLS gratuit

---

## Support

**Questions?**
- Lire README.md
- Consulter DEPLOYMENT.md
- Contacter: support@terrasocial.com

**Bugs?**
- Vérifier console du navigateur
- Vérifier Service Worker (DevTools → Application)
- Vérifier IndexedDB (DevTools → Storage)

---

## Version

- **Version:** 1.0.0
- **Créée:** 2026-02-05
- **État:** Production-Ready

---

**Disclaimer:** Ce programme n'est ni une banque, ni une microfinance, ni une coopérative d'épargne et de crédit.
