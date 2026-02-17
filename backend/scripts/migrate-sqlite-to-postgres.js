const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const sourcePath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'terrasocial.db');
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL (ou SUPABASE_DB_URL) requis');
    process.exit(1);
}

const sqlite = new sqlite3.Database(sourcePath);
const pg = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

const ensureSql = [
    `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role TEXT`,
    `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS full_name TEXT`,
    `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS email TEXT`,
    `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone TEXT`,
    `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS city TEXT`,
    `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_hash TEXT`,
    `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS reliability_score INTEGER DEFAULT 100`,
    `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,

    `ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS user_id BIGINT`,
    `ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS lot_type TEXT`,
    `ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS lot_price INTEGER`,
    `ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS duration_months INTEGER`,
    `ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS deposit_amount INTEGER`,
    `ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS monthly_amount INTEGER`,
    `ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS source TEXT`,
    `ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'`,
    `ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,

    `ALTER TABLE IF EXISTS owner_properties ADD COLUMN IF NOT EXISTS owner_id BIGINT`,
    `ALTER TABLE IF EXISTS owner_properties ADD COLUMN IF NOT EXISTS property_title TEXT`,
    `ALTER TABLE IF EXISTS owner_properties ADD COLUMN IF NOT EXISTS location TEXT`,
    `ALTER TABLE IF EXISTS owner_properties ADD COLUMN IF NOT EXISTS size_m2 INTEGER`,
    `ALTER TABLE IF EXISTS owner_properties ADD COLUMN IF NOT EXISTS expected_price INTEGER`,
    `ALTER TABLE IF EXISTS owner_properties ADD COLUMN IF NOT EXISTS preferred_payment_mode TEXT`,
    `ALTER TABLE IF EXISTS owner_properties ADD COLUMN IF NOT EXISTS payment_calendar TEXT`,
    `ALTER TABLE IF EXISTS owner_properties ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_review'`,
    `ALTER TABLE IF EXISTS owner_properties ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,

    `ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS user_id BIGINT`,
    `ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS reservation_id BIGINT`,
    `ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS owner_property_id BIGINT`,
    `ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS amount INTEGER`,
    `ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS method TEXT`,
    `ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS due_date DATE`,
    `ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid'`,
    `ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS reference TEXT`,

    `ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS user_id BIGINT`,
    `ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS reservation_id BIGINT`,
    `ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS contract_number TEXT`,
    `ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS contract_type TEXT`,
    `ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`,
    `ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ`,
    `ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS file_url TEXT`,
    `ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,

    `ALTER TABLE IF EXISTS possession_records ADD COLUMN IF NOT EXISTS user_id BIGINT`,
    `ALTER TABLE IF EXISTS possession_records ADD COLUMN IF NOT EXISTS reservation_id BIGINT`,
    `ALTER TABLE IF EXISTS possession_records ADD COLUMN IF NOT EXISTS pv_number TEXT`,
    `ALTER TABLE IF EXISTS possession_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'`,
    `ALTER TABLE IF EXISTS possession_records ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ`,
    `ALTER TABLE IF EXISTS possession_records ADD COLUMN IF NOT EXISTS file_url TEXT`,
    `ALTER TABLE IF EXISTS possession_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,

    `ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS user_id BIGINT`,
    `ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS reservation_id BIGINT`,
    `ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS owner_property_id BIGINT`,
    `ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS document_type TEXT`,
    `ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS file_name TEXT`,
    `ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS file_path TEXT`,
    `ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS storage_mode TEXT DEFAULT 'local'`,
    `ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS public_url TEXT`,
    `ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW()`,

    `ALTER TABLE IF EXISTS password_reset_tokens ADD COLUMN IF NOT EXISTS user_id BIGINT`,
    `ALTER TABLE IF EXISTS password_reset_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT`,
    `ALTER TABLE IF EXISTS password_reset_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
    `ALTER TABLE IF EXISTS password_reset_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ`,
    `ALTER TABLE IF EXISTS password_reset_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,

    `ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS user_id BIGINT`,
    `ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS action TEXT`,
    `ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS method TEXT`,
    `ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS path TEXT`,
    `ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT`,
    `ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT`,
    `ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`
];

function sqliteAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        sqlite.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}

async function copyTable(table, columns) {
    const rows = await sqliteAll(`SELECT ${columns.join(', ')} FROM ${table}`);
    if (!rows.length) return 0;

    const client = await pg.connect();
    try {
        await client.query('BEGIN');
        for (const row of rows) {
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = columns.map((c) => row[c]);
            await client.query(
                `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                values
            );
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    return rows.length;
}

async function run() {
    const schemaClient = await pg.connect();
    try {
        for (const sql of ensureSql) {
            await schemaClient.query(sql);
        }
    } finally {
        schemaClient.release();
    }

    const plan = [
        ['users', ['id', 'role', 'full_name', 'email', 'phone', 'city', 'password_hash', 'reliability_score', 'created_at']],
        ['reservations', ['id', 'user_id', 'lot_type', 'lot_price', 'duration_months', 'deposit_amount', 'monthly_amount', 'source', 'status', 'created_at']],
        ['owner_properties', ['id', 'owner_id', 'property_title', 'location', 'size_m2', 'expected_price', 'preferred_payment_mode', 'payment_calendar', 'status', 'created_at']],
        ['payments', ['id', 'user_id', 'reservation_id', 'owner_property_id', 'amount', 'method', 'due_date', 'paid_at', 'status', 'reference']],
        ['contracts', ['id', 'user_id', 'reservation_id', 'contract_number', 'contract_type', 'status', 'signed_at', 'file_url', 'created_at']],
        ['possession_records', ['id', 'user_id', 'reservation_id', 'pv_number', 'status', 'issued_at', 'file_url', 'created_at']],
        ['documents', ['id', 'user_id', 'reservation_id', 'owner_property_id', 'document_type', 'file_name', 'file_path', 'uploaded_at']],
        ['password_reset_tokens', ['id', 'user_id', 'token_hash', 'expires_at', 'used_at', 'created_at']],
        ['audit_logs', ['id', 'user_id', 'action', 'method', 'path', 'ip_address', 'user_agent', 'metadata', 'created_at']]
    ];

    for (const [table, columns] of plan) {
        const count = await copyTable(table, columns);
        // eslint-disable-next-line no-console
        console.log(`${table}: ${count} rows`);
    }

    const client = await pg.connect();
    try {
        await client.query(`SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users), true)`);
        await client.query(`SELECT setval('reservations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM reservations), true)`);
        await client.query(`SELECT setval('owner_properties_id_seq', (SELECT COALESCE(MAX(id), 1) FROM owner_properties), true)`);
        await client.query(`SELECT setval('payments_id_seq', (SELECT COALESCE(MAX(id), 1) FROM payments), true)`);
        await client.query(`SELECT setval('contracts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM contracts), true)`);
        await client.query(`SELECT setval('possession_records_id_seq', (SELECT COALESCE(MAX(id), 1) FROM possession_records), true)`);
        await client.query(`SELECT setval('documents_id_seq', (SELECT COALESCE(MAX(id), 1) FROM documents), true)`);
        await client.query(`SELECT setval('password_reset_tokens_id_seq', (SELECT COALESCE(MAX(id), 1) FROM password_reset_tokens), true)`);
        await client.query(`SELECT setval('audit_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM audit_logs), true)`);
    } finally {
        client.release();
    }

    sqlite.close();
    await pg.end();
    // eslint-disable-next-line no-console
    console.log('Migration complete');
}

run().catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', error);
    sqlite.close();
    await pg.end();
    process.exit(1);
});
