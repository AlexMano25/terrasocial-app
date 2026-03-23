const { test, expect } = require('@playwright/test');

test.describe('API endpoints', () => {
    test('GET /api/health responds with 200 and status ok', async ({ request }) => {
        const response = await request.get('/api/health');

        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('status', 'ok');
        expect(body).toHaveProperty('timestamp');
        expect(body).toHaveProperty('db_client');
    });

    test('GET /api/auth/me without token returns 401', async ({ request }) => {
        const response = await request.get('/api/auth/me');
        expect(response.status()).toBe(401);
    });

    test('POST /api/auth/login with missing credentials returns 400', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
            data: {}
        });
        expect(response.status()).toBe(400);
    });

    test('GET /api/public/lots returns 200', async ({ request }) => {
        const response = await request.get('/api/public/lots');
        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('lots');
    });
});
