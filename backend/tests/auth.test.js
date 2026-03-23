const request = require('supertest');
const { getApp } = require('./setup');

let app;
let registeredToken;

const VALID_PASSWORD = 'TestPass1!xyz';
const WEAK_PASSWORD = 'weak';

const uniqueEmail = () => `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const uniquePhone = () => `+23765${Math.floor(1000000 + Math.random() * 9000000)}`;

beforeAll(async () => {
    app = await getApp();
});

describe('POST /api/auth/register/client', () => {
    test('registers a client with valid data and returns 201 + token', async () => {
        const email = uniqueEmail();
        const res = await request(app)
            .post('/api/auth/register/client')
            .send({
                full_name: 'Jean Dupont',
                email,
                phone: uniquePhone(),
                password: VALID_PASSWORD
            });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        expect(typeof res.body.token).toBe('string');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user.role).toBe('client');
        expect(res.body.user.full_name).toBe('Jean Dupont');

        registeredToken = res.body.token;
    });

    test('rejects a weak password with 400', async () => {
        const res = await request(app)
            .post('/api/auth/register/client')
            .send({
                full_name: 'Weak User',
                email: uniqueEmail(),
                password: WEAK_PASSWORD
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toMatch(/mot de passe faible/i);
    });

    test('rejects duplicate email with 409', async () => {
        const email = uniqueEmail();

        // First registration
        await request(app)
            .post('/api/auth/register/client')
            .send({
                full_name: 'First User',
                email,
                password: VALID_PASSWORD
            });

        // Duplicate registration
        const res = await request(app)
            .post('/api/auth/register/client')
            .send({
                full_name: 'Second User',
                email,
                password: VALID_PASSWORD
            });

        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toMatch(/email/i);
    });

    test('rejects missing full_name with 400', async () => {
        const res = await request(app)
            .post('/api/auth/register/client')
            .send({
                email: uniqueEmail(),
                password: VALID_PASSWORD
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('rejects missing email and phone with 400', async () => {
        const res = await request(app)
            .post('/api/auth/register/client')
            .send({
                full_name: 'No Contact',
                password: VALID_PASSWORD
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});

describe('POST /api/auth/login', () => {
    const loginEmail = uniqueEmail();
    const loginPhone = uniquePhone();

    beforeAll(async () => {
        await request(app)
            .post('/api/auth/register/client')
            .send({
                full_name: 'Login Test User',
                email: loginEmail,
                phone: loginPhone,
                password: VALID_PASSWORD
            });
    });

    test('logs in with valid email credentials and returns 200 + token', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                identifier: loginEmail,
                password: VALID_PASSWORD
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(typeof res.body.token).toBe('string');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user.full_name).toBe('Login Test User');
    });

    test('logs in with valid phone credentials and returns 200 + token', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                identifier: loginPhone,
                password: VALID_PASSWORD
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
    });

    test('rejects wrong password with 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                identifier: loginEmail,
                password: 'WrongPassword1!'
            });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toMatch(/invalide/i);
    });

    test('rejects non-existent user with 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                identifier: 'nonexistent@nowhere.com',
                password: VALID_PASSWORD
            });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    test('rejects missing credentials with 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});

describe('GET /api/auth/me', () => {
    let meToken;

    beforeAll(async () => {
        const email = uniqueEmail();
        const regRes = await request(app)
            .post('/api/auth/register/client')
            .send({
                full_name: 'Me Test User',
                email,
                password: VALID_PASSWORD
            });
        meToken = regRes.body.token;
    });

    test('returns user data with valid token (200)', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${meToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user).toHaveProperty('full_name');
        expect(res.body.user.full_name).toBe('Me Test User');
    });

    test('rejects request without token with 401', async () => {
        const res = await request(app)
            .get('/api/auth/me');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    test('rejects request with invalid token with 401', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer invalid.token.here');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });
});

describe('POST /api/auth/request-password-reset', () => {
    let resetEmail;

    beforeAll(async () => {
        resetEmail = uniqueEmail();
        await request(app)
            .post('/api/auth/register/client')
            .send({
                full_name: 'Reset User',
                email: resetEmail,
                password: VALID_PASSWORD
            });
    });

    test('returns 200 for existing user email', async () => {
        const res = await request(app)
            .post('/api/auth/request-password-reset')
            .send({ identifier: resetEmail });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        // In test mode, debug_reset_token should be present
        expect(res.body).toHaveProperty('debug_reset_token');
        expect(typeof res.body.debug_reset_token).toBe('string');
    });

    test('returns 200 even for non-existent email (no info leak)', async () => {
        const res = await request(app)
            .post('/api/auth/request-password-reset')
            .send({ identifier: 'nobody@nowhere.com' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
    });

    test('rejects empty identifier with 400', async () => {
        const res = await request(app)
            .post('/api/auth/request-password-reset')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});
