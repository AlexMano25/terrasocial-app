/**
 * TERRASOCIAL - Système d'Aide Contextuelle
 * Manuels d'utilisation par interface
 */
const HelpSystem = {
  isOpen: false,

  // Contenu d'aide par rôle/vue (FR avec clés i18n)
  helpContent: {
    // ==================== VISITEUR PUBLIC ====================
    public: {
      title: "Guide du Visiteur",
      sections: [
        {
          title: "Découvrir nos terrains",
          icon: "🏠",
          content: `
            <h4>Comment explorer les offres ?</h4>
            <ol>
              <li>Parcourez la liste des terrains disponibles sur la page d'accueil</li>
              <li>Cliquez sur "Voir Détails" pour plus d'informations</li>
              <li>Consultez les photos, la localisation et les prix</li>
              <li>Utilisez les filtres pour affiner votre recherche</li>
            </ol>
            <p><strong>Astuce :</strong> Les lots en angle ou bord de route ont généralement plus de valeur.</p>
          `
        },
        {
          title: "Comprendre les paiements",
          icon: "💰",
          content: `
            <h4>Comment fonctionne le paiement échelonné ?</h4>
            <ul>
              <li><strong>Acompte :</strong> 10% du prix total à la souscription</li>
              <li><strong>Paiement journalier :</strong> 1 500 FCFA/jour minimum</li>
              <li><strong>Durée :</strong> 24 à 36 mois selon le terrain</li>
              <li><strong>Méthodes :</strong> Orange Money, MTN MoMo, Virement</li>
            </ul>
            <div class="help-warning">
              ⚠️ Ce programme n'est PAS une banque. C'est une vente immobilière avec crédit-vendeur.
            </div>
          `
        },
        {
          title: "Contacter un agent",
          icon: "📞",
          content: `
            <h4>Besoin d'accompagnement ?</h4>
            <p>Nos agents sont disponibles pour :</p>
            <ul>
              <li>Organiser une visite de terrain</li>
              <li>Répondre à vos questions</li>
              <li>Vous accompagner dans la souscription</li>
            </ul>
            <p>Appelez le <strong>+237 6XX XX XX XX</strong> ou utilisez le formulaire de contact.</p>
          `
        }
      ]
    },

    // ==================== ESPACE CLIENT ====================
    client: {
      title: "Guide du Client",
      sections: [
        {
          title: "Consulter mes souscriptions",
          icon: "📋",
          content: `
            <h4>Où trouver mes informations ?</h4>
            <ol>
              <li>Connectez-vous à votre espace client</li>
              <li>Accédez à "Mes Souscriptions" dans le menu</li>
              <li>Cliquez sur une souscription pour voir les détails</li>
            </ol>
            <p>Vous verrez : le terrain, le lot, le montant total, la progression des paiements.</p>
          `
        },
        {
          title: "Effectuer un paiement",
          icon: "💳",
          content: `
            <h4>Comment payer ?</h4>
            <ol>
              <li>Allez dans "Mes Paiements" > "Nouveau Paiement"</li>
              <li>Sélectionnez la souscription concernée</li>
              <li>Choisissez le montant (minimum 1 500 FCFA)</li>
              <li>Sélectionnez la méthode de paiement</li>
              <li>Effectuez le paiement via Orange Money / MTN MoMo</li>
              <li>Téléversez la preuve de paiement (capture d'écran)</li>
            </ol>
            <div class="help-info">
              💡 Gardez toujours vos preuves de paiement !
            </div>
          `
        },
        {
          title: "Jouissance anticipée",
          icon: "🏡",
          content: `
            <h4>Qu'est-ce que la jouissance anticipée ?</h4>
            <p>Après 12 mois de paiements réguliers, vous pouvez demander l'accès anticipé à votre terrain :</p>
            <ul>
              <li>Droit de clôturer le terrain</li>
              <li>Droit de commencer les travaux</li>
              <li>PV de jouissance délivré</li>
            </ul>
            <p><strong>Conditions :</strong> Paiements à jour sans interruption de plus de 2 mois.</p>
          `
        },
        {
          title: "Signaler un problème",
          icon: "🎫",
          content: `
            <h4>Comment créer un ticket ?</h4>
            <ol>
              <li>Allez dans "Support" > "Nouveau Ticket"</li>
              <li>Sélectionnez la catégorie (Paiement, Terrain, Autre)</li>
              <li>Décrivez votre problème en détail</li>
              <li>Joignez des photos si nécessaire</li>
              <li>Soumettez et attendez la réponse (24-48h)</li>
            </ol>
          `
        }
      ]
    },

    // ==================== ESPACE AGENT ====================
    agent: {
      title: "Guide de l'Agent",
      sections: [
        {
          title: "Gérer mes prospects",
          icon: "👥",
          content: `
            <h4>Comment ajouter un prospect ?</h4>
            <ol>
              <li>Allez dans "Mes Prospects" > "Ajouter"</li>
              <li>Renseignez : Nom, Téléphone, Email (optionnel)</li>
              <li>Indiquez la source (Visite, Flyer, Recommandation)</li>
              <li>Sélectionnez le terrain d'intérêt</li>
              <li>Ajoutez des notes si nécessaire</li>
            </ol>
            <div class="help-info">
              💡 Suivez régulièrement vos prospects pour améliorer votre taux de conversion !
            </div>
          `
        },
        {
          title: "Créer une souscription",
          icon: "✍️",
          content: `
            <h4>Processus de souscription</h4>
            <ol>
              <li>Convertissez un prospect en client</li>
              <li>Sélectionnez le lot souhaité</li>
              <li>Choisissez la durée de paiement (24-36 mois)</li>
              <li>Le système calcule automatiquement l'échéancier</li>
              <li>Faites signer le contrat au client</li>
              <li>Collectez l'acompte (10%)</li>
            </ol>
            <p>Votre code agent sera automatiquement associé pour le calcul des commissions.</p>
          `
        },
        {
          title: "Commissions",
          icon: "💰",
          content: `
            <h4>Comment sont calculées les commissions ?</h4>
            <ul>
              <li><strong>Souscription :</strong> 5% sur l'acompte</li>
              <li><strong>Paiements :</strong> 5% sur chaque paiement mensuel</li>
              <li><strong>Flyers :</strong> 5 FCFA par flyer validé (OTP)</li>
            </ul>
            <p><strong>Paiement :</strong> Les commissions sont payées chaque fin de mois après validation.</p>
          `
        },
        {
          title: "Campagnes Flyers",
          icon: "📄",
          content: `
            <h4>Comment fonctionne la distribution ?</h4>
            <ol>
              <li>Inscrivez-vous à une campagne active</li>
              <li>Distribuez les flyers avec votre code QR</li>
              <li>Le destinataire scanne et entre son numéro</li>
              <li>Un code OTP est envoyé par SMS</li>
              <li>La validation confirme la distribution</li>
            </ol>
            <div class="help-warning">
              ⚠️ Les fraudes (faux numéros, auto-validation) sont détectées et sanctionnées.
            </div>
          `
        }
      ]
    },

    // ==================== ESPACE ADMIN ====================
    admin: {
      title: "Guide Administrateur",
      sections: [
        {
          title: "Gestion des terrains",
          icon: "🗺️",
          content: `
            <h4>Ajouter un terrain</h4>
            <ol>
              <li>Allez dans "Terrains" > "Nouveau"</li>
              <li>Renseignez : Nom, Code (ex: ESS), Localisation</li>
              <li>Ajoutez les coordonnées GPS</li>
              <li>Téléversez les documents (titre foncier, plan cadastral)</li>
              <li>Définissez le prix de base au m²</li>
              <li>Créez les lots individuels</li>
            </ol>
          `
        },
        {
          title: "Validation des paiements",
          icon: "✅",
          content: `
            <h4>Processus de validation</h4>
            <ol>
              <li>Accédez à "Paiements" > "En attente"</li>
              <li>Vérifiez la preuve de paiement téléversée</li>
              <li>Confirmez le montant et la référence</li>
              <li>Validez ou Rejetez avec un motif</li>
            </ol>
            <div class="help-warning">
              ⚠️ Un paiement validé déclenche automatiquement le calcul de commission.
            </div>
          `
        },
        {
          title: "Rapports et statistiques",
          icon: "📊",
          content: `
            <h4>Rapports disponibles</h4>
            <ul>
              <li><strong>Dashboard :</strong> Vue d'ensemble en temps réel</li>
              <li><strong>Ventes :</strong> Souscriptions par période/terrain</li>
              <li><strong>Paiements :</strong> Encaissements et impayés</li>
              <li><strong>Agents :</strong> Performance et commissions</li>
              <li><strong>Clients :</strong> Progression des paiements</li>
            </ul>
            <p>Tous les rapports peuvent être exportés en Excel.</p>
          `
        },
        {
          title: "Gestion des utilisateurs",
          icon: "👤",
          content: `
            <h4>Rôles disponibles</h4>
            <ul>
              <li><strong>Super Admin :</strong> Accès total</li>
              <li><strong>Admin :</strong> Gestion quotidienne</li>
              <li><strong>Staff :</strong> Validation paiements</li>
              <li><strong>Agent :</strong> Prospection et vente</li>
              <li><strong>Avocat :</strong> Validation contrats</li>
              <li><strong>Notaire :</strong> Dossiers notariaux</li>
              <li><strong>Client :</strong> Accès limité à son dossier</li>
            </ul>
          `
        }
      ]
    }
  },

  // Ouvrir le modal d'aide
  open(role = 'public') {
    const content = this.helpContent[role] || this.helpContent.public;
    
    const modal = document.createElement('div');
    modal.className = 'help-modal-overlay';
    modal.id = 'helpModal';
    modal.innerHTML = `
      <div class="help-modal">
        <div class="help-header">
          <h2>❓ ${content.title}</h2>
          <button class="help-close" onclick="HelpSystem.close()">&times;</button>
        </div>
        <div class="help-search">
          <input type="text" placeholder="🔍 Rechercher dans l'aide..." oninput="HelpSystem.search(this.value)">
        </div>
        <div class="help-body">
          <div class="help-sidebar">
            ${content.sections.map((s, i) => `
              <button class="help-nav-item ${i === 0 ? 'active' : ''}" onclick="HelpSystem.showSection(${i})">
                <span class="help-nav-icon">${s.icon}</span>
                <span>${s.title}</span>
              </button>
            `).join('')}
          </div>
          <div class="help-content" id="helpContent">
            ${content.sections[0].content}
          </div>
        </div>
        <div class="help-footer">
          <a href="mailto:support@terrasocial.cm">📧 Contacter le support</a>
          <span>|</span>
          <a href="tel:+237600000000">📞 +237 6XX XX XX XX</a>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.isOpen = true;
    this.currentRole = role;
    this.currentSections = content.sections;
  },

  // Fermer le modal
  close() {
    const modal = document.getElementById('helpModal');
    if (modal) modal.remove();
    this.isOpen = false;
  },

  // Afficher une section
  showSection(index) {
    const content = document.getElementById('helpContent');
    if (content && this.currentSections[index]) {
      content.innerHTML = this.currentSections[index].content;
      
      // Update nav active state
      document.querySelectorAll('.help-nav-item').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
      });
    }
  },

  // Recherche dans l'aide
  search(query) {
    if (!query) {
      this.showSection(0);
      return;
    }
    
    query = query.toLowerCase();
    const results = [];
    
    this.currentSections.forEach((section, index) => {
      if (section.title.toLowerCase().includes(query) || 
          section.content.toLowerCase().includes(query)) {
        results.push({ index, section });
      }
    });
    
    const content = document.getElementById('helpContent');
    if (results.length > 0) {
      content.innerHTML = results.map(r => `
        <div class="help-search-result" onclick="HelpSystem.showSection(${r.index})">
          <h4>${r.section.icon} ${r.section.title}</h4>
        </div>
      `).join('');
    } else {
      content.innerHTML = '<p class="help-no-results">Aucun résultat trouvé.</p>';
    }
  },

  // Ajouter le bouton d'aide flottant
  addHelpButton(role = 'public') {
    if (document.getElementById('helpFloatingBtn')) return;
    
    const btn = document.createElement('button');
    btn.id = 'helpFloatingBtn';
    btn.className = 'help-floating-btn';
    btn.innerHTML = '❓';
    btn.title = 'Aide';
    btn.onclick = () => this.open(role);
    
    document.body.appendChild(btn);
  },

  // Injecter les styles CSS
  injectStyles() {
    if (document.getElementById('helpSystemStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'helpSystemStyles';
    style.textContent = `
      .help-floating-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #2E7D32, #4CAF50);
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 9998;
        transition: transform 0.2s;
      }
      .help-floating-btn:hover {
        transform: scale(1.1);
      }
      .help-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }
      .help-modal {
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 900px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      }
      .help-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        background: linear-gradient(135deg, #2E7D32, #4CAF50);
        color: white;
      }
      .help-header h2 { margin: 0; font-size: 1.3rem; }
      .help-close {
        background: none;
        border: none;
        color: white;
        font-size: 28px;
        cursor: pointer;
      }
      .help-search {
        padding: 12px 24px;
        border-bottom: 1px solid #eee;
      }
      .help-search input {
        width: 100%;
        padding: 10px 16px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
      }
      .help-body {
        display: flex;
        flex: 1;
        overflow: hidden;
      }
      .help-sidebar {
        width: 220px;
        border-right: 1px solid #eee;
        overflow-y: auto;
        padding: 8px;
      }
      .help-nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px;
        border: none;
        background: none;
        text-align: left;
        cursor: pointer;
        border-radius: 8px;
        font-size: 14px;
      }
      .help-nav-item:hover { background: #f5f5f5; }
      .help-nav-item.active { background: #E8F5E9; color: #2E7D32; font-weight: 600; }
      .help-nav-icon { font-size: 18px; }
      .help-content {
        flex: 1;
        padding: 24px;
        overflow-y: auto;
        line-height: 1.6;
      }
      .help-content h4 { color: #2E7D32; margin-top: 0; }
      .help-content ol, .help-content ul { padding-left: 20px; }
      .help-content li { margin: 8px 0; }
      .help-warning {
        background: #FFF3E0;
        border-left: 4px solid #FF9800;
        padding: 12px;
        margin: 16px 0;
        border-radius: 0 8px 8px 0;
      }
      .help-info {
        background: #E3F2FD;
        border-left: 4px solid #2196F3;
        padding: 12px;
        margin: 16px 0;
        border-radius: 0 8px 8px 0;
      }
      .help-footer {
        padding: 12px 24px;
        background: #f5f5f5;
        text-align: center;
        font-size: 14px;
      }
      .help-footer a { color: #2E7D32; text-decoration: none; margin: 0 8px; }
      .help-search-result {
        padding: 12px;
        border: 1px solid #eee;
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
      }
      .help-search-result:hover { background: #f5f5f5; }
      .help-no-results { text-align: center; color: #999; padding: 40px; }
      @media (max-width: 768px) {
        .help-modal { width: 95%; max-height: 90vh; }
        .help-body { flex-direction: column; }
        .help-sidebar { width: 100%; border-right: none; border-bottom: 1px solid #eee; display: flex; overflow-x: auto; padding: 8px; }
        .help-nav-item { white-space: nowrap; }
      }
    `;
    document.head.appendChild(style);
  }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
  HelpSystem.injectStyles();
});
