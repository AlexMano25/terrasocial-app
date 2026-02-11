/**
 * Supabase Client Configuration
 * Manages all communication with Supabase backend
 */

class SupabaseClient {
    constructor(url, key) {
        this.url = url || 'https://xyzabc.supabase.co'; // À remplacer
        this.key = key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // À remplacer
        this.baseHeaders = {
            'Content-Type': 'application/json',
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`
        };
    }

    /**
     * AUTHENTIFICATION
     */
    async signUp(email, password, userData = {}) {
        try {
            const response = await fetch(`${this.url}/auth/v1/signup`, {
                method: 'POST',
                headers: this.baseHeaders,
                body: JSON.stringify({
                    email,
                    password,
                    data: userData
                })
            });

            if (!response.ok) {
                throw new Error(`Auth error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('SignUp error:', error);
            throw error;
        }
    }

    async signIn(email, password) {
        try {
            const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: this.baseHeaders,
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                throw new Error('Invalid credentials');
            }

            const data = await response.json();
            this.setAuthToken(data.access_token);
            return data;
        } catch (error) {
            console.error('SignIn error:', error);
            throw error;
        }
    }

    async signOut() {
        this.removeAuthToken();
    }

    async getCurrentUser() {
        const token = this.getAuthToken();
        if (!token) return null;

        try {
            const response = await fetch(`${this.url}/auth/v1/user`, {
                headers: {
                    ...this.baseHeaders,
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                this.removeAuthToken();
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    async refreshToken(refreshToken) {
        try {
            const response = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: this.baseHeaders,
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            this.setAuthToken(data.access_token);
            return data;
        } catch (error) {
            console.error('Refresh token error:', error);
            throw error;
        }
    }

    /**
     * CRUD OPERATIONS
     */
    async select(table, options = {}) {
        return this._makeRequest('GET', `/rest/v1/${table}`, null, options);
    }

    async insert(table, data) {
        return this._makeRequest('POST', `/rest/v1/${table}`, data);
    }

    async update(table, data, id) {
        const query = `${table}?id=eq.${id}`;
        return this._makeRequest('PATCH', `/rest/v1/${query}`, data);
    }

    async delete(table, id) {
        const query = `${table}?id=eq.${id}`;
        return this._makeRequest('DELETE', `/rest/v1/${query}`);
    }

    async rpc(functionName, params = {}) {
        return this._makeRequest('POST', `/rest/v1/rpc/${functionName}`, params);
    }

    /**
     * REQUÊTES PERSONNALISÉES
     */
    async _makeRequest(method, path, body = null, options = {}) {
        const token = this.getAuthToken();
        const headers = { ...this.baseHeaders };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Ajouter les options Supabase
        if (options.select) headers['Prefer'] = 'return=representation';
        if (options.count) headers['Prefer'] = (headers['Prefer'] || '') + ',count=exact';

        try {
            const config = {
                method,
                headers
            };

            if (body) {
                config.body = JSON.stringify(body);
            }

            const response = await fetch(`${this.url}${path}`, config);

            // Gérer les erreurs
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            if (method === 'DELETE') {
                return { success: true };
            }

            return await response.json();
        } catch (error) {
            console.error(`Request error [${method} ${path}]:`, error);
            throw error;
        }
    }

    /**
     * GESTION DES TOKENS
     */
    setAuthToken(token) {
        localStorage.setItem('auth_token', token);
        this.baseHeaders['Authorization'] = `Bearer ${token}`;
    }

    getAuthToken() {
        return localStorage.getItem('auth_token');
    }

    removeAuthToken() {
        localStorage.removeItem('auth_token');
        delete this.baseHeaders['Authorization'];
    }

    /**
     * HELPER METHODS
     */
    async getLots() {
        return this.select('lots', { select: '*' });
    }

    async getLotById(id) {
        return this.select(`lots?id=eq.${id}`);
    }

    async searchLots(query) {
        return this.select(`lots?or=(nom.ilike.%${query}%,description.ilike.%${query}%)`);
    }

    async createSubscription(data) {
        return this.insert('subscriptions', {
            ...data,
            created_at: new Date().toISOString(),
            status: 'pending'
        });
    }

    async getSubscriptions(userId) {
        return this.select(`subscriptions?user_id=eq.${userId}`);
    }

    async updateSubscription(id, data) {
        return this.update('subscriptions', data, id);
    }

    async getPayments(userId) {
        return this.select(`payments?user_id=eq.${userId}`);
    }

    async createPayment(data) {
        return this.insert('payments', {
            ...data,
            created_at: new Date().toISOString(),
            status: 'pending'
        });
    }

    async getProspects(agentId) {
        return this.select(`prospects?agent_id=eq.${agentId}`);
    }

    async createProspect(data) {
        return this.insert('prospects', {
            ...data,
            created_at: new Date().toISOString(),
            status: 'new'
        });
    }

    async updateProspect(id, data) {
        return this.update('prospects', data, id);
    }

    async getCommissions(agentId) {
        return this.select(`commissions?agent_id=eq.${agentId}`);
    }

    async getDashboardStats() {
        return this.rpc('get_dashboard_stats');
    }

    async getAdminStats() {
        return this.rpc('get_admin_stats');
    }
}

// Initialiser le client global
const supabase = new SupabaseClient();

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseClient;
}
