const request = require('supertest');
const { getApp } = require('./setup');

let app;
let clientToken;
let clientUserId;

const VALID_PASSWORD = 'TestPass1!xyz';
const uniqueEmail = () => `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
const uniquePhone = () => `+23765${Math.floor(1000000 + Math.random() * 9000000)}`;

beforeAll(async () => {
    app = await getApp();

    // Register a client to use throughout the tests
    const res = await request(app)
        .post('/api/auth/register/client')
        .send({
            full_name: 'Client Test User',
            email: uniqueEmail(),
            phone: uniquePhone(),
            password: VALID_PASSWORD
        });

    clientToken = res.body.token;
    clientUserId = res.body.user.id;
});

describe('GET /api/client/dashboard', () => {
    test('rejects unauthenticated request with 401', async () => {
        const res = await request(app)
            .get('/api/client/dashboard');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    test('rejects invalid token with 401', async () => {
        const res = await request(app)
            .get('/api/client/dashboard')
            .set('Authorization', 'Bearer fake.invalid.token');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    test('returns dashboard data with valid client token (200)', async () => {
        const res = await request(app)
            .get('/api/client/dashboard')
            .set('Authorization', `Bearer ${clientToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('profile');
        expect(res.body).toHaveProperty('metrics');
        expect(res.body).toHaveProperty('reservations');
        expect(res.body).toHaveProperty('payments');
        expect(res.body).toHaveProperty('contracts');
        expect(res.body).toHaveProperty('possession');
        expect(Array.isArray(res.body.reservations)).toBe(true);
        expect(Array.isArray(res.body.payments)).toBe(true);
    });
});

describe('POST /api/client/reservations', () => {
    test('creates a reservation with valid data (201)', async () => {
        const res = await request(app)
            .post('/api/client/reservations')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                lot_type: 'standard',
                lot_price: 1300000,
                duration_months: 24
            });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.lot_type).toBe('standard');
        expect(res.body).toHaveProperty('deposit_amount');
        expect(res.body).toHaveProperty('monthly_amount');
        expect(res.body).toHaveProperty('daily_amount');
        expect(res.body.duration_months).toBe(24);
    });

    test('rejects reservation with missing lot_type (400)', async () => {
        const res = await request(app)
            .post('/api/client/reservations')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                lot_price: 1300000,
                duration_months: 24
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('rejects reservation with invalid duration (400)', async () => {
        const res = await request(app)
            .post('/api/client/reservations')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                lot_type: 'standard',
                lot_price: 1300000,
                duration_months: 200
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('rejects unauthenticated reservation request with 401', async () => {
        const res = await request(app)
            .post('/api/client/reservations')
            .send({
                lot_type: 'standard',
                lot_price: 1300000,
                duration_months: 24
            });

        expect(res.status).toBe(401);
    });
});

describe('POST /api/client/versement', () => {
    let reservationId;

    beforeAll(async () => {
        // Create a reservation first so we can make payments against it
        const res = await request(app)
            .post('/api/client/reservations')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                lot_type: 'starter',
                lot_price: 40000,
                duration_months: 12
            });

        reservationId = res.body.id;
    });

    test('creates a versement with valid data (201)', async () => {
        const res = await request(app)
            .post('/api/client/versement')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                reservation_id: reservationId,
                amount: 1500,
                method: 'orange_money'
            });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('reference');
        expect(res.body.amount).toBe(1500);
        expect(res.body.method).toBe('orange_money');
        expect(res.body.status).toBe('pending');
        expect(res.body.reservation_id).toBe(reservationId);
    });

    test('rejects versement below minimum daily amount (400)', async () => {
        const res = await request(app)
            .post('/api/client/versement')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                reservation_id: reservationId,
                amount: 100,
                method: 'orange_money'
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body).toHaveProperty('min_amount');
    });

    test('rejects versement with invalid payment method (400)', async () => {
        const res = await request(app)
            .post('/api/client/versement')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                reservation_id: reservationId,
                amount: 1500,
                method: 'bitcoin'
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('rejects unauthenticated versement with 401', async () => {
        const res = await request(app)
            .post('/api/client/versement')
            .send({
                reservation_id: reservationId,
                amount: 1500,
                method: 'orange_money'
            });

        expect(res.status).toBe(401);
    });
});

describe('GET /api/client/profile', () => {
    test('returns client profile with valid token (200)', async () => {
        const res = await request(app)
            .get('/api/client/profile')
            .set('Authorization', `Bearer ${clientToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('profile');
        expect(res.body.profile).toHaveProperty('id');
        expect(res.body.profile).toHaveProperty('full_name');
        expect(res.body.profile).toHaveProperty('email');
        expect(res.body.profile).toHaveProperty('reliability_score');
        expect(res.body.profile.full_name).toBe('Client Test User');
    });

    test('rejects unauthenticated profile request with 401', async () => {
        const res = await request(app)
            .get('/api/client/profile');

        expect(res.status).toBe(401);
    });
});
