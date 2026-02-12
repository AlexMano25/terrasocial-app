# TERRASOCIAL - Frontend PWA

Interface Progressive Web App pour la plateforme d'accès foncier participatif TERRASOCIAL.

## 🌱 À Propos

TERRASOCIAL est une plateforme numérique innovante qui facilite l'accès à la terre en connectant vendeurs, acheteurs et agents immobiliers à travers une plateforme sécurisée et transparente.

**Disclaimer Légal Important:** Ce programme n'est ni une banque, ni une microfinance, ni une coopérative d'épargne et de crédit.

## 📁 Structure du Projet

```
04_Frontend_PWA/
├── index.html              # Page principale (SPA)
├── manifest.json           # Configuration PWA
├── sw.js                   # Service Worker
├── css/
│   └── main.css           # Styles globaux (mobile-first)
├── js/
│   ├── app.js             # Application principale
│   ├── supabase-client.js # Client Supabase
│   ├── offline-manager.js # Gestion hors ligne
│   ├── router.js          # Router SPA
│   └── auth.js            # Authentification
├── views/
│   ├── public.html        # Accueil public
│   ├── offres.html        # Liste des offres
│   ├── client.html        # Espace client
│   ├── agent.html         # Espace agent
│   ├── admin.html         # Dashboard admin
│   ├── auth/
│   │   ├── signin.html    # Connexion
│   │   └── signup.html    # Inscription
│   └── [other views]
└── assets/                # Images et ressources

```

## 🚀 Fonctionnalités

### Publiques
- ✅ Présentation de TERRASOCIAL
- ✅ Affichage des offres disponibles
- ✅ Système de recherche et filtrage
- ✅ Authentification (inscription/connexion)
- ✅ FAQ et ressources

### Espace Client
- ✅ Gestion des souscriptions
- ✅ Historique des paiements
- ✅ Documents téléchargeables
- ✅ Suivi des transactions
- ✅ Support client

### Espace Agent
- ✅ Gestion des prospects
- ✅ Suivi des commissions
- ✅ Statistiques de performance
- ✅ Gestion des contacts

### Dashboard Admin
- ✅ Statistiques globales
- ✅ Gestion des utilisateurs
- ✅ Gestion des lots
- ✅ Suivi des transactions
- ✅ Génération de rapports

## 🛠️ Technologies

### Frontend
- **HTML5** - Structure sémantique
- **CSS3** - Styles modernes, responsive
- **JavaScript ES6+** - Logique applicative
- **PWA** - Fonctionnalité hors ligne

### Services Externes
- **Supabase** - Backend, authentification, base de données
- **Google Sheets API** - Intégration des données
- **Service Workers** - Synchronisation hors ligne

## 📱 Responsive Design

- **Mobile First** - Optimisé pour petits écrans
- **Breakpoints**
  - Mobile: < 480px
  - Tablet: 480px - 768px
  - Desktop: > 768px

## 🎨 Design System

### Couleurs
- **Primaire:** #2E7D32 (Vert)
- **Accent:** #FF9800 (Orange)
- **Texte:** #212121
- **Arrière-plan:** #FFFFFF

### Typographie
- **Font:** Poppins (Google Fonts)
- **Poids:** 300, 400, 600, 700

## ⚙️ Configuration

### Variables d'Environnement Requises
```javascript
// js/supabase-client.js
const supabase = new SupabaseClient(
  'https://YOUR_SUPABASE_URL.supabase.co',
  'YOUR_ANON_KEY'
);
```

### Service Worker
Le Service Worker gère:
- Cache stratégique (network-first pour API, cache-first pour assets)
- Synchronisation en arrière-plan
- Notifications push
- Offline mode

## 🔐 Sécurité

- ✅ Authentification Supabase Auth
- ✅ Tokens JWT sécurisés
- ✅ HTTPS requis
- ✅ Content Security Policy
- ✅ Protection CSRF

## 📦 Installation

### Prérequis
- Navigateur moderne supportant PWA
- Connexion Internet pour synchronisation
- Compte Supabase configuré

### Déploiement

1. **Copier les fichiers sur serveur web**
```bash
rsync -av --delete . /path/to/web/root/
```

2. **Configurer HTTPS**
- Certificat SSL/TLS obligatoire

3. **Configurer Supabase**
- URL et clé API dans `js/supabase-client.js`

4. **Service Worker**
- Déjà intégré, enregistrement automatique

## 🔄 Fonctionnement Hors Ligne

### IndexedDB Storage
- `lots` - Listing des terrains
- `subscriptions` - Souscriptions client
- `payments` - Historique paiements
- `prospects` - Prospects agents
- `syncQueue` - Files d'attente de sync
- `cache` - Cache générique

### Background Sync
Synchronisation automatique des données:
- Lors du retour en ligne
- Retry automatique avec backoff
- Notification utilisateur

## 📊 Modules JavaScript

### app.js
- Orchestration principale
- Gestion des routes
- Initialisation des composants
- Gestion formulaires

### supabase-client.js
- Client Supabase personnalisé
- Méthodes CRUD génériques
- Authentification
- Gestion tokens

### offline-manager.js
- IndexedDB abstraction
- Sync queue management
- Cache management
- Event listeners

### router.js
- Simple SPA router
- Hash-based routing
- Middlewares support
- Dynamic routes

### auth.js
- Gestion authentification
- État utilisateur
- Gestion rôles
- UI synchronisation

## 🧪 Tests

### Tests Manuels Recommandés
1. Authentification (signin/signup)
2. Navigation complète
3. Offline mode (déconnecter le réseau)
4. Sync queue (re-connexion)
5. Responsive (tous appareils)

## 📝 Disclaimer Légal

> Ce programme n'est ni une banque, ni une microfinance, ni une coopérative d'épargne et de crédit.

Ce disclaimer apparaît:
- En pied de page de chaque page
- Sur page d'accueil
- Lors de l'inscription
- Sur page "Disclaimer Légal"

## 🚀 Optimisations

### Performance
- Lazy loading des images
- Code splitting par vue
- Minification CSS/JS
- Compression des assets
- Cache stratégique

### Accessibilité
- WCAG 2.1 Level AA
- Labels explicites
- Navigation au clavier
- Contraste suffisant
- ARIA attributes

## 📱 Chevrons de PWA

- ✅ Manifest.json
- ✅ Service Worker
- ✅ HTTPS
- ✅ Responsive design
- ✅ Icônes 192x512
- ✅ Theme color
- ✅ Standalone mode

## 🐛 Dépannage

### Service Worker non enregistré
```javascript
// Vérifier console du navigateur
navigator.serviceWorker.getRegistrations()
```

### Cache périmé
```javascript
// Nettoyer cache dans DevTools > Application > Cache Storage
```

### Authentification échouée
- Vérifier URL et clés Supabase
- Vérifier CORS settings
- Vérifier tokens expirés

## 📚 Documentation

- [Supabase Docs](https://supabase.io/docs)
- [MDN PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## 📧 Support

Pour toute question ou problème:
- Email: support@terrasocial.com
- Téléphone: +221 77 XXX XXXX
- Chat: support@terrasocial.com

## 📄 Licence

Propriétaire - TERRASOCIAL

## 👥 Contributeurs

Équipe TERRASOCIAL

---

**Mise à jour:** Février 2026
**Version:** 1.0.0
