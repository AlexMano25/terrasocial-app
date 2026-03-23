/**
 * TERRASOCIAL — Seed test data
 * Run: node -r dotenv/config scripts/seed-test-data.js dotenv_config_path=.env
 */
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { run, get, all } = require('../src/db/connection');
const { initializeDatabase } = require('../src/db/init');

const CITIES = ['Yaounde', 'Douala', 'Bafoussam', 'Garoua', 'Bamenda', 'Maroua', 'Bertoua', 'Ngaoundere', 'Ebolowa', 'Kribi'];
const FIRST_NAMES = ['Jean', 'Pierre', 'Marie', 'Paul', 'Francoise', 'Emmanuel', 'Beatrice', 'Patrick', 'Sylvie', 'Georges', 'Aline', 'David', 'Therese', 'Andre', 'Claudine', 'Joseph', 'Rose', 'Michel', 'Agnes', 'Robert'];
const LAST_NAMES = ['Nkomo', 'Atangana', 'Mbarga', 'Fouda', 'Essomba', 'Ndjock', 'Biya', 'Owona', 'Messi', 'Tchamba', 'Nganou', 'Kamga', 'Dongmo', 'Tagne', 'Fotso', 'Njoya', 'Simo', 'Kouam', 'Wamba', 'Ekani'];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomPhone() { return '+2376' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0'); }
function randomDate(monthsBack) {
    const d = new Date();
    d.setMonth(d.getMonth() - Math.floor(Math.random() * monthsBack));
    d.setDate(Math.floor(Math.random() * 28) + 1);
    return d.toISOString();
}

async function seed() {
    await initializeDatabase();
    console.log('Database initialized.');

    const passwordHash = await bcrypt.hash('TestSecure1!', 10);

    // ═══════════════════════════════════════════════════════════════════
    // 1. CREATE INSURER: "Assurance Masseu"
    // ═══════════════════════════════════════════════════════════════════
    let insurerUser = await get("SELECT id FROM users WHERE email = ?", ['masseu@assurance.cm']);
    if (!insurerUser) {
        insurerUser = await run(
            "INSERT INTO users(role, full_name, email, phone, password_hash, city) VALUES (?, ?, ?, ?, ?, ?)",
            ['insurer', 'Assurance Masseu', 'masseu@assurance.cm', '+237699000000', passwordHash, 'Yaounde']
        );
        console.log('Created insurer user:', insurerUser.id);
    }

    let insurer = await get("SELECT id FROM insurers WHERE user_id = ?", [insurerUser.id]);
    if (!insurer) {
        insurer = await run(
            "INSERT INTO insurers(user_id, company_name, license_number, daily_premium_cost, phone, email) VALUES (?, ?, ?, ?, ?, ?)",
            [insurerUser.id, 'Assurance Masseu', 'LIC-CM-2026-001', 150, '+237699000000', 'contact@assurance-masseu.cm']
        );
        console.log('Created insurer profile:', insurer.id);
    }

    // Add partner hospitals
    const hospitals = [
        { name: 'Hopital Central de Yaounde', city: 'Yaounde', address: 'Quartier Melen', phone: '+237222234567', specialty: 'Generaliste' },
        { name: 'Clinique La Cathedrale', city: 'Douala', address: 'Rue Joss', phone: '+237233456789', specialty: 'Generaliste' },
        { name: 'Centre Medical de Bafoussam', city: 'Bafoussam', address: 'Quartier Commercial', phone: '+237244567890', specialty: 'Generaliste' },
        { name: 'Hopital Laquintinie', city: 'Douala', address: 'Boulevard de la Liberte', phone: '+237233567890', specialty: 'Urgences' },
        { name: 'Clinique Fouda', city: 'Yaounde', address: 'Quartier Fouda', phone: '+237222345678', specialty: 'Pediatrie' }
    ];
    for (const h of hospitals) {
        const exists = await get("SELECT id FROM insurer_hospitals WHERE insurer_id = ? AND name = ?", [insurer.id, h.name]);
        if (!exists) {
            await run(
                "INSERT INTO insurer_hospitals(insurer_id, name, city, address, phone, specialty) VALUES (?, ?, ?, ?, ?, ?)",
                [insurer.id, h.name, h.city, h.address, h.phone, h.specialty]
            );
        }
    }
    console.log('Hospitals seeded.');

    // Create 40 insured client accounts
    const lotTypes = ['starter', 'standard', 'confort', 'premium'];
    const lotPrices = { starter: 300000, standard: 1300000, confort: 6375000, premium: 10000000 };
    const lotSizes = { starter: 100, standard: 200, confort: 400, premium: 500 };
    const durations = [12, 24, 36];

    for (let i = 1; i <= 40; i++) {
        const firstName = randomFrom(FIRST_NAMES);
        const lastName = randomFrom(LAST_NAMES);
        const fullName = firstName + ' ' + lastName;
        const email = firstName.toLowerCase() + '.' + lastName.toLowerCase() + i + '@test.cm';
        const phone = randomPhone();
        const city = randomFrom(CITIES);
        const lotType = randomFrom(lotTypes);

        // Check if user already exists
        let user = await get("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) {
            user = await run(
                "INSERT INTO users(role, full_name, email, phone, password_hash, city) VALUES (?, ?, ?, ?, ?, ?)",
                ['client', fullName, email, phone, passwordHash, city]
            );
        }

        // Create reservation
        let reservation = await get("SELECT id FROM reservations WHERE user_id = ?", [user.id]);
        if (!reservation) {
            const duration = randomFrom(durations);
            const price = lotPrices[lotType];
            const monthly = Math.round(price / duration);
            const daily = Math.round(monthly / 30);
            const insurancePersons = Math.floor(Math.random() * 3) + 1; // 1-3 persons

            reservation = await run(
                `INSERT INTO reservations(user_id, lot_type, lot_price, lot_size_m2, duration_months, monthly_amount, daily_amount, insurance_persons, status, insurer_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
                [user.id, lotType, price, lotSizes[lotType], duration, monthly, daily, insurancePersons, insurer.id, randomDate(6)]
            );
        }

        // Create insured persons
        const personCount = Math.floor(Math.random() * 3) + 1;
        for (let p = 0; p < personCount; p++) {
            const personName = p === 0 ? fullName : randomFrom(FIRST_NAMES) + ' ' + lastName;
            const exists = await get(
                "SELECT id FROM insured_persons_details WHERE reservation_id = ? AND full_name = ?",
                [reservation.id, personName]
            );
            if (!exists) {
                const birthYear = 1960 + Math.floor(Math.random() * 40);
                const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
                const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');

                await run(
                    `INSERT INTO insured_persons_details(reservation_id, user_id, insurer_id, full_name, date_of_birth, phone, is_active, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
                    [reservation.id, user.id, insurer.id, personName, `${birthYear}-${birthMonth}-${birthDay}`, phone, randomDate(6)]
                );
            }
        }

        if (i % 10 === 0) console.log(`Seeded ${i}/40 insured clients...`);
    }
    console.log('40 insured clients seeded.');

    // ═══════════════════════════════════════════════════════════════════
    // 2. CREATE AGENT with 3 referred clients
    // ═══════════════════════════════════════════════════════════════════
    let agentUser = await get("SELECT id FROM users WHERE email = ?", ['agent.test@terrasocial.cm']);
    if (!agentUser) {
        agentUser = await run(
            "INSERT INTO users(role, full_name, email, phone, password_hash, city) VALUES (?, ?, ?, ?, ?, ?)",
            ['client', 'Jean-Marc Kamga', 'agent.test@terrasocial.cm', '+237677111111', passwordHash, 'Douala']
        );
    }

    let agent = await get("SELECT id FROM agents WHERE user_id = ?", [agentUser.id]);
    if (!agent) {
        const crypto = require('crypto');
        const agentCode = 'AGNT-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        agent = await run(
            "INSERT INTO agents(user_id, agent_code, company_name, phone, email, status, is_active, commission_rate) VALUES (?, ?, ?, ?, ?, 'active', TRUE, 5.00)",
            [agentUser.id, agentCode, 'Kamga Immobilier', '+237677111111', 'agent.test@terrasocial.cm']
        );
        console.log('Created agent:', agentCode);
    }

    // Create 3 referred clients for the agent
    const referredClients = [
        { name: 'Alice Mbarga', email: 'alice.mbarga@test.cm', phone: '+237677222222', city: 'Douala' },
        { name: 'Bruno Fouda', email: 'bruno.fouda@test.cm', phone: '+237677333333', city: 'Yaounde' },
        { name: 'Claire Essomba', email: 'claire.essomba@test.cm', phone: '+237677444444', city: 'Douala' }
    ];

    for (const rc of referredClients) {
        let refUser = await get("SELECT id FROM users WHERE email = ?", [rc.email]);
        if (!refUser) {
            refUser = await run(
                "INSERT INTO users(role, full_name, email, phone, password_hash, city) VALUES (?, ?, ?, ?, ?, ?)",
                ['client', rc.name, rc.email, rc.phone, passwordHash, rc.city]
            );
        }

        // Create referral
        const refExists = await get("SELECT id FROM referrals WHERE agent_id = ? AND referred_user_id = ?", [agent.id, refUser.id]);
        if (!refExists) {
            await run(
                "INSERT INTO referrals(agent_id, referred_user_id, referred_type, status) VALUES (?, ?, 'client', 'active')",
                [agent.id, refUser.id]
            );
        }

        // Create a reservation for each referred client
        let res = await get("SELECT id FROM reservations WHERE user_id = ?", [refUser.id]);
        if (!res) {
            res = await run(
                `INSERT INTO reservations(user_id, lot_type, lot_price, lot_size_m2, duration_months, monthly_amount, daily_amount, insurance_persons, status, created_at)
                 VALUES (?, 'standard', 1300000, 200, 24, 54167, 1806, 1, 'active', ?)`,
                [refUser.id, randomDate(3)]
            );
        }

        // Create a test payment and commission
        const paymentExists = await get("SELECT id FROM payments WHERE user_id = ? AND status = 'paid'", [refUser.id]);
        if (!paymentExists) {
            const payment = await run(
                "INSERT INTO payments(user_id, reservation_id, amount, method, status, paid_at, reference) VALUES (?, ?, 54167, 'orange_money', 'paid', CURRENT_TIMESTAMP, ?)",
                [refUser.id, res.id, 'REF-TEST-' + refUser.id]
            );
            // Create commission
            const commExists = await get("SELECT id FROM agent_commissions WHERE agent_id = ? AND payment_id = ?", [agent.id, payment.id]);
            if (!commExists) {
                const rate = 2; // 3 referrals = 2%
                const commAmount = Math.round(54167 * rate / 100);
                await run(
                    "INSERT INTO agent_commissions(agent_id, payment_id, amount, rate_percent, status) VALUES (?, ?, ?, ?, 'pending')",
                    [agent.id, payment.id, commAmount, rate]
                );
            }
        }
    }
    console.log('Agent with 3 referrals seeded.');

    console.log('\n=== SEED COMPLETE ===');
    console.log('Insurer login: masseu@assurance.cm / TestSecure1!');
    console.log('Agent login:   agent.test@terrasocial.cm / TestSecure1!');
    console.log('Prime journaliere assureur: 150 FCFA/personne/jour');
    process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
