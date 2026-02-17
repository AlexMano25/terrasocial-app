const bcrypt = require('bcryptjs');
const { run, get, dbClient } = require('./connection');

function statementsFor(client) {
    if (client === 'postgres') {
        return [
            `CREATE TABLE IF NOT EXISTS users (
                id BIGSERIAL PRIMARY KEY,
                role TEXT NOT NULL CHECK(role IN ('client', 'owner', 'admin')),
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT,
                city TEXT,
                password_hash TEXT NOT NULL,
                reliability_score INTEGER DEFAULT 100,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `CREATE TABLE IF NOT EXISTS reservations (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(id),
                lot_type TEXT,
                lot_price INTEGER,
                duration_months INTEGER,
                deposit_amount INTEGER,
                monthly_amount INTEGER,
                source TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `CREATE TABLE IF NOT EXISTS owner_properties (
                id BIGSERIAL PRIMARY KEY,
                owner_id BIGINT NOT NULL REFERENCES users(id),
                property_title TEXT NOT NULL,
                location TEXT NOT NULL,
                size_m2 INTEGER,
                expected_price INTEGER,
                preferred_payment_mode TEXT,
                payment_calendar TEXT,
                status TEXT DEFAULT 'pending_review',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `CREATE TABLE IF NOT EXISTS payments (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id),
                reservation_id BIGINT REFERENCES reservations(id),
                owner_property_id BIGINT REFERENCES owner_properties(id),
                amount INTEGER NOT NULL,
                method TEXT NOT NULL,
                due_date DATE,
                paid_at TIMESTAMPTZ DEFAULT NOW(),
                status TEXT DEFAULT 'paid',
                reference TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS contracts (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id),
                reservation_id BIGINT REFERENCES reservations(id),
                contract_number TEXT NOT NULL,
                contract_type TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                signed_at TIMESTAMPTZ,
                file_url TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `CREATE TABLE IF NOT EXISTS possession_records (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id),
                reservation_id BIGINT REFERENCES reservations(id),
                pv_number TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                issued_at TIMESTAMPTZ,
                file_url TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `CREATE TABLE IF NOT EXISTS documents (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id),
                reservation_id BIGINT REFERENCES reservations(id),
                owner_property_id BIGINT REFERENCES owner_properties(id),
                document_type TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                storage_mode TEXT DEFAULT 'local',
                public_url TEXT,
                uploaded_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id),
                token_hash TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                used_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `CREATE TABLE IF NOT EXISTS audit_logs (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(id),
                action TEXT NOT NULL,
                method TEXT,
                path TEXT,
                ip_address TEXT,
                user_agent TEXT,
                metadata JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )`
        ];
    }

    return [
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL CHECK(role IN ('client', 'owner', 'admin')),
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT,
            city TEXT,
            password_hash TEXT NOT NULL,
            reliability_score INTEGER DEFAULT 100,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            lot_type TEXT,
            lot_price INTEGER,
            duration_months INTEGER,
            deposit_amount INTEGER,
            monthly_amount INTEGER,
            source TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`,
        `CREATE TABLE IF NOT EXISTS owner_properties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            property_title TEXT NOT NULL,
            location TEXT NOT NULL,
            size_m2 INTEGER,
            expected_price INTEGER,
            preferred_payment_mode TEXT,
            payment_calendar TEXT,
            status TEXT DEFAULT 'pending_review',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        )`,
        `CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            reservation_id INTEGER,
            owner_property_id INTEGER,
            amount INTEGER NOT NULL,
            method TEXT NOT NULL,
            due_date TEXT,
            paid_at TEXT DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'paid',
            reference TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(reservation_id) REFERENCES reservations(id),
            FOREIGN KEY(owner_property_id) REFERENCES owner_properties(id)
        )`,
        `CREATE TABLE IF NOT EXISTS contracts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            reservation_id INTEGER,
            contract_number TEXT NOT NULL,
            contract_type TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            signed_at TEXT,
            file_url TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(reservation_id) REFERENCES reservations(id)
        )`,
        `CREATE TABLE IF NOT EXISTS possession_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            reservation_id INTEGER,
            pv_number TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            issued_at TEXT,
            file_url TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(reservation_id) REFERENCES reservations(id)
        )`,
        `CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            reservation_id INTEGER,
            owner_property_id INTEGER,
            document_type TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            storage_mode TEXT DEFAULT 'local',
            public_url TEXT,
            uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(reservation_id) REFERENCES reservations(id),
            FOREIGN KEY(owner_property_id) REFERENCES owner_properties(id)
        )`,
        `CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`,
        `CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            method TEXT,
            path TEXT,
            ip_address TEXT,
            user_agent TEXT,
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`
    ];
}

async function initializeDatabase() {
    const statements = statementsFor(dbClient);
    for (const sql of statements) {
        await run(sql);
    }

    // Backward-compatible schema evolution for existing deployments.
    try {
        await run('ALTER TABLE documents ADD COLUMN storage_mode TEXT DEFAULT \'local\'');
    } catch (error) {
        // Column likely already exists.
    }
    try {
        await run('ALTER TABLE documents ADD COLUMN public_url TEXT');
    } catch (error) {
        // Column likely already exists.
    }

    const admin = await get('SELECT id FROM users WHERE email = ?', ['admin@terrasocial.cm']);
    if (!admin) {
        const passwordHash = await bcrypt.hash('Admin@12345', 10);
        await run(
            'INSERT INTO users(role, full_name, email, password_hash, city, phone) VALUES (?, ?, ?, ?, ?, ?)',
            ['admin', 'Administrateur TERRASOCIAL', 'admin@terrasocial.cm', passwordHash, 'Yaounde', '+237600000000']
        );
    }
}

module.exports = {
    initializeDatabase
};
