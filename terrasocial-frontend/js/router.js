/**
 * Simple SPA Router
 * Gère le routing client-side pour l'application
 */

class Router {
    constructor(containerId = 'mainContent') {
        this.container = document.getElementById(containerId);
        this.routes = new Map();
        this.currentRoute = null;
        this.middlewares = [];
        this.beforeHooks = [];
        this.afterHooks = [];

        this._setupHashListener();
    }

    /**
     * ENREGISTREMENT DES ROUTES
     */
    register(path, handler, options = {}) {
        this.routes.set(path, {
            handler,
            meta: options.meta || {},
            requireAuth: options.requireAuth || false,
            title: options.title || 'TERRASOCIAL'
        });
        return this;
    }

    registerDynamic(pattern, handler, options = {}) {
        // Pattern like '/user/:id'
        const regex = this._patternToRegex(pattern);
        this.routes.set(regex, {
            handler,
            meta: options.meta || {},
            requireAuth: options.requireAuth || false,
            title: options.title || 'TERRASOCIAL',
            isDynamic: true
        });
        return this;
    }

    /**
     * NAVIGATION
     */
    navigate(path, state = {}) {
        window.location.hash = path;
    }

    back() {
        window.history.back();
    }

    forward() {
        window.history.forward();
    }

    /**
     * HOOKS ET MIDDLEWARES
     */
    before(callback) {
        this.beforeHooks.push(callback);
        return this;
    }

    after(callback) {
        this.afterHooks.push(callback);
        return this;
    }

    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    /**
     * PRIVATE METHODS
     */
    _setupHashListener() {
        window.addEventListener('hashchange', () => this._handleNavigation());
        // Initial route
        this._handleNavigation();
    }

    async _handleNavigation() {
        const path = this._getCurrentPath();

        try {
            // Execute before hooks
            for (const hook of this.beforeHooks) {
                await hook(path);
            }

            // Find matching route
            const route = this._findRoute(path);

            if (!route) {
                this._showNotFound(path);
                return;
            }

            const { handler, requireAuth, title } = route;

            // Check authentication if required
            if (requireAuth && !await this._isAuthenticated()) {
                this.navigate('/signin');
                return;
            }

            // Execute middlewares
            for (const middleware of this.middlewares) {
                await middleware(path, route);
            }

            // Load and render view
            await this._loadView(handler, path);

            // Update page title
            document.title = title + ' - TERRASOCIAL';

            // Execute after hooks
            for (const hook of this.afterHooks) {
                await hook(path);
            }

            this.currentRoute = path;
        } catch (error) {
            console.error('Navigation error:', error);
            this._showError(error);
        }
    }

    _getCurrentPath() {
        const hash = window.location.hash || '#/';
        return hash.startsWith('#') ? hash.slice(1) : hash;
    }

    _findRoute(path) {
        // Exact match
        if (this.routes.has(path)) {
            return this.routes.get(path);
        }

        // Dynamic match
        for (const [pattern, route] of this.routes) {
            if (route.isDynamic) {
                const match = path.match(pattern);
                if (match) {
                    return {
                        ...route,
                        params: this._extractParams(pattern, path)
                    };
                }
            }
        }

        return null;
    }

    _patternToRegex(pattern) {
        const escaped = pattern.replace(/\//g, '\\/');
        const withParams = escaped.replace(/:([^/]+)/g, '([^/]+)');
        return new RegExp(`^${withParams}$`);
    }

    _extractParams(regex, path) {
        const match = path.match(regex);
        if (!match) return {};

        const paramNames = regex.source.match(/:([^/]+)/g) || [];
        const params = {};

        paramNames.forEach((name, index) => {
            params[name.slice(1)] = match[index + 1];
        });

        return params;
    }

    async _loadView(handler, path) {
        // Si c'est une fonction, l'exécuter
        if (typeof handler === 'function') {
            const result = await handler(path);
            if (typeof result === 'string') {
                this.container.innerHTML = result;
            }
            return;
        }

        // Si c'est un chemin de fichier, le charger
        if (typeof handler === 'string') {
            try {
                const response = await fetch(handler);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const html = await response.text();
                this.container.innerHTML = html;
            } catch (error) {
                console.error(`Failed to load ${handler}:`, error);
                this._showError(error);
            }
        }
    }

    async _isAuthenticated() {
        return !!supabase.getAuthToken();
    }

    _showNotFound(path) {
        this.container.innerHTML = `
            <div class="card" style="margin: 2rem; text-align: center;">
                <h1>404 - Page non trouvée</h1>
                <p style="margin: 1rem 0;">La page <strong>${this._escapeHtml(path)}</strong> n'existe pas.</p>
                <a href="#/" class="btn btn-primary">Retour à l'accueil</a>
            </div>
        `;
    }

    _showError(error) {
        const message = error.message || 'Une erreur est survenue';
        this.container.innerHTML = `
            <div class="alert alert-error" style="margin: 2rem;">
                <div class="alert-icon">⚠️</div>
                <div>
                    <strong>Erreur</strong>
                    <p>${this._escapeHtml(message)}</p>
                </div>
            </div>
        `;
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * UTILITAIRES
     */
    getQueryParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    getQueryParams() {
        return new URLSearchParams(window.location.search);
    }
}

// Initialiser le router global
const router = new Router();

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Router;
}
