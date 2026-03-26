const express = require('express');
const { get, run, all } = require('../db/connection');
const { sanitizeText } = require('../utils/validation');

const router = express.Router();

// System prompts by context
const SYSTEM_PROMPTS = {
  base: `Tu es l'assistant commercial de TERRASOCIAL, une plateforme d'acces au foncier securise au Cameroun.
Tu es enthousiaste, convaincant mais honnete. Tu parles francais.
Tu connais parfaitement les offres:
- Lot Starter: 200m², a partir de 40 000 FCFA (paiement quotidien)
- Lot Standard: 200m², 1 300 000 FCFA (paiement mensuel sur 24 mois)
- Lot Confort: 400m², 6 375 000 FCFA (paiement mensuel sur 36 mois)
- Lot Premium: 500m², 10 000 000 FCFA (paiement mensuel sur 36 mois)

Avantages cles:
- Contrats encadres par un cabinet d'avocats (Me TAMAKUE Jean Noel)
- Assurance fonciere incluse (Assurance Masseu, 350 FCFA/jour/personne)
- Notaire certifie pour authentification
- Tableau de bord en temps reel
- Paiement echelonne accessible
- Frais d'adhesion: 10 000 FCFA

URL du site: https://social.manovende.com
Inscription client: https://social.manovende.com/register-client.html
Inscription proprietaire: https://social.manovende.com/register-owner.html
Devenir agent: https://social.manovende.com/devenir-agent.html
Confier un terrain: https://social.manovende.com/confier-terrain.html
WhatsApp: +237696875895`,

  visitor: `Le visiteur n'est PAS connecte. Ton objectif principal est de le CONVAINCRE de s'inscrire.
Sois commercial et persuasif. Mets en avant les prix accessibles et la securite.
NE PARLE PAS des interfaces utilisateur (dashboards). Parle uniquement de l'offre commerciale.
Guide vers l'inscription: https://social.manovende.com/register-client.html`,

  client: `L'utilisateur est un CLIENT connecte. Aide-le avec:
- Navigation dans son tableau de bord
- Comprendre son calendrier de paiement
- Souscrire a l'assurance fonciere
- Telecharger et signer ses contrats
- Envoyer des documents
- Comprendre le processus legal
NE PARLE PAS des interfaces assureur, legal ou admin.`,

  owner: `L'utilisateur est un PROPRIETAIRE connecte. Aide-le avec:
- Gestion de ses biens
- Suivi des paiements recus
- Documents juridiques
- Communication avec le cabinet d'avocats`,

  agent: `L'utilisateur est un AGENT IMMOBILIER connecte. Aide-le avec:
- Comprendre ses commissions (1-5% selon nombre de filleuls)
- Suivre ses prospects et filleuls
- Faire des retraits
- Generer son lien de parrainage
- Strategies de recrutement de clients`,

  insurer: `L'utilisateur est un ASSUREUR connecte. Aide-le avec:
- Gestion des souscripteurs
- Modeles de contrats
- Personnes assurees et cartes d'assure
- Analytics et statistiques
- Hopitaux partenaires`,

  legal: `L'utilisateur est du CABINET JURIDIQUE connecte. Aide-le avec:
- Revue des dossiers d'inscription
- Validation des contrats
- Messagerie avec clients et proprietaires
- Facturation (100 FCFA/jour/souscription)
- Gestion des collaborateurs`
};

// Rule-based responses for common questions (fallback if no AI API key)
const RULES = [
  { patterns: ['prix', 'combien', 'cout', 'tarif', 'cher'], response: 'Nos lots sont accessibles a tous les budgets:\n\n🏡 **Starter** (200m²): 40 000 FCFA\n🏠 **Standard** (200m²): 1 300 000 FCFA\n🏘️ **Confort** (400m²): 6 375 000 FCFA\n🏰 **Premium** (500m²): 10 000 000 FCFA\n\nFrais d\'adhesion: 10 000 FCFA\n\nVoulez-vous en savoir plus sur un type de lot?' },
  { patterns: ['inscription', 'inscrire', 'creer un compte', 'souscrire', 'commencer'], response: 'Pour vous inscrire, c\'est simple:\n\n1️⃣ Cliquez ici: [S\'inscrire](https://social.manovende.com/register-client.html)\n2️⃣ Remplissez vos informations\n3️⃣ Payez les frais d\'adhesion (10 000 FCFA)\n4️⃣ Choisissez votre lot\n\nVoulez-vous que je vous guide?' },
  { patterns: ['assurance', 'assure', 'police'], response: 'L\'assurance fonciere TERRASOCIAL vous protege:\n\n🛡️ Protection contre l\'eviction\n📄 Conformite cadastrale\n💰 350 FCFA/jour/personne assuree\n\nElle est geree par Assurance Masseu. Vous pouvez souscrire depuis votre tableau de bord.' },
  { patterns: ['avocat', 'juridique', 'legal', 'contrat'], response: 'Vos contrats sont encadres par Me TAMAKUE Jean Noel:\n\n⚖️ Verification juridique de chaque inscription\n📝 Modeles de contrats certifies\n🔒 Signature securisee\n💬 Messagerie directe avec le cabinet\n\nTout est accessible depuis votre espace client.' },
  { patterns: ['paiement', 'payer', 'versement', 'mensualite'], response: 'Plusieurs modes de paiement disponibles:\n\n📱 Orange Money\n📱 MTN MoMo\n💳 Carte bancaire\n🏦 Virement\n\nLes versements sont quotidiens (Starter) ou mensuels (Standard/Confort/Premium). Tout est visible dans votre calendrier de paiement.' },
  { patterns: ['agent', 'partenaire', 'commission', 'parrainage'], response: 'Devenez agent partenaire TERRASOCIAL:\n\n💰 Commissions de 1% a 5% sur chaque vente\n📈 Plus vous recrutez, plus votre taux augmente\n📲 Simple: juste un telephone\n🤝 Accompagnement complet\n\n👉 [Devenir agent](https://social.manovende.com/devenir-agent.html)' },
  { patterns: ['proprietaire', 'vendre', 'terrain a vendre', 'confier'], response: 'Vous souhaitez vendre votre terrain via TERRASOCIAL?\n\n✅ Inscription gratuite\n⚖️ Contrat encadre par un avocat\n📋 Authentification par notaire\n💰 Paiements echelonnes garantis\n\n👉 [Confier mon terrain](https://social.manovende.com/confier-terrain.html)' },
  { patterns: ['bonjour', 'salut', 'hello', 'bonsoir', 'hey'], response: 'Bonjour! 👋 Bienvenue sur TERRASOCIAL.\n\nJe suis votre assistant. Comment puis-je vous aider?\n\n🏡 Voir les lots disponibles\n💰 Connaitre les prix\n📝 S\'inscrire\n🤝 Devenir agent partenaire' },
  { patterns: ['merci', 'thanks'], response: 'Avec plaisir! 😊 N\'hesitez pas si vous avez d\'autres questions. Je suis la pour vous aider!' },
  { patterns: ['humain', 'conseiller', 'personne', 'appeler', 'telephoner'], response: 'Je vais transmettre votre demande a notre equipe.\n\n📲 WhatsApp: +237696875895\n📧 Email: support@manovende.com\n\nUn conseiller vous recontactera rapidement!' }
];

// Try AI response, fallback to rules
async function generateResponse(message, context, history) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Build role-specific system prompt
  let systemPrompt = SYSTEM_PROMPTS.base + '\n\n';
  if (!context.isLoggedIn) {
    systemPrompt += SYSTEM_PROMPTS.visitor;
  } else if (context.is_legal) {
    systemPrompt += SYSTEM_PROMPTS.legal;
  } else if (context.is_insurer) {
    systemPrompt += SYSTEM_PROMPTS.insurer;
  } else if (context.is_agent) {
    systemPrompt += SYSTEM_PROMPTS.agent;
  } else if (context.role === 'owner') {
    systemPrompt += SYSTEM_PROMPTS.owner;
  } else {
    systemPrompt += SYSTEM_PROMPTS.client;
  }

  if (context.userName) {
    systemPrompt += `\n\nLe nom de l'utilisateur est: ${context.userName}`;
  }
  systemPrompt += `\n\nPage actuelle: ${context.page || '/'}`;
  systemPrompt += `\n\nReponds de maniere concise (max 3-4 phrases). Utilise des emojis avec moderation. Si tu ne peux pas aider, propose de contacter support@manovende.com ou WhatsApp +237696875895.`;

  // Try Claude API
  if (apiKey) {
    try {
      const fetch = require('node-fetch');
      const messages = (history || []).slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));
      messages.push({ role: 'user', content: message });

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: systemPrompt,
          messages
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        return { text: data.content[0].text, source: 'ai' };
      }
    } catch (e) {
      console.error('[CHAT] AI error:', e.message);
    }
  }

  // Fallback to rule-based
  const lower = message.toLowerCase();
  for (const rule of RULES) {
    if (rule.patterns.some(p => lower.includes(p))) {
      return { text: rule.response, source: 'rules' };
    }
  }

  return {
    text: 'Je ne suis pas sur de comprendre votre question. Pouvez-vous reformuler?\n\nOu contactez notre equipe:\n📲 WhatsApp: +237696875895\n📧 support@manovende.com',
    source: 'fallback'
  };
}

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, context, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message requis' });
    }

    const safeMessage = sanitizeText(message, 2000);
    const safeContext = context || { page: '/', isLoggedIn: false, role: 'visitor' };

    // Check for escalation keywords
    const escalationKeywords = ['plainte', 'reclamation', 'probleme grave', 'rembours', 'arnaque', 'fraude', 'avocat perso'];
    const needsEscalation = escalationKeywords.some(k => safeMessage.toLowerCase().includes(k));

    const response = await generateResponse(safeMessage, safeContext, history);

    // Store conversation for analytics (fire and forget)
    run(
      `INSERT INTO chat_conversations(user_id, user_role, page, message, response, source, needs_escalation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [safeContext.userId || null, safeContext.role || 'visitor', safeContext.page || '/',
       safeMessage, response.text, response.source, needsEscalation ? 1 : 0]
    ).catch(() => {});

    // Send escalation email if needed
    if (needsEscalation) {
      try {
        const emailService = require('../services/email');
        if (emailService && emailService.sendEmail) {
          emailService.sendEmail({
            to: 'support@manovende.com',
            subject: `[TERRASOCIAL] Escalade chatbot - ${safeContext.userName || 'Visiteur'}`,
            text: `Un utilisateur a besoin d'assistance humaine.\n\nNom: ${safeContext.userName || 'Non connecte'}\nRole: ${safeContext.role}\nPage: ${safeContext.page}\n\nMessage: ${safeMessage}\n\nReponse bot: ${response.text}`
          }).catch(() => {});
        }
      } catch(e) {}

      response.text += '\n\n⚠️ Votre demande a ete transmise a notre equipe. Un conseiller vous contactera rapidement.';
    }

    return res.json({
      reply: response.text,
      source: response.source,
      escalated: needsEscalation
    });
  } catch (error) {
    console.error('[CHAT] Error:', error.message);
    return res.status(500).json({
      reply: 'Desole, une erreur est survenue. Contactez-nous sur WhatsApp: +237696875895',
      source: 'error'
    });
  }
});

// GET /api/chat/history (for logged-in users)
router.get('/history', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.json({ conversations: [] });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const conversations = await all(
      'SELECT message, response, page, created_at FROM chat_conversations WHERE user_id = ? ORDER BY id DESC LIMIT 50',
      [decoded.userId]
    );
    return res.json({ conversations });
  } catch(e) {
    return res.json({ conversations: [] });
  }
});

module.exports = router;
