const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const dbClient = (process.env.DB_CLIENT || 'sqlite').trim().toLowerCase();

function replacePlaceholdersForPg(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => {
        index += 1;
        return `$${index}`;
    });
}

function createSqliteAdapter() {
    let sqlite3;
    try {
        sqlite3 = require('sqlite3').verbose();
    } catch (error) {
        throw new Error('sqlite3 n’est pas installé. Utilisez DB_CLIENT=postgres ou installez sqlite3.');
    }

    const dataDir = path.join(__dirname, '..', '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'terrasocial.db');
    const db = new sqlite3.Database(dbPath);

    function run(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function onRun(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    function get(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    }

    function all(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    return {
        client: 'sqlite',
        run,
        get,
        all,
        close: () => new Promise((resolve) => db.close(() => resolve()))
    };
}

function createPostgresAdapter() {
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

    if (!connectionString) {
        throw new Error('DATABASE_URL (ou SUPABASE_DB_URL) requis pour DB_CLIENT=postgres');
    }

    const pool = new Pool({
        connectionString,
        ssl: process.env.PG_SSL === 'disable' ? false : { rejectUnauthorized: false }
    });

    async function run(sql, params = []) {
        let workingSql = sql;
        const isInsert = /^\s*insert\s+/i.test(workingSql);
        const hasReturning = /\breturning\b/i.test(workingSql);
        if (isInsert && !hasReturning) {
            workingSql = `${workingSql.trim()} RETURNING id`;
        }

        const pgSql = replacePlaceholdersForPg(workingSql);
        const client = await pool.connect();
        try {
            const result = await client.query(pgSql, params);
            let id = null;
            if (result.rows && result.rows[0] && Object.prototype.hasOwnProperty.call(result.rows[0], 'id')) {
                id = result.rows[0].id;
            }
            return { id, changes: result.rowCount || 0 };
        } finally {
            client.release();
        }
    }

    async function get(sql, params = []) {
        const pgSql = replacePlaceholdersForPg(sql);
        const result = await pool.query(pgSql, params);
        return result.rows[0] || undefined;
    }

    async function all(sql, params = []) {
        const pgSql = replacePlaceholdersForPg(sql);
        const result = await pool.query(pgSql, params);
        return result.rows;
    }

    return {
        client: 'postgres',
        run,
        get,
        all,
        close: () => pool.end()
    };
}

const adapter = dbClient === 'postgres' ? createPostgresAdapter() : createSqliteAdapter();

module.exports = {
    dbClient: adapter.client,
    run: adapter.run,
    get: adapter.get,
    all: adapter.all,
    close: adapter.close
};
