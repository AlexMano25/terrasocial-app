/**
 * TERRASOCIAL - Application Principale
 * Gère le routage et l'initialisation de l'application
 */

class TermaSocialApp {
    constructor() {
        this.isInitialized = false;
    }

    async init() {
        try {
            console.log('🌱 Initialisation de TERRASOCIAL...');

            // Attendre que l'auth soit initialisé
            await new Promise(resolve => setTimeout(resolve, 500));

            this._setupRoutes();
            this._setupMiddlewares();
            this._setupHooks();
            this._setupGlobalListeners();
            this._setupNavigation();

            this.isInitialized = true;
            console.log('✅ TERRASOCIAL initialisé');
        } catch (error) {
            console.error('Erreur d\'initialisation:', error);
        }
    }

    /**
     * CONFIGURATION DES ROUTES
     */
    _setupRoutes() {
        // Routes publiques
        router.register('/', () => this._loadView('views/public.html'), {
            title: 'Accueil'
        });

        router.register('/offres', () => this._loadView('views/offres.html'), {
            title: 'Offres'
        });

        router.register('/signin', () => this._loadView('views/auth/signin.html'), {
            title: 'Connexion'
        });

        router.register('/signup', () => this._loadView('views/auth/signup.html'), {
            title: 'Inscription'
        });

        // Routes protégées
        router.register('/client', () => this._loadView('views/client.html'), {
            title: 'Espace Client',
            requireAuth: true
        });

        router.register('/agent', () => this._loadView('views/agent.html'), {
            title: 'Espace Agent',
            requireAuth: true
        });

        router.register('/admin', () => this._loadView('views/admin.html'), {
            title: 'Dashboard Admin',
            requireAuth: true
        });

        router.register('/profile', () => this._loadView('views/profile.html'), {
            title: 'Mon Profil',
            requireAuth: true
        });

        router.register('/parametres', () => this._loadView('views/settings.html'), {
            title: 'Paramètres',
            requireAuth: true
        });

        // Routes légales
        router.register('/legal/disclaimer', () => this._renderDisclaimer(), {
            title: 'Disclaimer'
        });

        router.register('/legal/cgv', () => this._renderCGV(), {
            title: 'Conditions Générales'
        });

        router.register('/legal/privacy', () => this._renderPrivacy(), {
            title: 'Politique de Confidentialité'
        });

        router.register('/about', () => this._renderAbout(), {
            title: 'À Propos'
        });

        router.register('/contact', () => this._renderContact(), {
            title: 'Contact'
        });

        router.register('/faq', () => this._renderFAQ(), {
            title: 'FAQ'
        });
    }

    /**
     * MIDDLEWARES
     */
    _setupMiddlewares() {
        router.use(async (path, route) => {
            // Middleware d'authentification
            if (route.requireAuth && !auth.isAuthenticated) {
                router.navigate('/signin');
                throw new Error('Authentification requise');
            }

            // Middleware de rôle pour admin
            if (path === '/admin' && !auth.isAdmin()) {
                router.navigate('/');
                throw new Error('Accès réservé aux administrateurs');
            }

            // Middleware de rôle pour agent
            if (path === '/agent' && !auth.isAgent() && !auth.isAdmin()) {
                router.navigate('/');
                throw new Error('Accès réservé aux agents');
            }
        });
    }

    /**
     * HOOKS
     */
    _setupHooks() {
        router.before(async (path) => {
            showLoading(true);
        });

        router.after(async (path) => {
            showLoading(false);
            // Re-initialiser les event listeners des vues
            this._initializeViewEventListeners();
        });
    }

    /**
     * EVENT LISTENERS GLOBAUX
     */
    _setupGlobalListeners() {
        // Écouter les changements d'authentification
        auth.subscribe(event => {
            if (event.type === 'signin-success' || event.type === 'signup-success') {
                router.navigate('/');
            } else if (event.type === 'signout') {
                router.navigate('/');
            }
        });

        // Écouter les événements offline
        offlineManager.subscribe(event => {
            if (event.type === 'offline') {
                document.getElementById('offlineIndicator')?.style.setProperty('display', 'block');
                showToast('Vous êtes hors ligne. Les modifications seront synchronisées.', 'warning');
            } else if (event.type === 'online') {
                document.getElementById('offlineIndicator')?.style.setProperty('display', 'none');
                showToast('Connexion rétablie!', 'success');
                offlineManager.syncQueue();
            }
        });

        // Hamburger menu
        this._setupMobileMenu();

        // Fermer les menus au clic sur un lien
        document.addEventListener('click', (e) => {
            if (e.target.closest('a[href^="#"]')) {
                this._closeMobileMenu();
            }
        });
    }

    /**
     * NAVIGATION
     */
    _setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
    }

    _setupMobileMenu() {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const navMenu = document.getElementById('navMenu');

        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => {
                hamburgerBtn.classList.toggle('active');
                navMenu?.classList.toggle('active');
            });
        }
    }

    _closeMobileMenu() {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const navMenu = document.getElementById('navMenu');

        if (hamburgerBtn) {
            hamburgerBtn.classList.remove('active');
            navMenu?.classList.remove('active');
        }
    }

    /**
     * CHARGEMENT DES VUES
     */
    async _loadView(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();

            const container = document.getElementById('mainContent');
            if (container) {
                container.innerHTML = html;
            }

            // Initialiser les listeners de la vue
            this._initializeViewEventListeners();

            return html;
        } catch (error) {
            console.error(`Erreur chargement ${filePath}:`, error);
            throw error;
        }
    }

    _initializeViewEventListeners() {
        // À implémenter selon les vues
        this._setupFormListeners();
        this._setupDataLoaders();
    }

    _setupFormListeners() {
        // Gestion générique des formulaires
        const forms = document.querySelectorAll('form[data-action]');

        forms.forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const action = form.dataset.action;
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);

                try {
                    showLoading(true);
                    await this._handleFormAction(action, data);
                } catch (error) {
                    showToast(error.message, 'error');
                } finally {
                    showLoading(false);
                }
            });
        });
    }

    async _handleFormAction(action, data) {
        switch (action) {
            case 'signin':
                await auth.signIn(data.email, data.password);
                break;

            case 'signup':
                await auth.signUp(data.email, data.password, {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    phone: data.phone,
                    role: data.role || 'client'
                });
                break;

            case 'subscribe':
                await this._handleSubscription(data);
                break;

            case 'payment':
                await this._handlePayment(data);
                break;

            case 'prospect':
                await this._handleProspect(data);
                break;

            default:
                throw new Error('Action inconnue');
        }
    }

    async _handleSubscription(data) {
        const subscription = await supabase.createSubscription({
            user_id: auth.getUser().id,
            lot_id: data.lotId,
            quantity: parseInt(data.quantity),
            amount: parseFloat(data.amount),
            notes: data.notes || ''
        });

        showToast('Souscription créée avec succès!', 'success');
        router.navigate('/client');
    }

    async _handlePayment(data) {
        const payment = await supabase.createPayment({
            user_id: auth.getUser().id,
            subscription_id: data.subscriptionId,
            amount: parseFloat(data.amount),
            method: data.method,
            reference: data.reference || ''
        });

        showToast('Paiement enregistré!', 'success');
    }

    async _handleProspect(data) {
        const prospect = await supabase.createProspect({
            agent_id: auth.getUser().id,
            name: data.name,
            phone: data.phone,
            email: data.email,
            notes: data.notes || ''
        });

        showToast('Prospect ajouté!', 'success');
    }

    _setupDataLoaders() {
        // Charger automatiquement les données pour les vues
        const loaders = document.querySelectorAll('[data-load]');

        loaders.forEach(async (element) => {
            const dataType = element.dataset.load;

            try {
                showLoading(true);
                const data = await this._loadData(dataType);
                this._renderData(element, data, dataType);
            } catch (error) {
                console.error(`Erreur chargement ${dataType}:`, error);
                element.innerHTML = `<div class="alert alert-error">Erreur lors du chargement des données</div>`;
            } finally {
                showLoading(false);
            }
        });
    }

    async _loadData(type) {
        const userId = auth.getUser()?.id;

        switch (type) {
            case 'lots':
                return await supabase.getLots();

            case 'subscriptions':
                return userId ? await supabase.getSubscriptions(userId) : [];

            case 'payments':
                return userId ? await supabase.getPayments(userId) : [];

            case 'prospects':
                return userId ? await supabase.getProspects(userId) : [];

            case 'commissions':
                return userId ? await supabase.getCommissions(userId) : [];

            case 'dashboard-stats':
                return userId ? await supabase.getDashboardStats() : {};

            default:
                return [];
        }
    }

    _renderData(element, data, type) {
        // À implémenter selon le type de données
        if (type === 'lots') {
            element.innerHTML = this._renderLots(data);
        } else if (type === 'subscriptions') {
            element.innerHTML = this._renderSubscriptions(data);
        } else if (type === 'payments') {
            element.innerHTML = this._renderPayments(data);
        }
    }

    /**
     * RENDUS DE DONNÉES
     */
    _renderLots(lots) {
        return lots.map(lot => `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">${lot.nom}</h3>
                    <span class="badge bg-primary">${lot.superficie} m²</span>
                </div>
                <div class="card-body">
                    <p>${lot.description}</p>
                    <p><strong>Prix:</strong> ${this._formatCurrency(lot.prix)}</p>
                    <p><strong>Localisation:</strong> ${lot.localisation}</p>
                </div>
                <div class="card-footer">
                    <button class="btn btn-primary" onclick="router.navigate('/offres/${lot.id}')">Détails</button>
                    ${auth.isAuthenticated ? `
                        <button class="btn btn-accent" onclick="openSubscribeModal('${lot.id}')">Souscrire</button>
                    ` : `
                        <a href="#/signup" class="btn btn-accent">S'inscrire</a>
                    `}
                </div>
            </div>
        `).join('');
    }

    _renderSubscriptions(subscriptions) {
        return subscriptions.map(sub => `
            <div class="card">
                <div class="card-header">
                    <h4 class="card-title">Souscription #${sub.id}</h4>
                    <span class="badge bg-${sub.status === 'active' ? 'primary' : 'secondary'}">${sub.status}</span>
                </div>
                <div class="card-body">
                    <p><strong>Montant:</strong> ${this._formatCurrency(sub.amount)}</p>
                    <p><strong>Quantité:</strong> ${sub.quantity} lot(s)</p>
                    <p><strong>Date:</strong> ${this._formatDate(sub.created_at)}</p>
                </div>
            </div>
        `).join('');
    }

    _renderPayments(payments) {
        return payments.map(pay => `
            <div class="card">
                <div class="card-header">
                    <h4 class="card-title">Paiement - ${pay.reference}</h4>
                    <span class="badge bg-${pay.status === 'completed' ? 'success' : 'warning'}">${pay.status}</span>
                </div>
                <div class="card-body">
                    <p><strong>Montant:</strong> ${this._formatCurrency(pay.amount)}</p>
                    <p><strong>Méthode:</strong> ${pay.method}</p>
                    <p><strong>Date:</strong> ${this._formatDate(pay.created_at)}</p>
                </div>
            </div>
        `).join('');
    }

    /**
     * PAGES STATIQUES
     */
    _renderDisclaimer() {
        return `
            <div class="card">
                <h1>Disclaimer Légal</h1>
                <div class="alert alert-warning mt-2">
                    <strong>⚠️ Avis Important</strong>
                    <p>Ce programme n'est ni une banque, ni une microfinance, ni une coopérative d'épargne et de crédit.</p>
                </div>
                <p>TERRASOCIAL est une plateforme de mise en relation pour l'accès foncier participatif. Les utilisateurs sont responsables de la vérification de la légalité des transactions et du respect de la réglementation locale.</p>
            </div>
        `;
    }

    _renderCGV() {
        return `
            <div class="card">
                <h1>Conditions Générales de Vente</h1>
                <h2>1. Objet</h2>
                <p>TERRASOCIAL fournit une plateforme de mise en relation pour l'accès foncier participatif...</p>
                <h2>2. Limitations de Responsabilité</h2>
                <p>TERRASOCIAL n'est pas responsable des transactions entre utilisateurs...</p>
            </div>
        `;
    }

    _renderPrivacy() {
        return `
            <div class="card">
                <h1>Politique de Confidentialité</h1>
                <p>TERRASOCIAL traite vos données personnelles conformément à la réglementation...</p>
            </div>
        `;
    }

    _renderAbout() {
        return `
            <div class="card">
                <h1>À Propos de TERRASOCIAL</h1>
                <p>TERRASOCIAL est une initiative pour rendre l'accès à la terre plus accessible et participatif...</p>
            </div>
        `;
    }

    _renderContact() {
        return `
            <div class="card">
                <h1>Nous Contacter</h1>
                <form data-action="contact">
                    <div class="form-group">
                        <label>Nom</label>
                        <input type="text" name="name" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label>Message</label>
                        <textarea name="message" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Envoyer</button>
                </form>
            </div>
        `;
    }

    _renderFAQ() {
        return `
            <div class="card">
                <h1>Questions Fréquemment Posées</h1>
                <h3>Comment fonctionne TERRASOCIAL?</h3>
                <p>TERRASOCIAL connecte des vendeurs de terrain avec des acheteurs intéressés...</p>
            </div>
        `;
    }

    /**
     * UTILITAIRES
     */
    _formatCurrency(value) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XOF'
        }).format(value);
    }

    _formatDate(date) {
        return new Intl.DateTimeFormat('fr-FR').format(new Date(date));
    }
}

/**
 * FONCTIONS GLOBALES
 */
function showLoading(show = true) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.classList.toggle('active', show);
    }
}

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function openModal(title, content, actions = []) {
    const container = document.getElementById('modalContainer');
    if (!container) return;

    const modal = document.createElement('div');
    modal.className = 'modal-container active';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">${content}</div>
            <div class="modal-footer">
                ${actions.map(action => `
                    <button class="btn btn-${action.type || 'secondary'}" data-action="${action.id}">
                        ${action.label}
                    </button>
                `).join('')}
                <button class="btn btn-secondary" data-action="close">Fermer</button>
            </div>
        </div>
    `;

    container.appendChild(modal);

    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    const actionButtons = modal.querySelectorAll('[data-action]');

    const closeModal = () => modal.remove();

    closeBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    actionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'close') {
                closeModal();
            } else {
                const handler = actions.find(a => a.id === action);
                if (handler?.callback) {
                    handler.callback();
                }
            }
        });
    });
}

function openSubscribeModal(lotId) {
    const content = `
        <form data-action="subscribe">
            <input type="hidden" name="lotId" value="${lotId}">
            <div class="form-group">
                <label>Quantité de lots</label>
                <input type="number" name="quantity" min="1" value="1" required>
            </div>
            <div class="form-group">
                <label>Montant</label>
                <input type="number" name="amount" step="0.01" required>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea name="notes"></textarea>
            </div>
        </form>
    `;

    openModal('Souscrire à un lot', content, [
        {
            id: 'submit',
            label: 'Souscrire',
            type: 'primary',
            callback: () => {
                const form = document.querySelector('form[data-action="subscribe"]');
                if (form) {
                    form.dispatchEvent(new Event('submit'));
                }
            }
        }
    ]);
}

// Initialiser l'application au chargement
document.addEventListener('DOMContentLoaded', async () => {
    const app = new TermaSocialApp();
    await app.init();
});
