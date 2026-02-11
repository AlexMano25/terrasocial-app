/**
 * Authentication Manager
 * Gère l'authentification Supabase et l'état utilisateur
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.userRole = null;
        this.listeners = [];

        this._init();
    }

    async _init() {
        await this.checkAuthStatus();
        this._setupUI();
    }

    /**
     * AUTHENTIFICATION
     */
    async signUp(email, password, userData = {}) {
        try {
            showLoading(true);

            const result = await supabase.signUp(email, password, {
                role: userData.role || 'client',
                first_name: userData.firstName || '',
                last_name: userData.lastName || '',
                phone: userData.phone || ''
            });

            if (result.user) {
                this.currentUser = result.user;
                this.isAuthenticated = true;
                this.userRole = result.user.user_metadata?.role || 'client';

                supabase.setAuthToken(result.session.access_token);
                localStorage.setItem('user', JSON.stringify(result.user));

                await offlineManager.saveData('user', result.user);
                this._notifyListeners({ type: 'signup-success', user: result.user });

                showToast('Inscription réussie! Vérifiez votre email.', 'success');
                return result.user;
            }

            throw new Error('Inscription échouée');
        } catch (error) {
            console.error('SignUp error:', error);
            showToast(error.message, 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    async signIn(email, password) {
        try {
            showLoading(true);

            const result = await supabase.signIn(email, password);

            if (result.user) {
                this.currentUser = result.user;
                this.isAuthenticated = true;
                this.userRole = result.user.user_metadata?.role || 'client';

                localStorage.setItem('auth_token', result.access_token);
                localStorage.setItem('user', JSON.stringify(result.user));

                await offlineManager.saveData('user', result.user);
                this._notifyListeners({ type: 'signin-success', user: result.user });

                showToast('Connexion réussie!', 'success');
                this._updateUI();
                return result.user;
            }

            throw new Error('Identifiants invalides');
        } catch (error) {
            console.error('SignIn error:', error);
            showToast(error.message, 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    async signOut() {
        try {
            await supabase.signOut();
            this.currentUser = null;
            this.isAuthenticated = false;
            this.userRole = null;

            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');

            await offlineManager.clearStore('user');
            this._notifyListeners({ type: 'signout' });

            showToast('Déconnexion réussie', 'success');
            this._updateUI();
            router.navigate('/');
        } catch (error) {
            console.error('SignOut error:', error);
            showToast('Erreur lors de la déconnexion', 'error');
        }
    }

    async checkAuthStatus() {
        try {
            // Vérifier le localStorage d'abord
            const storedToken = localStorage.getItem('auth_token');
            const storedUser = localStorage.getItem('user');

            if (storedToken && storedUser) {
                this.currentUser = JSON.parse(storedUser);
                this.isAuthenticated = true;
                this.userRole = this.currentUser.user_metadata?.role || 'client';
                return;
            }

            // Vérifier avec Supabase
            const user = await supabase.getCurrentUser();
            if (user) {
                this.currentUser = user;
                this.isAuthenticated = true;
                this.userRole = user.user_metadata?.role || 'client';

                localStorage.setItem('user', JSON.stringify(user));
                await offlineManager.saveData('user', user);
            }
        } catch (error) {
            console.error('Auth check error:', error);
            this._clearAuth();
        }
    }

    async refreshSession() {
        try {
            const token = localStorage.getItem('refresh_token');
            if (token) {
                await supabase.refreshToken(token);
                await this.checkAuthStatus();
            }
        } catch (error) {
            console.error('Refresh error:', error);
            this._clearAuth();
        }
    }

    /**
     * GESTION DES RÔLES
     */
    isClient() {
        return this.isAuthenticated && this.userRole === 'client';
    }

    isAgent() {
        return this.isAuthenticated && this.userRole === 'agent';
    }

    isAdmin() {
        return this.isAuthenticated && this.userRole === 'admin';
    }

    hasRole(role) {
        return this.isAuthenticated && this.userRole === role;
    }

    /**
     * UI MANAGEMENT
     */
    _setupUI() {
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userMenu = document.getElementById('userMenu');
        const profileLink = document.getElementById('profileLink');
        const settingsLink = document.getElementById('settingsLink');
        const logoutBtn = document.getElementById('logoutBtn');
        const signinLink = document.getElementById('signinLink');
        const signupLink = document.getElementById('signupLink');
        const userInfo = document.getElementById('userInfo');
        const userEmail = document.getElementById('userEmail');

        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu?.classList.toggle('active');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.signOut());
        }

        // Fermer le menu au clic extérieur
        document.addEventListener('click', () => {
            userMenu?.classList.remove('active');
        });

        this._updateUI();
    }

    _updateUI() {
        const profileLink = document.getElementById('profileLink');
        const settingsLink = document.getElementById('settingsLink');
        const logoutBtn = document.getElementById('logoutBtn');
        const signinLink = document.getElementById('signinLink');
        const signupLink = document.getElementById('signupLink');
        const userInfo = document.getElementById('userInfo');
        const userEmail = document.getElementById('userEmail');

        if (this.isAuthenticated && this.currentUser) {
            profileLink?.style.setProperty('display', 'block');
            settingsLink?.style.setProperty('display', 'block');
            logoutBtn?.style.setProperty('display', 'block');
            signinLink?.style.setProperty('display', 'none');
            signupLink?.style.setProperty('display', 'none');
            userInfo?.style.setProperty('display', 'block');

            if (userEmail) {
                userEmail.textContent = this.currentUser.email;
            }

            // Afficher les liens selon le rôle
            this._updateNavigation();
        } else {
            profileLink?.style.setProperty('display', 'none');
            settingsLink?.style.setProperty('display', 'none');
            logoutBtn?.style.setProperty('display', 'none');
            signinLink?.style.setProperty('display', 'block');
            signupLink?.style.setProperty('display', 'block');
            userInfo?.style.setProperty('display', 'none');
        }
    }

    _updateNavigation() {
        const navMenu = document.getElementById('navMenu');
        if (!navMenu) return;

        // Masquer les liens admin et agent par défaut
        const agentLink = navMenu.querySelector('[data-route="agent"]');
        const adminLink = navMenu.querySelector('[data-route="admin"]');

        if (agentLink) {
            agentLink.style.display = this.isAgent() || this.isAdmin() ? 'block' : 'none';
        }

        if (adminLink) {
            adminLink.style.display = this.isAdmin() ? 'block' : 'none';
        }
    }

    /**
     * ÉCOUTEURS
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    _notifyListeners(event) {
        this.listeners.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Listener error:', error);
            }
        });
    }

    /**
     * UTILITAIRES
     */
    _clearAuth() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.userRole = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
    }

    getUser() {
        return this.currentUser;
    }

    getToken() {
        return localStorage.getItem('auth_token');
    }

    getRole() {
        return this.userRole;
    }
}

// Initialiser le gestionnaire d'authentification global
const auth = new AuthManager();

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
