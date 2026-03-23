const request = require('supertest');
const { getApp } = require('./setup');

let app;
let clientToken;

const VALID_PASSWORD = 'TestPass1!xyz';
const uniqueEmail = () => `admin_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

beforeAll(async () => {
    app = await getApp();

    // Register a regular client (non-admin) to test access control
    const res = await request(app)
        .post('/api/auth/register/client')
        .send({
            full_name: 'Regular Client',
            email: uniqueEmail(),
            password: VALID_PASSWORD
        });

    clientToken = res.body.token;
});

describe('Super-admin access control', () => {
    test('GET /api/super-admin/overview rejects unauthenticated request with 401', async () => {
        const res = await request(app)
            .get('/api/super-admin/overview');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    test('GET /api/super-admin/overview rejects regular client with 403', async () => {
        const res = await request(app)
            .get('/api/super-admin/overview')
            .set('Authorization', `Bearer ${clientToken}`);

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error');
    });

    test('GET /api/super-admin/overview rejects invalid token with 401', async () => {
        const res = await request(app)
            .get('/api/super-admin/overview')
            .set('Authorization', 'Bearer totally.invalid.token');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });
});
