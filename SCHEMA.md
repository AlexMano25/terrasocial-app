# TERRASOCIAL Database Schema Documentation

The application supports both PostgreSQL (production) and SQLite (development). Schema definitions are in `backend/src/db/init.js`.

---

## Table of Contents

1. [users](#1-users)
2. [reservations](#2-reservations)
3. [owner_properties](#3-owner_properties)
4. [payments](#4-payments)
5. [contracts](#5-contracts)
6. [possession_records](#6-possession_records)
7. [documents](#7-documents)
8. [available_lots](#8-available_lots)
9. [password_reset_tokens](#9-password_reset_tokens)
10. [audit_logs](#10-audit_logs)
11. [super_admins](#11-super_admins)
12. [manager_admins](#12-manager_admins)
13. [admin_messages](#13-admin_messages)
14. [roadmap_status](#14-roadmap_status)
15. [agents](#15-agents) (referenced in code, schema managed externally)
16. [referrals](#16-referrals) (referenced in code, schema managed externally)
17. [agent_commissions](#17-agent_commissions) (referenced in code, schema managed externally)
18. [promo_codes](#18-promo_codes) (referenced in code, schema managed externally)
19. [Entity Relationship Diagram](#entity-relationship-diagram)

---

## 1. users

Central user table for all roles (client, owner, admin).

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Unique user ID |
| role | TEXT | TEXT | NOT NULL, CHECK(IN ('client','owner','admin')) | - | User role |
| full_name | TEXT | TEXT | NOT NULL | - | Full name |
| email | TEXT | TEXT | UNIQUE (nullable since v1.3) | - | Email address |
| phone | TEXT | TEXT | | NULL | Phone number |
| city | TEXT | TEXT | | NULL | City of residence |
| password_hash | TEXT | TEXT | NOT NULL | - | Bcrypt hashed password |
| google_id | TEXT | TEXT | | NULL | Google OAuth subject ID (added v1.3) |
| reliability_score | INTEGER | INTEGER | | 100 | Payment reliability score (0-100) |
| created_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Account creation timestamp |

**Notes:**
- Email was originally NOT NULL UNIQUE; made nullable in v1.3 to support phone-only registration.
- `google_id` column added in v1.3 for Google OAuth support.
- Three bootstrap accounts are created on initialization: admin@terrasocial.cm (admin), admin@system.com (super admin), manager@terrasocial.cm (manager).

---

## 2. reservations

Tracks lot reservations by clients (including public leads without accounts).

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Reservation ID |
| user_id | BIGINT | INTEGER | REFERENCES users(id), nullable | NULL | Associated user (NULL for leads) |
| lot_type | TEXT | TEXT | | NULL | starter, standard, confort, premium |
| lot_price | INTEGER | INTEGER | | NULL | Total lot price in FCFA |
| duration_months | INTEGER | INTEGER | | NULL | Payment duration in months |
| deposit_amount | INTEGER | INTEGER | | NULL | Deposit amount (10% of price) |
| monthly_amount | INTEGER | INTEGER | | NULL | Monthly payment amount |
| source | TEXT | TEXT | | NULL | Referral source |
| status | TEXT | TEXT | | 'pending' | lead, pending, active, completed, cancelled |
| insurance_persons | INTEGER | INTEGER | | 0 | Number of insured persons (v1.4) |
| daily_amount | INTEGER | INTEGER | | 1500 | Daily minimum payment in FCFA (v1.4) |
| lot_size_m2 | INTEGER | INTEGER | | 200 | Lot size in square meters (v1.4) |
| payment_frequency | TEXT | TEXT | | 'quotidien' | Payment frequency (v1.5) |
| price_per_m2 | INTEGER | INTEGER | | 200 | Price per square meter (v1.5) |
| lead_name | TEXT | TEXT | | NULL | Lead contact name (v1.6) |
| lead_phone | TEXT | TEXT | | NULL | Lead contact phone (v1.6) |
| lead_email | TEXT | TEXT | | NULL | Lead contact email (v1.6) |
| lead_city | TEXT | TEXT | | NULL | Lead contact city (v1.6) |
| created_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Creation timestamp |

**Notes:**
- Columns `insurance_persons`, `daily_amount`, `lot_size_m2` added in v1.4 (Starter model).
- Columns `payment_frequency`, `price_per_m2` added in v1.5.
- Lead columns (`lead_name`, `lead_phone`, `lead_email`, `lead_city`) added in v1.6 for public form reservations without user accounts.

---

## 3. owner_properties

Properties listed by property owners for sale through the platform.

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Property ID |
| owner_id | BIGINT | INTEGER | NOT NULL, REFERENCES users(id) | - | Owner user ID |
| property_title | TEXT | TEXT | NOT NULL | - | Property title |
| location | TEXT | TEXT | NOT NULL | - | Property location |
| size_m2 | INTEGER | INTEGER | | NULL | Size in square meters |
| expected_price | INTEGER | INTEGER | | NULL | Expected price in FCFA |
| preferred_payment_mode | TEXT | TEXT | | NULL | Preferred payment mode |
| payment_calendar | TEXT | TEXT | | NULL | Payment calendar preference |
| status | TEXT | TEXT | | 'pending_review' | Review status |
| created_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Creation timestamp |

---

## 4. payments

All payment transactions across the platform.

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Payment ID |
| user_id | BIGINT | INTEGER | NOT NULL, REFERENCES users(id) | - | Payer user ID |
| reservation_id | BIGINT | INTEGER | REFERENCES reservations(id) | NULL | Associated reservation |
| owner_property_id | BIGINT | INTEGER | REFERENCES owner_properties(id) | NULL | Associated owner property |
| amount | INTEGER | INTEGER | NOT NULL | - | Payment amount in FCFA |
| method | TEXT | TEXT | NOT NULL | - | Payment method (orange_money, mtn_momo, virement, carte) |
| due_date | DATE | TEXT | | NULL | Payment due date |
| paid_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Actual payment timestamp |
| status | TEXT | TEXT | | 'paid' | paid, pending, late |
| reference | TEXT | TEXT | | NULL | Transaction reference (TRX-XXXXXXXX) |

---

## 5. contracts

Contracts generated for validated reservations.

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Contract ID |
| user_id | BIGINT | INTEGER | NOT NULL, REFERENCES users(id) | - | Client user ID |
| reservation_id | BIGINT | INTEGER | REFERENCES reservations(id) | NULL | Associated reservation |
| contract_number | TEXT | TEXT | NOT NULL | - | Contract number (TS-CTR-XXXXX-YYYY) |
| contract_type | TEXT | TEXT | NOT NULL | - | Contract type (reservation) |
| status | TEXT | TEXT | | 'active' | draft, active, sent, signed |
| signed_at | TIMESTAMPTZ | TEXT | | NULL | Signature timestamp |
| file_url | TEXT | TEXT | | NULL | URL to contract file |
| created_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Creation timestamp |

---

## 6. possession_records

Records of provisional possession (issued at 50% payment).

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Record ID |
| user_id | BIGINT | INTEGER | NOT NULL, REFERENCES users(id) | - | Client user ID |
| reservation_id | BIGINT | INTEGER | REFERENCES reservations(id) | NULL | Associated reservation |
| pv_number | TEXT | TEXT | NOT NULL | - | Possession record number |
| status | TEXT | TEXT | | 'pending' | Status |
| issued_at | TIMESTAMPTZ | TEXT | | NULL | Issue date |
| file_url | TEXT | TEXT | | NULL | URL to PV file |
| created_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Creation timestamp |

---

## 7. documents

Uploaded documents (CNI, land titles, etc.) stored locally or on Supabase.

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Document ID |
| user_id | BIGINT | INTEGER | NOT NULL, REFERENCES users(id) | - | Uploader user ID |
| reservation_id | BIGINT | INTEGER | REFERENCES reservations(id) | NULL | Associated reservation |
| owner_property_id | BIGINT | INTEGER | REFERENCES owner_properties(id) | NULL | Associated owner property |
| document_type | TEXT | TEXT | NOT NULL | - | Document type (cni, titre_foncier, etc.) |
| file_name | TEXT | TEXT | NOT NULL | - | Original file name |
| file_path | TEXT | TEXT | NOT NULL | - | Storage file path |
| storage_mode | TEXT | TEXT | | 'local' | Storage backend: local or supabase |
| public_url | TEXT | TEXT | | NULL | Public URL (for Supabase storage) |
| uploaded_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Upload timestamp |

**Notes:**
- `storage_mode` and `public_url` columns were added via ALTER TABLE for backward compatibility.

---

## 8. available_lots

Catalog of lots available for purchase on the platform.

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Lot ID |
| title | TEXT | TEXT | NOT NULL | - | Lot title/name |
| location | TEXT | TEXT | NOT NULL | - | Location description |
| size_m2 | INTEGER | INTEGER | NOT NULL | - | Lot size in m2 |
| price | INTEGER | INTEGER | NOT NULL | - | Price in FCFA |
| monthly_amount | INTEGER | INTEGER | | NULL | Suggested monthly payment |
| duration_months | INTEGER | INTEGER | | NULL | Suggested payment duration |
| icon | TEXT | TEXT | | '(house emoji)' | Display icon |
| features | TEXT | TEXT | | '[]' | JSON array of feature strings |
| status | TEXT | TEXT | | 'available' | available, reserved, archived |
| display_order | INTEGER | INTEGER | | 0 | Display ordering |
| created_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Last update timestamp |

**Notes:**
- Three default lots are seeded on initialization if the table is empty.

---

## 9. password_reset_tokens

Stores hashed password reset tokens with expiration.

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Token ID |
| user_id | BIGINT | INTEGER | NOT NULL, REFERENCES users(id) | - | User requesting reset |
| token_hash | TEXT | TEXT | NOT NULL | - | SHA-256 hash of the reset token |
| expires_at | TIMESTAMPTZ | TEXT | NOT NULL | - | Token expiration (30 min after creation) |
| used_at | TIMESTAMPTZ | TEXT | | NULL | Timestamp when token was used |
| created_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Creation timestamp |

---

## 10. audit_logs

Tracks all significant actions performed on the platform.

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Log entry ID |
| user_id | BIGINT | INTEGER | REFERENCES users(id) | NULL | Actor user ID |
| action | TEXT | TEXT | NOT NULL | - | Action identifier (e.g., auth.login_success) |
| method | TEXT | TEXT | | NULL | HTTP method |
| path | TEXT | TEXT | | NULL | Request path |
| ip_address | TEXT | TEXT | | NULL | Client IP address |
| user_agent | TEXT | TEXT | | NULL | Client user agent |
| metadata | JSONB | TEXT | | NULL | Additional JSON metadata |
| created_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Log timestamp |

---

## 11. super_admins

Identifies users with super admin privileges.

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Entry ID |
| user_id | BIGINT | INTEGER | NOT NULL, UNIQUE, REFERENCES users(id) | - | User ID |
| mfa_secret | TEXT | TEXT | | NULL | MFA secret key |
| is_active | BOOLEAN | INTEGER | | TRUE / 1 | Whether super admin is active |
| created_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Creation timestamp |

**Notes:**
- A bootstrap super admin account (admin@system.com) is created on initialization.

---

## 12. manager_admins

Identifies users with limited manager/administrator privileges (added v1.3).

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Entry ID |
| user_id | BIGINT | INTEGER | NOT NULL, UNIQUE, REFERENCES users(id) | - | User ID |
| is_active | BOOLEAN | INTEGER | | TRUE / 1 | Whether manager is active |
| created_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Creation timestamp |

**Notes:**
- A bootstrap manager account (manager@terrasocial.cm) is created on initialization.

---

## 13. admin_messages

Messages and notifications sent by admins to users.

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Message ID |
| sender_user_id | BIGINT | INTEGER | NOT NULL, REFERENCES users(id) | - | Sender admin user ID |
| target_scope | TEXT | TEXT | NOT NULL | - | all, role, user |
| target_role | TEXT | TEXT | | NULL | Target role (when scope = role) |
| target_user_id | BIGINT | INTEGER | REFERENCES users(id) | NULL | Target user (when scope = user) |
| content | TEXT | TEXT | NOT NULL | - | Message content |
| channels | TEXT | TEXT | NOT NULL | - | Delivery channels (comma-separated: in_app, email) |
| status | TEXT | TEXT | | 'queued' | queued, sending, sent, partial |
| created_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Creation timestamp |

---

## 14. roadmap_status

Tracks platform version and deployment status.

| Column | Type (PG) | Type (SQLite) | Constraints | Default | Description |
|--------|-----------|---------------|-------------|---------|-------------|
| id | BIGSERIAL | INTEGER AUTOINCREMENT | PRIMARY KEY | auto | Entry ID |
| version_label | TEXT | TEXT | NOT NULL | - | Version label (e.g., v1.2.0-stable) |
| deployment_status | TEXT | TEXT | | NULL | Deployment status (operational, etc.) |
| notes | TEXT | TEXT | | NULL | Release notes |
| updated_by | BIGINT | INTEGER | REFERENCES users(id) | NULL | User who updated |
| updated_at | TIMESTAMPTZ | TEXT | | NOW() / CURRENT_TIMESTAMP | Update timestamp |

---

## 15. agents

Agent/partner accounts. Referenced in route code but schema is managed externally (not defined in init.js).

**Inferred schema from usage in code:**

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER/BIGINT | Agent record ID (PK) |
| user_id | INTEGER/BIGINT | REFERENCES users(id) |
| agent_code | TEXT | Unique agent code (e.g., AG-XXX-12345) |
| status | TEXT | pending, active, rejected, suspended |
| is_active | BOOLEAN | Whether agent is currently active |
| company_name | TEXT | Agent company name |
| motivation | TEXT | Partnership motivation text |
| commission_rate | NUMERIC | Commission rate |
| orange_money | TEXT | Orange Money account number |
| mtn_momo | TEXT | MTN MoMo account number |
| bank_name | TEXT | Bank name |
| bank_account | TEXT | Bank account number |
| approved_at | TIMESTAMP | Approval timestamp |
| approved_by | INTEGER/BIGINT | Approver user ID |
| created_at | TIMESTAMP | Creation timestamp |

---

## 16. referrals

Tracks agent referrals. Referenced in code but schema managed externally.

**Inferred schema from usage:**

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER/BIGINT | Referral ID (PK) |
| agent_id | INTEGER/BIGINT | REFERENCES agents(id) |
| referred_user_id | INTEGER/BIGINT | REFERENCES users(id) |
| referred_type | TEXT | client, owner |
| created_at | TIMESTAMP | Creation timestamp |

---

## 17. agent_commissions

Tracks commissions earned by agents. Referenced in code but schema managed externally.

**Inferred schema from usage:**

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER/BIGINT | Commission ID (PK) |
| agent_id | INTEGER/BIGINT | REFERENCES agents(id) |
| amount | INTEGER | Commission amount in FCFA |
| status | TEXT | pending, paid |
| created_at | TIMESTAMP | Creation timestamp |

---

## 18. promo_codes

Promotional codes created by agents. Referenced in code but schema managed externally.

**Inferred schema from usage:**

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER/BIGINT | Promo code ID (PK) |
| agent_id | INTEGER/BIGINT | REFERENCES agents(id) |
| code | TEXT | Promo code string (UNIQUE) |
| description | TEXT | Description |
| max_uses | INTEGER | Maximum usage count (NULL = unlimited) |
| usage_count | INTEGER | Current usage count |
| is_active | BOOLEAN | Whether code is active |
| expires_at | TIMESTAMP | Expiration date |
| created_at | TIMESTAMP | Creation timestamp |

---

## Entity Relationship Diagram

```
users (id PK)
  |-- role: client | owner | admin
  |
  |--< reservations (user_id FK -> users.id)
  |     |--< payments (reservation_id FK -> reservations.id)
  |     |--< contracts (reservation_id FK -> reservations.id)
  |     |--< possession_records (reservation_id FK -> reservations.id)
  |     |--< documents (reservation_id FK -> reservations.id)
  |
  |--< owner_properties (owner_id FK -> users.id)
  |     |--< payments (owner_property_id FK -> owner_properties.id)
  |     |--< documents (owner_property_id FK -> owner_properties.id)
  |
  |--< payments (user_id FK -> users.id)
  |--< documents (user_id FK -> users.id)
  |--< contracts (user_id FK -> users.id)
  |--< possession_records (user_id FK -> users.id)
  |--< password_reset_tokens (user_id FK -> users.id)
  |--< audit_logs (user_id FK -> users.id)
  |--< admin_messages (sender_user_id FK -> users.id)
  |--< admin_messages (target_user_id FK -> users.id)
  |
  |--1 super_admins (user_id FK UNIQUE -> users.id)
  |--1 manager_admins (user_id FK UNIQUE -> users.id)
  |--1 agents (user_id FK -> users.id)
  |     |--< referrals (agent_id FK -> agents.id)
  |     |--< agent_commissions (agent_id FK -> agents.id)
  |     |--< promo_codes (agent_id FK -> agents.id)
  |
  |--< roadmap_status (updated_by FK -> users.id)

available_lots (standalone catalog table)
```

---

## Schema Evolution History

| Version | Changes |
|---------|---------|
| v1.0 | Initial schema: users, reservations, owner_properties, payments, contracts, possession_records, documents, available_lots, password_reset_tokens, audit_logs, super_admins, admin_messages, roadmap_status |
| v1.3 | Added `google_id` to users. Made `email` nullable on users. Added `manager_admins` table. Bootstrap manager account. |
| v1.4 | Added `insurance_persons`, `daily_amount`, `lot_size_m2` to reservations (Starter model). |
| v1.5 | Added `payment_frequency`, `price_per_m2` to reservations. |
| v1.6 | Added lead columns (`lead_name`, `lead_phone`, `lead_email`, `lead_city`) to reservations. |
| - | `storage_mode` and `public_url` added to documents for Supabase storage support. |
