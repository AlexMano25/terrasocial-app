/**
 * Offline Manager
 * Gère le stockage hors ligne avec IndexedDB et la synchronisation
 */

class OfflineManager {
    constructor(dbName = 'terrasocial-db', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.listeners = [];

        this._initEventListeners();
    }

    /**
     * INITIALISATION
     */
    async init() {
        await this._openDatabase();
        this._setupOnlineListeners();
        return this;
    }

    async _openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;

                // Créer les object stores
                const stores = ['lots', 'subscriptions', 'payments', 'prospects', 'syncQueue', 'cache'];

                stores.forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const options = storeName === 'syncQueue' ? { keyPath: 'id', autoIncrement: true } : { keyPath: 'id' };
                        db.createObjectStore(storeName, options);
                    }
                });
            };
        });
    }

    _setupOnlineListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this._notifyListeners({ type: 'online' });
            this.syncQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this._notifyListeners({ type: 'offline' });
        });
    }

    /**
     * STOCKAGE DE DONNÉES
     */
    async saveData(storeName, data) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async getData(storeName, key) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async getAllData(storeName) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async deleteData(storeName, key) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async clearStore(storeName) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    /**
     * SYNC QUEUE
     */
    async addToSyncQueue(request) {
        const queueItem = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            url: request.url,
            method: request.method || 'POST',
            headers: request.headers || {},
            body: request.body,
            retries: 0,
            maxRetries: 3
        };

        await this.saveData('syncQueue', queueItem);
        this.syncQueue.push(queueItem);
        this._notifyListeners({ type: 'queue-added', data: queueItem });

        return queueItem;
    }

    async syncQueue() {
        if (!this.isOnline) return;

        const queue = await this.getAllData('syncQueue');

        for (const item of queue) {
            try {
                const response = await fetch(item.url, {
                    method: item.method,
                    headers: item.headers,
                    body: item.body
                });

                if (response.ok) {
                    await this.deleteData('syncQueue', item.id);
                    this._notifyListeners({ type: 'sync-success', data: item });
                } else if (item.retries < item.maxRetries) {
                    item.retries++;
                    await this.saveData('syncQueue', item);
                    this._notifyListeners({ type: 'sync-retry', data: item });
                } else {
                    this._notifyListeners({ type: 'sync-failed', data: item });
                }
            } catch (error) {
                if (item.retries < item.maxRetries) {
                    item.retries++;
                    await this.saveData('syncQueue', item);
                } else {
                    this._notifyListeners({ type: 'sync-error', error: error.message, data: item });
                }
            }
        }
    }

    /**
     * CACHE
     */
    async setCacheData(key, data, ttl = 3600000) { // 1 heure par défaut
        const cacheItem = {
            id: key,
            data,
            timestamp: Date.now(),
            ttl
        };

        await this.saveData('cache', cacheItem);
        return cacheItem;
    }

    async getCacheData(key) {
        const cacheItem = await this.getData('cache', key);

        if (!cacheItem) return null;

        // Vérifier si le cache est expiré
        if (Date.now() - cacheItem.timestamp > cacheItem.ttl) {
            await this.deleteData('cache', key);
            return null;
        }

        return cacheItem.data;
    }

    async clearExpiredCache() {
        const allCache = await this.getAllData('cache');
        const now = Date.now();

        for (const item of allCache) {
            if (now - item.timestamp > item.ttl) {
                await this.deleteData('cache', item.id);
            }
        }
    }

    /**
     * ÉCOUTEURS D'ÉVÉNEMENTS
     */
    _initEventListeners() {
        this.listeners = [];
    }

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
    async exportData() {
        const stores = ['lots', 'subscriptions', 'payments', 'prospects'];
        const exportData = {};

        for (const storeName of stores) {
            exportData[storeName] = await this.getAllData(storeName);
        }

        return exportData;
    }

    async importData(data) {
        for (const [storeName, items] of Object.entries(data)) {
            await this.clearStore(storeName);
            for (const item of items) {
                await this.saveData(storeName, item);
            }
        }
    }

    async getStorageStats() {
        const stores = ['lots', 'subscriptions', 'payments', 'prospects', 'syncQueue', 'cache'];
        const stats = {};

        for (const storeName of stores) {
            const data = await this.getAllData(storeName);
            stats[storeName] = {
                count: data.length,
                estimatedSize: JSON.stringify(data).length
            };
        }

        return stats;
    }

    async clearAllData() {
        const stores = ['lots', 'subscriptions', 'payments', 'prospects', 'syncQueue', 'cache'];

        for (const storeName of stores) {
            await this.clearStore(storeName);
        }
    }

    getOnlineStatus() {
        return {
            isOnline: this.isOnline,
            queueLength: this.syncQueue.length
        };
    }
}

// Initialiser le gestionnaire offline global
const offlineManager = new OfflineManager();
offlineManager.init();

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineManager;
}
