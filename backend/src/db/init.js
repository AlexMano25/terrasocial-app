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
            `CREATE TABLE IF NOT EXISTS available_lots (
                id BIGSERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                location TEXT NOT NULL,
                size_m2 INTEGER NOT NULL,
                price INTEGER NOT NULL,
                monthly_amount INTEGER,
                duration_months INTEGER,
                icon TEXT DEFAULT '🏡',
                features TEXT DEFAULT '[]',
                status TEXT DEFAULT 'available',
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
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
            )`,
            `CREATE TABLE IF NOT EXISTS super_admins (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
                mfa_secret TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `CREATE TABLE IF NOT EXISTS admin_messages (
                id BIGSERIAL PRIMARY KEY,
                sender_user_id BIGINT NOT NULL REFERENCES users(id),
                target_scope TEXT NOT NULL,
                target_role TEXT,
                target_user_id BIGINT REFERENCES users(id),
                content TEXT NOT NULL,
                channels TEXT NOT NULL,
                status TEXT DEFAULT 'queued',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `CREATE TABLE IF NOT EXISTS roadmap_status (
                id BIGSERIAL PRIMARY KEY,
                version_label TEXT NOT NULL,
                deployment_status TEXT,
                notes TEXT,
                updated_by BIGINT REFERENCES users(id),
                updated_at TIMESTAMPTZ DEFAULT NOW()
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
        `CREATE TABLE IF NOT EXISTS available_lots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            location TEXT NOT NULL,
            size_m2 INTEGER NOT NULL,
            price INTEGER NOT NULL,
            monthly_amount INTEGER,
            duration_months INTEGER,
            icon TEXT DEFAULT '🏡',
            features TEXT DEFAULT '[]',
            status TEXT DEFAULT 'available',
            display_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
        )`,
        `CREATE TABLE IF NOT EXISTS super_admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            mfa_secret TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`,
        `CREATE TABLE IF NOT EXISTS admin_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_user_id INTEGER NOT NULL,
            target_scope TEXT NOT NULL,
            target_role TEXT,
            target_user_id INTEGER,
            content TEXT NOT NULL,
            channels TEXT NOT NULL,
            status TEXT DEFAULT 'queued',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sender_user_id) REFERENCES users(id),
            FOREIGN KEY(target_user_id) REFERENCES users(id)
        )`,
        `CREATE TABLE IF NOT EXISTS roadmap_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version_label TEXT NOT NULL,
            deployment_status TEXT,
            notes TEXT,
            updated_by INTEGER,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(updated_by) REFERENCES users(id)
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

    // Super admin bootstrap account requested by product spec.
    let superAdminUser = await get('SELECT id FROM users WHERE email = ?', ['admin@system.com']);
    if (!superAdminUser) {
        const passwordHash = await bcrypt.hash('Admin@System#2026', 12);
        const created = await run(
            'INSERT INTO users(role, full_name, email, password_hash, city, phone) VALUES (?, ?, ?, ?, ?, ?)',
            ['admin', 'Super Admin System', 'admin@system.com', passwordHash, 'Yaounde', '+237600000001']
        );
        superAdminUser = { id: created.id };
    }

    const superAdminEntry = await get('SELECT id FROM super_admins WHERE user_id = ?', [superAdminUser.id]);
    if (!superAdminEntry) {
        await run(
            'INSERT INTO super_admins(user_id, mfa_secret, is_active) VALUES (?, ?, ?)',
            [superAdminUser.id, `mfa_${Date.now()}_${superAdminUser.id}`, 1]
        );
    }

    const roadmap = await get('SELECT id FROM roadmap_status ORDER BY id DESC LIMIT 1');
    if (!roadmap) {
        await run(
            'INSERT INTO roadmap_status(version_label, deployment_status, notes, updated_by) VALUES (?, ?, ?, ?)',
            ['v1.2.0-stable', 'operational', 'Initialisation du module Super Admin Dashboard Pro.', superAdminUser.id]
        );
    }

    const lotsCount = await get('SELECT COUNT(*) AS total FROM available_lots');
    if (Number(lotsCount?.total || 0) === 0) {
        const defaultLots = [
            ['Lot Standard - 500m²', 'Soa, Yaoundé', 500, 500000, 21000, 24, '🏡', JSON.stringify(['Titre foncier sécurisé', 'Accès route praticable', 'Électricité à proximité', 'Bornage inclus']), 'available', 1],
            ['Lot Confort - 750m²', 'Nkolfoulou, Yaoundé', 750, 750000, 25000, 30, '🏠', JSON.stringify(['Titre foncier sécurisé', 'Accès goudronné', 'Eau et électricité', 'Bornage et plan inclus']), 'available', 2],
            ['Lot Premium - 1000m²', 'Mbankomo, Yaoundé', 1000, 1000000, 28000, 36, '🏘️', JSON.stringify(['Titre foncier garanti', 'Zone viabilisée', 'Tous réseaux disponibles', 'Accompagnement complet']), 'available', 3]
        ];

        for (const lot of defaultLots) {
            await run(
                `INSERT INTO available_lots(title, location, size_m2, price, monthly_amount, duration_months, icon, features, status, display_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                lot
            );
        }
    }
}

module.exports = {
    initializeDatabase
};
