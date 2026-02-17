CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    role TEXT NOT NULL CHECK(role IN ('client', 'owner', 'admin')),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    city TEXT,
    password_hash TEXT NOT NULL,
    reliability_score INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
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
);

CREATE TABLE IF NOT EXISTS owner_properties (
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
);

CREATE TABLE IF NOT EXISTS payments (
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
);

CREATE TABLE IF NOT EXISTS contracts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    reservation_id BIGINT REFERENCES reservations(id),
    contract_number TEXT NOT NULL,
    contract_type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    signed_at TIMESTAMPTZ,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS possession_records (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    reservation_id BIGINT REFERENCES reservations(id),
    pv_number TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    issued_at TIMESTAMPTZ,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
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
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action TEXT NOT NULL,
    method TEXT,
    path TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
