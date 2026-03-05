const CACHE_NAME = 'terrasocial-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/main.css',
    '/js/app.js',
    '/js/supabase-client.js',
    '/js/offline-manager.js',
    '/js/router.js',
    '/js/auth.js',
];

// Installation
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
    self.skipWaiting();
});

// Activation
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch - Network first, fallback to cache
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Handle API calls - Network first with timeout
    if (event.request.url.includes('/api/') || event.request.url.includes('supabase')) {
        event.respondWith(
            Promise.race([
                fetch(event.request),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 5000)
                )
            ])
                .then(response => {
                    // Cache successful API responses
                    if (response && response.status === 200) {
                        const cloneResponse = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, cloneResponse);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached response on failure
                    return caches.match(event.request)
                        .then(response => response || createOfflineResponse());
                })
        );
        return;
    }

    // Handle static assets - Cache first
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request).then(response => {
                    if (!response || response.status !== 200 || response.type === 'error') {
                        return response;
                    }

                    const cloneResponse = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, cloneResponse);
                    });

                    return response;
                });
            })
            .catch(() => createOfflineResponse())
    );
});

// Background Sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-offline-data') {
        event.waitUntil(syncOfflineData());
    }
});

async function syncOfflineData() {
    try {
        const db = await openIndexedDB();
        const queue = await getAllFromStore(db, 'syncQueue');

        for (const item of queue) {
            try {
                const response = await fetch(item.url, {
                    method: item.method,
                    headers: item.headers,
                    body: item.body
                });

                if (response.ok) {
                    await deleteFromStore(db, 'syncQueue', item.id);
                    notifyClients({ type: 'sync-success', data: item });
                }
            } catch (error) {
                notifyClients({ type: 'sync-error', error: error.message });
            }
        }
    } catch (error) {
        console.error('Sync failed:', error);
    }
}

function createOfflineResponse() {
    return new Response(
        JSON.stringify({
            offline: true,
            message: 'Vous êtes actuellement hors ligne. Les données en cache seront affichées.'
        }),
        {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'application/json'
            })
        }
    );
}

function notifyClients(message) {
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage(message);
        });
    });
}

async function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('terrasocial-db', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id' });
            }
        };
    });
}

async function getAllFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function deleteFromStore(db, storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

// Push Notifications
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const options = {
        body: data.body || 'Nouvelle notification',
        icon: 'assets/logo-192.png',
        badge: 'assets/logo-192.png',
        tag: data.tag || 'terrasocial-notification',
        requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'TERRASOCIAL', options)
    );
});

// Notification Click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (let client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
