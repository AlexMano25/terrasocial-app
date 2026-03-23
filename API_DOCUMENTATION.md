# TERRASOCIAL API Documentation

Base URL: `/api`

---

## Table of Contents

1. [Authentication (`/api/auth`)](#1-authentication-apiauth)
2. [Public (`/api/public`)](#2-public-apipublic)
3. [Client (`/api/client`)](#3-client-apiclient)
4. [Owner (`/api/owner`)](#4-owner-apiowner)
5. [Payments (`/api/payments`)](#5-payments-apipayments)
6. [Documents (`/api/documents`)](#6-documents-apidocuments)
7. [Manager (`/api/manager`)](#7-manager-apimanager)
8. [Super Admin (`/api/super-admin`)](#8-super-admin-apisuper-admin)
9. [Agent (`/api/agent`)](#9-agent-apiagent)
10. [Webhooks (`/api/webhooks`)](#10-webhooks-apiwebhooks)

---

## 1. Authentication (`/api/auth`)

Rate-limited. No authentication required for registration/login endpoints.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register/client` | No | Register a new client account |
| POST | `/api/auth/register/owner` | No | Register a new owner account |
| POST | `/api/auth/login` | No | Login with email/phone + password |
| POST | `/api/auth/request-password-reset` | No | Request a password reset token |
| POST | `/api/auth/reset-password` | No | Reset password using token |
| GET | `/api/auth/me` | Yes (any role) | Get current authenticated user |
| GET | `/api/auth/google` | No | Initiate Google OAuth flow |
| GET | `/api/auth/google/callback` | No | Google OAuth callback (redirects to frontend) |

### POST `/api/auth/register/client`

Register a new client account.

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| full_name | string | Yes | Full name (max 120 chars) |
| email | string | Conditional | Email (required if no valid phone) |
| phone | string | Conditional | Phone number (required if no valid email) |
| city | string | No | City (max 80 chars) |
| password | string | Yes | Password (10+ chars, uppercase, lowercase, digit, special) |

**Response (201):**
```json
{
  "token": "jwt_token",
  "user": { "id": 1, "role": "client", "full_name": "...", "email": "...", "phone": "..." }
}
```

### POST `/api/auth/register/owner`

Same parameters and response as `/register/client` but creates an owner account.

### POST `/api/auth/login`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| identifier | string | Yes* | Email or phone number |
| email | string | No | Alternative to identifier |
| phone | string | No | Alternative to identifier |
| password | string | Yes | Password |

*At least one of `identifier`, `email`, or `phone` is required.

**Response (200):**
```json
{
  "token": "jwt_token",
  "user": {
    "id": 1, "role": "client", "full_name": "...", "email": "...", "phone": "...",
    "reliability_score": 100, "is_super_admin": false, "is_manager": false,
    "is_agent": false, "agent_code": null
  }
}
```

### POST `/api/auth/request-password-reset`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| identifier | string | Yes | Email or phone number |

**Response (200):**
```json
{
  "message": "Si ce compte existe, un lien de reinitialisation a ete genere.",
  "debug_reset_token": "..."
}
```
Note: `debug_reset_token` only returned in non-production environments.

### POST `/api/auth/reset-password`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | Yes | Reset token received from request-password-reset |
| new_password | string | Yes | New password (10+ chars, strong password rules) |

**Response (200):**
```json
{ "message": "Mot de passe reinitialise avec succes" }
```

### GET `/api/auth/me`

**Headers:** `Authorization: Bearer <jwt_token>`

**Response (200):**
```json
{
  "user": {
    "id": 1, "role": "client", "full_name": "...", "email": "...",
    "is_super_admin": false, "is_manager": false, "is_agent": false, "agent_code": null
  }
}
```

### GET `/api/auth/google`

Redirects user to Google OAuth consent screen. Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables.

### GET `/api/auth/google/callback`

Handles Google OAuth callback. Creates or links Google account, then redirects to `/login.html` with JWT token and user data in URL fragment.

---

## 2. Public (`/api/public`)

No authentication required.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/public/lots` | No | List available lots |
| POST | `/api/public/reservations` | No | Create a public reservation lead |
| POST | `/api/public/partnership` | No | Submit a partnership request |

### GET `/api/public/lots`

Returns available lots with status `available`.

**Response (200):**
```json
{
  "lots": [
    {
      "id": 1, "title": "...", "location": "...", "size_m2": 500, "price": 500000,
      "monthly_amount": 21000, "duration_months": 24, "icon": "...",
      "features": ["..."], "status": "available", "display_order": 1
    }
  ]
}
```

### POST `/api/public/reservations`

Create a reservation lead (no account required).

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| full_name | string | Yes | Full name |
| phone | string | Yes | Valid phone number |
| email | string | No | Email address |
| city | string | No | City |
| lot_type | string | Yes | Type: starter, standard, confort, premium |
| lot_price | integer | Yes | Lot price |
| duration_months | integer | Yes | Payment duration in months |
| source | string | No | Referral source |

**Response (201):**
```json
{
  "message": "Demande recue. Un conseiller vous contactera rapidement.",
  "contact": { "full_name": "...", "phone": "...", "email": null, "city": null }
}
```

### POST `/api/public/partnership`

Submit a partnership/agent application.

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| full_name | string | Yes | Full name |
| phone | string | Yes | Phone number |
| email | string | No | Email address |
| city | string | No | City |
| company_name | string | No | Company name |
| motivation | string | No | Motivation text (max 1000 chars) |

**Response (201):**
```json
{
  "message": "Demande de partenariat enregistree ! Nous vous contacterons apres validation.",
  "agent_code": "AG-XXX-12345"
}
```

---

## 3. Client (`/api/client`)

**Authentication:** JWT required, role `client` or `admin`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/client/dashboard` | client/admin | Full client dashboard with metrics |
| POST | `/api/client/reservations` | client/admin | Create a reservation |
| POST | `/api/client/reservations/:id/insurance-persons` | client/admin | Update insurance persons count |
| POST | `/api/client/versement` | client/admin | Initiate a payment |
| POST | `/api/client/versement/:id/confirm` | client/admin | Confirm a pending payment |
| POST | `/api/client/versement/:id/cancel` | client/admin | Cancel a pending payment |
| GET | `/api/client/insurance-policy` | client/admin | Download insurance policy PDF |
| GET | `/api/client/profile` | client/admin | Get client profile |
| PUT | `/api/client/profile` | client/admin | Update client profile |

### GET `/api/client/dashboard`

Returns comprehensive dashboard data including reservations, payments, contracts, possession records, and computed metrics.

**Response (200):**
```json
{
  "profile": { "..." },
  "metrics": {
    "commitment_total": 500000, "paid_total": 150000, "remaining_total": 350000,
    "reliability_score": 100, "late_amount": 0, "late_months_count": 0,
    "total_active_lots": 1, "total_daily_lots": 1500,
    "total_insurance_persons": 0, "total_daily_insurance": 0,
    "total_daily_amount": 1500, "min_daily_amount": 1500, "monthly_amount": 45000
  },
  "reservations": [ { "...reservation summaries with schedule..." } ],
  "payments": [ ],
  "contracts": [ ],
  "possession": [ ]
}
```

### POST `/api/client/reservations`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lot_type | string | Yes | starter, standard, confort, premium |
| lot_price | integer | Yes | Lot price |
| duration_months | integer | Yes | Duration in months |
| source | string | No | Referral source |

**Response (201):**
```json
{
  "id": 1, "lot_type": "starter", "lot_price": 40000, "lot_size_m2": 200,
  "price_per_m2": 200, "duration_months": 24, "deposit_amount": 4000,
  "monthly_amount": 1500, "daily_amount": 1500, "insurance_persons": 0,
  "payment_frequency": "quotidien"
}
```

### POST `/api/client/reservations/:id/insurance-persons`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| count | integer | Yes | Number of insured persons |

**Response (200):**
```json
{
  "reservation_id": 1, "insurance_persons": 2,
  "daily_lot": 1500, "daily_insurance": 700, "daily_total": 2200
}
```

### POST `/api/client/versement`

Initiate a payment (creates a pending payment, to be confirmed by CamPay).

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reservation_id | integer | No | Target reservation (defaults to latest active) |
| amount | integer | Yes | Payment amount (minimum = daily amount) |
| method | string | Yes | orange_money, mtn_momo, virement, carte |
| phone | string | No | Phone number for mobile payment |

**Response (201):**
```json
{
  "id": 1, "reference": "TRX-ABCD1234", "amount": 5000, "method": "orange_money",
  "status": "pending", "reservation_id": 1, "user_name": "...", "user_email": "...", "user_phone": "..."
}
```

### POST `/api/client/versement/:id/confirm`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| campay_reference | string | No | CamPay transaction reference |

**Response (200):**
```json
{ "id": 1, "status": "paid", "reliability_score": 100 }
```

### POST `/api/client/versement/:id/cancel`

No request body required.

**Response (200):**
```json
{ "message": "Versement annule" }
```

### GET `/api/client/insurance-policy`

Returns an insurance policy as a PDF document (Content-Type: application/pdf).

### GET `/api/client/profile`

**Response (200):**
```json
{ "profile": { "id": 1, "full_name": "...", "email": "...", "phone": "...", "city": "...", "reliability_score": 100, "created_at": "..." } }
```

### PUT `/api/client/profile`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| full_name | string | No | Full name |
| phone | string | No | Phone number |
| city | string | No | City |
| new_password | string | No | New password (min 8 chars) |

**Response (200):**
```json
{ "ok": true, "profile": { "id": 1, "full_name": "...", "email": "...", "phone": "...", "city": "..." } }
```

---

## 4. Owner (`/api/owner`)

**Authentication:** JWT required, role `owner` or `admin`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/owner/dashboard` | owner/admin | Owner dashboard with properties and payments |
| POST | `/api/owner/properties` | owner/admin | Register a new property |

### GET `/api/owner/dashboard`

**Response (200):**
```json
{
  "profile": { "..." },
  "properties": [
    { "id": 1, "property_title": "...", "location": "...", "size_m2": 500, "expected_price": 1000000, "preferred_payment_mode": "...", "payment_calendar": "...", "status": "pending_review", "created_at": "..." }
  ],
  "payments": [ ]
}
```

### POST `/api/owner/properties`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| property_title | string | Yes | Property title (max 120 chars) |
| location | string | Yes | Location (max 120 chars) |
| size_m2 | integer | No | Size in square meters |
| expected_price | integer | No | Expected price |
| preferred_payment_mode | string | No | Preferred payment mode |
| payment_calendar | string | No | Payment calendar |

**Response (201):**
```json
{ "id": 1 }
```

---

## 5. Payments (`/api/payments`)

**Authentication:** JWT required, role `client`, `owner`, or `admin`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/payments` | client/owner/admin | List user's payments |
| POST | `/api/payments` | client/owner/admin | Create a payment record |

### GET `/api/payments`

**Response (200):**
```json
{
  "payments": [
    { "id": 1, "reservation_id": 1, "owner_property_id": null, "amount": 5000, "method": "orange_money", "due_date": "...", "paid_at": "...", "status": "paid", "reference": "TRX-..." }
  ]
}
```

### POST `/api/payments`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reservation_id | integer | No | Associated reservation |
| owner_property_id | integer | No | Associated owner property |
| amount | integer | Yes | Payment amount |
| method | string | Yes | Payment method (max 40 chars) |
| due_date | string | No | Due date |
| status | string | No | paid (default), late, pending |

**Response (201):**
```json
{ "id": 1, "reference": "TRX-ABCD1234", "reliability_score": 100 }
```

---

## 6. Documents (`/api/documents`)

**Authentication:** JWT required, role `client`, `owner`, or `admin`. Rate-limited for uploads.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/documents` | client/owner/admin | List user's documents |
| POST | `/api/documents` | client/owner/admin | Upload a document |

### GET `/api/documents`

**Response (200):**
```json
{
  "documents": [
    { "id": 1, "reservation_id": null, "owner_property_id": null, "document_type": "cni", "file_name": "...", "file_path": "...", "storage_mode": "local", "public_url": null, "uploaded_at": "..." }
  ]
}
```

### POST `/api/documents`

Multipart form-data upload. Max file size: 8 MB. Allowed types: PDF, JPEG, PNG, WebP, DOC, DOCX.

**Request Body (multipart):**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | file | Yes | The document file |
| document_type | string | Yes | Type of document (e.g., cni, titre_foncier) |
| reservation_id | integer | No | Associated reservation |
| owner_property_id | integer | No | Associated owner property |

**Response (201):**
```json
{
  "id": 1, "file_name": "document.pdf", "file_path": "...",
  "storage_mode": "local", "public_url": null
}
```

---

## 7. Manager (`/api/manager`)

**Authentication:** JWT required, role `admin` with manager privileges.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/manager/overview` | manager | Dashboard overview metrics |
| GET | `/api/manager/users` | manager | List users (read-only) |
| PUT | `/api/manager/users/:id` | manager | Update a user |
| GET | `/api/manager/reservations` | manager | List all reservations |
| GET | `/api/manager/reservations/:id` | manager | Reservation details |
| GET | `/api/manager/documents` | manager | List all documents |
| GET | `/api/manager/documents/:id/download` | manager | Download a document |
| POST | `/api/manager/messages` | manager | Send a message/notification |
| GET | `/api/manager/messages` | manager | List sent messages |
| GET | `/api/manager/lots` | manager | List all lots |

### GET `/api/manager/overview`

**Response (200):**
```json
{
  "users_by_role": [{ "role": "client", "total": 10 }],
  "pending_reservations": 5,
  "documents_count": 20,
  "messages_count": 3,
  "monthly_users": [{ "month": "2026-01", "total": 5 }]
}
```

### GET `/api/manager/users`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search by name, email, or phone |
| role | string | Filter by role |

**Response (200):**
```json
{ "users": [{ "id": 1, "role": "client", "full_name": "...", "email": "...", "phone": "...", "city": "...", "reliability_score": 100, "created_at": "..." }] }
```

### PUT `/api/manager/users/:id`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| full_name | string | Yes | Full name |
| phone | string | No | Phone |
| city | string | No | City |

**Response (200):**
```json
{ "ok": true }
```

### POST `/api/manager/messages`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| target_scope | string | Yes | all, role, user |
| target_role | string | No | Target role (when scope = role) |
| target_user_id | integer | No | Target user ID (when scope = user) |
| content | string | Yes | Message content (max 2000 chars) |
| channels | array | No | Delivery channels (default: in_app) |

**Response (201):**
```json
{ "id": 1, "status": "queued" }
```

---

## 8. Super Admin (`/api/super-admin`)

**Authentication:** JWT required, super admin privileges (user must exist in `super_admins` table).

### Overview and Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/super-admin/overview` | super_admin | Full platform overview |
| GET | `/api/super-admin/users` | super_admin | List all users with filters |
| POST | `/api/super-admin/users` | super_admin | Create a new user |
| PUT | `/api/super-admin/users/:id` | super_admin | Update a user |
| DELETE | `/api/super-admin/users/:id` | super_admin | Delete a user |
| GET | `/api/super-admin/users/:id/history` | super_admin | User audit logs and payment history |

### GET `/api/super-admin/overview`

**Response (200):**
```json
{
  "users_by_role": [{ "role": "client", "total": 10 }],
  "revenue_total": 500000,
  "payments_count": 25,
  "pending_reservations": 3,
  "monthly_revenue": [{ "month": "2026-01", "amount": 100000 }],
  "monthly_users": [{ "month": "2026-01", "total": 5 }],
  "roadmap": { "version_label": "v1.2.0", "deployment_status": "operational", "notes": "..." }
}
```

### GET `/api/super-admin/users`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| role | string | Filter by role |
| q | string | Search by name/email/phone |
| status | string | active, low_activity |
| from | string | Created after date |
| to | string | Created before date |

### POST `/api/super-admin/users`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| role | string | Yes | client, owner, admin |
| full_name | string | Yes | Full name |
| email | string | Yes | Email address |
| phone | string | No | Phone number |
| city | string | No | City |
| password_hash | string | No | Password hash (defaults to manual_reset_required) |

**Response (201):**
```json
{ "id": 1 }
```

### PUT `/api/super-admin/users/:id`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| role | string | Yes | client, owner, admin |
| full_name | string | Yes | Full name |
| phone | string | No | Phone |
| city | string | No | City |
| reliability_score | integer | Yes | Reliability score |

**Response (200):**
```json
{ "ok": true }
```

### DELETE `/api/super-admin/users/:id`

Cannot delete own account or super admin accounts.

**Response (200):**
```json
{ "ok": true }
```

### GET `/api/super-admin/users/:id/history`

**Response (200):**
```json
{
  "logs": [{ "id": 1, "action": "...", "method": "POST", "path": "/api/...", "metadata": {}, "created_at": "..." }],
  "payments": [{ "id": 1, "amount": 5000, "status": "paid", "method": "orange_money", "reference": "...", "paid_at": "..." }]
}
```

### Messages

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/super-admin/messages` | super_admin | Send message/notification (with real email support) |
| GET | `/api/super-admin/messages` | super_admin | List all messages |

### POST `/api/super-admin/messages`

Same parameters as manager messages but with actual SMTP email sending support.

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| target_scope | string | Yes | all, role, user |
| target_role | string | No | Target role (when scope = role) |
| target_user_id | integer | No | Target user ID (when scope = user) |
| content | string | Yes | Message content (max 2000 chars) |
| channels | array | No | Delivery channels (e.g., ["in_app", "email"]) |

**Response (201):**
```json
{
  "id": 1, "status": "sent", "emails_sent": 5, "recipients_count": 10,
  "errors": ["user@example.com: delivery failed"]
}
```

### Documents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/super-admin/documents` | super_admin | List all documents with filters |
| GET | `/api/super-admin/documents/:id/download` | super_admin | Download a document |
| PUT | `/api/super-admin/documents/:id` | super_admin | Update document type |
| DELETE | `/api/super-admin/documents/:id` | super_admin | Delete a document |

### GET `/api/super-admin/documents`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Filter by document_type |
| user_id | integer | Filter by user |
| q | string | Search by file name, user name, or email |

**Response (200):**
```json
{
  "documents": [{ "id": 1, "user_id": 1, "document_type": "cni", "file_name": "...", "storage_mode": "local", "public_url": null, "uploaded_at": "...", "user_name": "...", "user_email": "...", "user_phone": "...", "user_role": "client" }],
  "document_types": ["cni", "titre_foncier"]
}
```

### PUT `/api/super-admin/documents/:id`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| document_type | string | Yes | New document type |

### Lots

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/super-admin/lots` | super_admin | List all lots |
| POST | `/api/super-admin/lots` | super_admin | Create a lot |
| PUT | `/api/super-admin/lots/:id` | super_admin | Update a lot |
| DELETE | `/api/super-admin/lots/:id` | super_admin | Delete a lot |

### POST `/api/super-admin/lots`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Yes | Lot title |
| location | string | Yes | Location |
| size_m2 | integer | Yes | Size in m2 |
| price | integer | Yes | Price in FCFA |
| monthly_amount | integer | No | Monthly payment amount |
| duration_months | integer | No | Payment duration |
| icon | string | No | Emoji icon (default: house) |
| features | array/string | No | JSON array of features |
| status | string | No | available, reserved, archived |
| display_order | integer | No | Display order |

### PUT `/api/super-admin/lots/:id`

Same parameters as POST.

### Payments Export

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/super-admin/payments/:userId/export-pdf` | super_admin | Export user payment history as PDF |

Returns a PDF file (Content-Type: application/pdf).

### Roadmap

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/super-admin/roadmap` | super_admin | Get current roadmap status |
| PUT | `/api/super-admin/roadmap` | super_admin | Update roadmap status |

### PUT `/api/super-admin/roadmap`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| version_label | string | Yes | Version label (max 60 chars) |
| deployment_status | string | No | Deployment status |
| notes | string | No | Notes (max 4000 chars) |

### Reservations / Leads

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/super-admin/reservations` | super_admin | List all reservations/leads |
| GET | `/api/super-admin/reservations/:id` | super_admin | Reservation details with payments and contract |
| POST | `/api/super-admin/reservations/:id/validate` | super_admin | Validate a lead, create client account, activate reservation |
| POST | `/api/super-admin/reservations/:id/reject` | super_admin | Reject a lead/reservation |
| PUT | `/api/super-admin/reservations/:id` | super_admin | Update reservation status |
| GET | `/api/super-admin/reservations/:id/contract-pdf` | super_admin | Generate contract PDF |
| POST | `/api/super-admin/reservations/:id/send-welcome` | super_admin | Send welcome email with contract PDF |

### GET `/api/super-admin/reservations`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: lead, pending, active, completed, cancelled |

### POST `/api/super-admin/reservations/:id/validate`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| full_name | string | Yes | Client full name |
| phone | string | Yes | Client phone |
| email | string | No | Client email |
| city | string | No | Client city |

**Response (200):**
```json
{
  "ok": true, "message": "Reservation validee, compte cree et email envoye",
  "user": { "id": 1, "full_name": "...", "email": "...", "phone": "..." },
  "contract_number": "TS-CTR-00001-2026",
  "temp_password": "...",
  "email_sent": true, "email_error": null
}
```

### POST `/api/super-admin/reservations/:id/reject`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reason | string | No | Rejection reason (max 500 chars) |

### PUT `/api/super-admin/reservations/:id`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | Yes | lead, pending, active, completed, cancelled |

### Agents / Partners

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/super-admin/agents` | super_admin | List all agents |
| POST | `/api/super-admin/agents/:id/approve` | super_admin | Approve an agent |
| POST | `/api/super-admin/agents/:id/reject` | super_admin | Reject an agent |
| POST | `/api/super-admin/agents/:id/suspend` | super_admin | Suspend an agent |

### GET `/api/super-admin/agents`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: pending, active, rejected, suspended |

### POST `/api/super-admin/agents/:id/reject`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reason | string | No | Rejection reason (max 500 chars) |

---

## 9. Agent (`/api/agent`)

**Authentication:** JWT required + active agent status (verified via `agents` table).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agent/dashboard` | agent | Agent dashboard with metrics |
| POST | `/api/agent/promo-codes` | agent | Create a promo code |
| POST | `/api/agent/promo-codes/:id/deactivate` | agent | Deactivate a promo code |
| GET | `/api/agent/referrals` | agent | List agent referrals |
| GET | `/api/agent/commissions` | agent | List agent commissions |
| GET | `/api/agent/verify-promo/:code` | No | Verify a promo code (public) |
| GET | `/api/agent/verify-ref/:agentCode` | No | Verify a referral link (public) |
| GET | `/api/agent/profile` | agent | Get agent profile |
| PUT | `/api/agent/profile` | agent | Update agent profile |

### GET `/api/agent/dashboard`

**Response (200):**
```json
{
  "agent": {
    "id": 1, "agent_code": "AG-XXX-12345", "company_name": "...",
    "status": "active", "commission_rate": 0.05, "referral_link": "https://..."
  },
  "metrics": {
    "total_clients": 10, "total_owners": 2, "total_earned": 50000,
    "pending_commissions": 5000, "paid_commissions": 45000, "total_referrals": 12
  },
  "referrals": [ ],
  "commissions": [ ],
  "promo_codes": [ ]
}
```

### POST `/api/agent/promo-codes`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| description | string | No | Description (max 200 chars) |
| max_uses | integer | No | Maximum number of uses |
| expires_at | string | No | Expiration date |

**Response (201):**
```json
{ "code": "AG-XXX-12345-A1B2C3", "description": "...", "max_uses": 100 }
```

### GET `/api/agent/verify-promo/:code`

No authentication required.

**Response (200):**
```json
{
  "valid": true, "code": "AG-XXX-12345-A1B2C3",
  "agent_code": "AG-XXX-12345", "agent_name": "...", "description": "..."
}
```

### GET `/api/agent/verify-ref/:agentCode`

No authentication required.

**Response (200):**
```json
{ "valid": true, "agent_code": "AG-XXX-12345", "agent_name": "..." }
```

### PUT `/api/agent/profile`

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| full_name | string | No | Full name |
| phone | string | No | Phone |
| city | string | No | City |
| company_name | string | No | Company name |
| orange_money | string | No | Orange Money number |
| mtn_momo | string | No | MTN MoMo number |
| bank_name | string | No | Bank name |
| bank_account | string | No | Bank account number |
| new_password | string | No | New password (min 8 chars) |

**Response (200):**
```json
{ "ok": true, "message": "Profil mis a jour" }
```

---

## 10. Webhooks (`/api/webhooks`)

No JWT authentication. Secured via webhook signature.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks/campay` | Webhook signature | CamPay payment status webhook |

### POST `/api/webhooks/campay`

Called by CamPay when a payment status changes. Validates `x-campay-signature` header against `CAMPAY_WEBHOOK_SECRET` environment variable.

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | Yes | SUCCESSFUL, success, FAILED, failed |
| reference | string | Conditional | Payment reference |
| external_reference | string | Conditional | External reference (takes priority) |
| amount | number | No | Payment amount |
| operator | string | No | Payment operator |

**Response (200):**
```json
{ "received": true, "matched": true }
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{ "error": "Description of the error" }
```

Common HTTP status codes:
- `400` - Bad request / validation error
- `401` - Authentication required or invalid credentials
- `403` - Insufficient permissions
- `404` - Resource not found
- `409` - Conflict (e.g., duplicate email)
- `500` - Internal server error
- `501` - Feature not configured (e.g., Google OAuth)

## Authentication

All authenticated endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Tokens are issued on login/registration and expire after 7 days. The JWT payload contains `userId` and `role`.
