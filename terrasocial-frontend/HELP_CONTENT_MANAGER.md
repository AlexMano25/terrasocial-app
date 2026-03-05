# Guide du Gestionnaire de Contenu d'Aide - TERRASOCIAL

## Pour les Responsables du Contenu d'Aide

Ce guide est destiné aux personnes chargées de maintenir, mettre à jour et améliorer le contenu d'aide du système TERRASOCIAL.

## Accès au Contenu

Tous les contenus d'aide sont stockés dans un seul fichier:

**Fichier:** `/js/help-system.js`

**Méthode:** `_initializeHelpContent()` (à partir de la ligne ~58)

## Structure Générale

```javascript
_initializeHelpContent() {
    return {
        public: { ... },      // Aide pour visiteurs
        client: { ... },      // Aide pour clients
        agent: { ... },       // Aide pour agents
        admin: { ... }        // Aide pour administrateurs
    };
}
```

## Ajouter une Nouvelle Section d'Aide

### Modèle Complet

```javascript
{
    id: 'unique-identifier',                    // ID unique pour la section
    title: 'Titre de la Section',              // Affiché comme titre
    icon: 'icon-name',                         // Icône (descriptive)
    content: 'Texte introductif...',          // Description courte
    steps: [
        'Étape 1 avec détails',
        'Étape 2 avec détails',
        'Étape 3 avec détails'
    ],
    tips: [                                     // Optionnel
        'Conseil pratique 1',
        'Conseil pratique 2'
    ],
    videoUrl: 'https://example.com/video.mp4', // Optionnel
    relatedTopics: ['id-autre-section']        // Optionnel
}
```

### Exemple Pratique

Ajouter une nouvelle section "Dépôt de garantie" pour les clients:

```javascript
{
    id: 'security-deposit',
    title: 'Comprendre la Garantie de Dépôt',
    icon: 'lock',
    content: 'Explication du dépôt de garantie et comment il fonctionne.',
    steps: [
        'Le dépôt de garantie est une somme versée lors de la signature',
        'Il représente généralement 10-15% du prix total',
        'Il est bloqué pendant toute la durée du contrat',
        'Il est remboursé après paiement complet et inspection',
        'Il ne peut être utilisé que pour couvrir les dommages'
    ],
    tips: [
        'Le dépôt n\'est pas une réduction sur le prix',
        'Assurez-vous de recevoir un reçu du dépôt',
        'Gardez le reçu original pour prouver le paiement'
    ],
    videoUrl: 'https://example.com/videos/security-deposit.mp4'
}
```

## Modifier une Section Existante

### Trouver la Section

1. Ouvrir `/js/help-system.js`
2. Utiliser Ctrl+F pour chercher l'ID de la section
3. Localiser la section dans le rôle approprié

### Modifier les Propriétés

```javascript
// AVANT
{
    id: 'old-content',
    title: 'Ancien Titre',
    // ...
}

// APRÈS
{
    id: 'old-content',
    title: 'Nouveau Titre Amélioré',
    // ... autres modifications
}
```

### Exemples de Modifications Courantes

**Mettre à jour une étape:**
```javascript
// AVANT
steps: [
    'Ancienne étape 1',
    'Ancienne étape 2'
]

// APRÈS
steps: [
    'Nouvelle étape 1 révisée',
    'Nouvelle étape 2 améliorée'
]
```

**Ajouter un conseil:**
```javascript
tips: [
    'Conseil existant',
    'Nouveau conseil à ajouter'  // ← Ajouter ici
]
```

**Mettre à jour un lien vidéo:**
```javascript
// AVANT
videoUrl: 'https://old-link.com/video.mp4'

// APRÈS
videoUrl: 'https://new-link.com/video.mp4'
```

## Ajouter des Questions FAQ

### Structure d'une Question FAQ

```javascript
faq: [
    {
        question: 'Votre question ici?',
        answer: 'Réponse détaillée et complète...'
    }
]
```

### Exemple - Ajouter une Question FAQ pour les Clients

```javascript
{
    question: 'Puis-je augmenter mes versements mensuels?',
    answer: 'Oui, vous pouvez augmenter vos versements mensuels à tout moment. Contactez votre agent ou l\'équipe support pour modifier votre plan de paiement. Une augmentation peut réduire la durée totale de votre contrat et vous rapprocher de la jouissance plus rapidement.'
}
```

## Directives de Rédaction

### Règles de Base

1. **Clarté** - Écrire simplement, éviter le jargon
2. **Concision** - Aller droit au but, pas de remplissage
3. **Action** - Utiliser l'impératif quand approprié
4. **Pertinence** - Information utile et actuelle
5. **Correction** - Vérifier l'orthographe et la grammaire

### Style Recommandé

**Pour les Titres:**
- Court et descriptif
- Commence par un verbe ou un sujet
- Exemples:
  - ✅ "Effectuer vos Paiements"
  - ✅ "Comprendre la Jouissance"
  - ❌ "Informations supplémentaires"
  - ❌ "Divers"

**Pour les Étapes:**
- Action claire et précise
- Numérotation automatique
- Exemples:
  - ✅ "Cliquez sur 'Mes Paiements' dans le tableau de bord"
  - ✅ "Sélectionnez la propriété concernée"
  - ❌ "Naviguez autour du système"
  - ❌ "Faites ce qui vous semble approprié"

**Pour les Conseils:**
- Format: "[icône] Conseil pratique"
- Court mais informatif
- Exemples:
  - ✅ "Les paiements avant le 10 du mois ne sont facturés qu'à partir du mois suivant"
  - ✅ "Gardez vos reçus pour votre dossier"
  - ❌ "Vous devriez peut-être penser à..."
  - ❌ "C'est généralement recommandé de..."

**Pour les FAQ:**
- Question: Phrasée comme une vraie question
- Réponse: Réponse complète et autonome
- Exemples:
  - ✅ Q: "Quand reçois-je ma jouissance?" A: "Généralement après..."
  - ❌ Q: "Jouissance" A: "Accès à la propriété"

## Vérification avant Publication

Checklist avant de sauvegarder votre contenu:

### Format
- [ ] L'ID est unique (pas de doublons)
- [ ] La structure JSON est valide (pas d'erreurs de syntaxe)
- [ ] Les crochets et accolades sont appairés
- [ ] Les guillemets sont corrects

### Contenu
- [ ] Le titre est descriptif
- [ ] Le contenu introductif explique l'objectif
- [ ] Les étapes sont numérotées et ordonnées logiquement
- [ ] Les conseils sont pratiques et utiles
- [ ] Pas de fautes d'orthographe

### Structure
- [ ] Les sauts de ligne sont appropriés
- [ ] L'indentation est cohérente
- [ ] Les listes sont bien formatées
- [ ] Les sections sont complètes

## Validation Rapide

Après une modification, vérifiez dans la console du navigateur:

```javascript
// 1. Vérifier que le système fonctionne
window.helpSystem
// Résultat: HelpSystem { ... }

// 2. Vérifier votre contenu
window.helpSystem.helpContent.client.sections
// Doit afficher votre nouveau contenu

// 3. Ouvrir la modal d'aide
window.helpSystem.showHelpModal()
// Doit afficher votre nouveau contenu
```

## Gérer les Rôles et Contextes

### Les 4 Rôles d'Aide

| Rôle | Contexte | Routes | Public |
|------|----------|--------|--------|
| PUBLIC | Visiteurs | /, #/offres | ✅ Accessible |
| CLIENT | Clients authentifiés | #/client | ✅ Personnalisé |
| AGENT | Agents commerciaux | #/agent | ✅ Personnalisé |
| ADMIN | Administrateurs | #/admin | ✅ Personnalisé |

### Choisir le Bon Rôle

**Utiliser PUBLIC si:** L'aide concerne les visiteurs non authentifiés
**Utiliser CLIENT si:** L'aide concerne les clients/acquéreurs
**Utiliser AGENT si:** L'aide concerne les vendeurs/agents
**Utiliser ADMIN si:** L'aide concerne la gestion du système

## Exemples de Contenu Complet

### Exemple 1: Section Simple

```javascript
{
    id: 'how-to-reset-password',
    title: 'Réinitialiser votre Mot de Passe',
    icon: 'key',
    content: 'Procédure pour changer votre mot de passe si vous l\'avez oublié.',
    steps: [
        'Cliquez sur "Mot de passe oublié" sur la page de connexion',
        'Entrez votre adresse email enregistrée',
        'Consultez votre email pour le lien de réinitialisation',
        'Cliquez sur le lien dans l\'email',
        'Entrez votre nouveau mot de passe deux fois',
        'Cliquez sur "Mettre à jour le mot de passe"',
        'Connectez-vous avec votre nouveau mot de passe'
    ],
    tips: [
        'Les liens de réinitialisation expirent après 24 heures',
        'Utilisez un mot de passe fort: 8+ caractères, majuscules, chiffres',
        'Ne partagez jamais votre mot de passe avec quiconque'
    ]
}
```

### Exemple 2: Section avec Vidéo et Sujets Connexes

```javascript
{
    id: 'understand-payment-terms',
    title: 'Comprendre les Termes de Paiement',
    icon: 'file-text',
    content: 'Explication détaillée des différents termes et conditions de paiement.',
    steps: [
        'Consultez votre contrat qui énumère tous les termes',
        'Identifiez votre plan: standard, accéléré ou flexible',
        'Vérifiez le montant du versement mensuel',
        'Notez les dates d\'échéance de paiement',
        'Comprenez les pénalités pour retard de paiement',
        'Identifiez le seuil de jouissance (% à payer)',
        'Vérifiez les conditions d\'annulation si applicable'
    ],
    tips: [
        'Tous les frais doivent être clairement énumérés',
        'Les plans flexibles offrent plus d\'options',
        'Vous pouvez augmenter les versements pour accélérer'
    ],
    videoUrl: 'https://example.com/videos/payment-terms.mp4',
    relatedTopics: ['make-payments', 'jouissance-eligibility']
}
```

## Maintenance Régulière

### Vérification Mensuelle

- [ ] Lire les retours d\'utilisateurs
- [ ] Identifier les questions fréquentes non documentées
- [ ] Vérifier les liens vidéo (toujours valides?)
- [ ] Mettre à jour les horaires/coordonnées si changés
- [ ] Correction de fautes/imprécisions détectées

### Ajouter du Nouveau Contenu

1. **Identifier** - Trouver les questions fréquentes
2. **Rédiger** - Créer la section ou FAQ
3. **Tester** - Vérifier dans le navigateur
4. **Publier** - Sauvegarder et mettre en ligne

### Archiver du Contenu Obsolète

Pour retirer une section obsolète:

```javascript
// Ne pas supprimer directement
// À la place, la marquer comme archivée ou transférer son contenu

// Option 1: Supprimer simplement de la liste
// La section disparaîtra

// Option 2: Garder mais masquer
visible: false  // À implémenter si nécessaire
```

## Problèmes Courants et Solutions

### La Section n'Apparaît pas
**Vérifier:**
1. L'ID est-il unique?
2. Y a-t-il une erreur de syntaxe JSON?
3. La section est-elle au bon endroit (bon rôle)?

**Solution:**
```javascript
// Vérifier la validité JSON
window.helpSystem.helpContent[yourRole]
```

### Les Changements ne s'Appliquent pas
**Cause:** Le navigateur cache le fichier
**Solution:**
1. Forcer l'actualisation: Ctrl+Shift+R
2. Vider le cache navigateur
3. Attendre quelques minutes si le serveur cache

### Caractères Spéciaux Cassés
**Cause:** Guillemets ou caractères spéciaux mal échappés
**Solution:**
```javascript
// BON
"Il s\'agit d\'une apostrophe"
"Les \"guillemets\" doivent être échappés"

// MAUVAIS
"Il s'agit d'une apostrophe"  ← Casse le JSON
"Les "guillemets" sont invalides"
```

## Raccourcis Clavier pour Éditeurs

Si vous utilisez VS Code:

- Ctrl+H - Chercher et remplacer
- Ctrl+F - Chercher
- Ctrl+/ - Commenter/décommenter
- Alt+Shift+Up/Down - Déplacer la ligne
- Ctrl+Shift+K - Supprimer la ligne

## Ressources et Références

- **Fichier principal:** `/js/help-system.js`
- **Documentation technique:** `HELP_SYSTEM.md`
- **Guide d'intégration:** `HELP_INTEGRATION_GUIDE.md`
- **Validation JSON:** https://jsonlint.com/

## Checklist de Rédaction d'une Nouvelle Section

### Avant de Commencer
- [ ] Identifier le besoin (questions d'utilisateurs?)
- [ ] Choisir le bon rôle (public/client/agent/admin)
- [ ] Rassembler les informations exactes

### Pendant la Rédaction
- [ ] ID unique et descriptif
- [ ] Titre clair et concis
- [ ] Icône appropriée
- [ ] Contenu introductif (1-2 phrases)
- [ ] 3-7 étapes logiques et ordonnées
- [ ] 2-3 conseils pratiques
- [ ] Lien vidéo si disponible
- [ ] Sujets connexes si pertinent

### Après la Rédaction
- [ ] Vérifier la syntaxe JSON
- [ ] Relire pour les fautes/imprécisions
- [ ] Tester dans la modal d'aide
- [ ] Vérifier la recherche trouve le contenu
- [ ] Sauvegarder et committer le changement

## Support et Questions

Pour des questions sur la gestion du contenu:
1. Consulter la section "Problèmes Courants" ci-dessus
2. Vérifier la documentation technique dans `HELP_SYSTEM.md`
3. Utiliser la console du navigateur pour déboguer
4. Contacter l'équipe technique si nécessaire

---

**Dernière mise à jour:** 5 février 2026
**Version:** 1.0
**Responsable:** Mano Verde SA
