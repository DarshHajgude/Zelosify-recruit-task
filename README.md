# Zelosify Recruit — Full-Stack Implementation

Vendor-Hiring Manager recruitment module built on top of the existing Zelosify platform.
Implements the complete flow: IT Vendors upload resumes → AI agent scores them → Hiring Managers review and shortlist.

---

## Repository Structure

```
Zelosify-Recruit/
├── Zelosify-Backend/Server/   Express + TypeScript + Prisma + Vitest
└── Zelosify-Frontend/         Next.js 14 App Router + Redux + Tailwind + shadcn/ui
```

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18+ |
| Docker & Docker Compose | any recent |
| PostgreSQL | via Docker (see below) |

---

## Quick Start

### 1. Start infrastructure (Postgres + Keycloak)

```bash
cd Zelosify-Backend/Server
docker compose up -d
```

This starts:
- PostgreSQL on `localhost:5445`
- Keycloak on `localhost:8080`

### 2. Backend setup

```bash
cd Zelosify-Backend/Server

# Install dependencies
npm install

# Copy env and fill in your values (see Environment Variables section below)
cp .env.example .env

# Run DB migrations
node_modules/.bin/prisma migrate deploy

# Seed openings (12 openings for Bruce Wayne Corp)
npm run seed:openings

# Seed test users in DB + Keycloak
npm run seed:users

# Start dev server (port 5000)
npm run dev
```

### 3. Frontend setup

```bash
cd Zelosify-Frontend

# Install dependencies
npm install

# Copy env
cp .env.local.example .env.local

# Start dev server (port 3000, proxies /api/v1/* to backend)
npm run dev
```

---

## Test User Credentials

> These users are created by `npm run seed:users` and registered in Keycloak + PostgreSQL.

| Role | Username | Email | Password |
|---|---|---|---|
| IT Vendor | `vendor_test` | `vendor_test@zelosify.com` | `password123` |
| Hiring Manager | `hm_test` | `hm_test@zelosify.com` | `password123` |

**Tenant:** Bruce Wayne Corp (`bruce-wayne-corp-tenant-id-001`)

**Login flow:**
1. Go to `http://localhost:3000/login`
2. Enter username + password above
3. TOTP step is bypassed automatically for `@zelosify.com` emails

---

## Environment Variables

### Backend — `Zelosify-Backend/Server/.env`

| Variable | Why it's needed |
|---|---|
| `DATABASE_URL` | Prisma connection to PostgreSQL running in Docker on port 5445 |
| `GROQ_API_KEY` | Groq LLM API — powers the Resume Recommendation Agent (model: `llama-3.3-70b-versatile`). Get free key at https://console.groq.com |
| `KEYCLOAK_URL` | Base URL of local Keycloak instance for token exchange and user creation |
| `KEYCLOAK_REALM` | Realm name (`Zelosify`) — must match the realm imported into Keycloak |
| `KEYCLOAK_CLIENT_ID` | OAuth2 client used for login (`dynamic-client`) |
| `KEYCLOAK_CLIENT_SECRET` | Client secret — copy from Keycloak admin → Clients → dynamic-client → Credentials |
| `KEYCLOAK_ADMIN_USERNAME` | Keycloak admin username (used by seed scripts to create test users via Admin API) |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak admin password |
| `KEYCLOAK_RS256_SIG` | RS256 public key from Keycloak realm — used to verify JWT signatures on every request |
| `ENCRYPTION_ALGORITHM` | `aes-256-gcm` — algorithm used to encrypt S3 upload tokens sent to frontend |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM. Prevents clients from forging S3 upload requests |
| `S3_AWS_REGION` | AWS region where the S3 bucket lives |
| `S3_ACCESS_KEY_ID` | AWS IAM access key — needs `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` |
| `S3_SECRET_ACCESS_KEY` | AWS IAM secret key |
| `S3_BUCKET_NAME` | S3 bucket name where vendor resumes are stored |

### Frontend — `Zelosify-Frontend/.env.local`

| Variable | Why it's needed |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Base URL for all API calls. Next.js dev server proxies `/api/v1/*` to the backend to avoid CORS issues |

---

## Running Tests

```bash
cd Zelosify-Backend/Server

# All tests (137 total)
npm test

# Watch mode
npm run test:watch

# Specific suite
npx vitest run tests/unit/services/
```

Test coverage:
- **18** RBAC middleware unit tests
- **13** Vendor service unit tests
- **16** Hiring Manager service unit tests
- **46** AI agent unit tests
- **14** End-to-end workflow integration tests
- **18** Scoring performance tests (1000 profiles < 2s)

---

## AI Recommendation Agent

The agent runs **fire-and-forget** after a vendor uploads profiles. It does not block the upload response.

**Pipeline (2 tool calls per profile):**

```
[Resume text already in DB — no S3 download]
  → normalize_skills(rawSkills)
    → calculate_match_score(experience, normalizedSkills, location, ...)
      → final JSON output
```

**Decision thresholds:**

| Score | Badge |
|---|---|
| >= 70 | Recommended |
| 50–69 | Borderline |
| < 50 | Not Recommended |
| Not yet processed | Pending |

**Idempotency:** Re-triggering for an already-scored profile is a no-op (`recommended !== null` check).

---

## AI Pipeline Latency Optimization

### The Problem

The original pipeline had **5 sequential steps**, all blocking each other:

```
S3 download + PDF parse   ~500–700 ms
LLM round 1 — parse_resume        ~450 ms
LLM round 2 — extract_features    ~450 ms
LLM round 3 — normalize_skills    ~450 ms
LLM round 4 — calculate_match_score ~450 ms
─────────────────────────────────────────
Total                           ~2300–2500 ms
```

The PRD target was **1500 ms**. Even with a smaller model, 4 LLM round trips made that impossible.

### Root Cause Analysis

The bottleneck was **where the S3 download happened** — inside the LLM tool loop, serialized with the model calls. The file was already uploaded and in memory at that point; re-downloading it from S3 was pure waste.

### The Fix: Prefetch Text Before the Agent Loop

**Key insight:** When a vendor uploads a profile, the file buffer is already in RAM (held by multer). We parse the PDF/PPTX *at that exact moment* — zero extra network calls — and store the extracted text in the `resumeText` column of the `hiringProfile` DB record.

When the AI agent triggers milliseconds later, it reads the text from Postgres instead of downloading from S3.

```
Upload event (file already in memory)
  ├─ S3 upload (parallel)
  ├─ PDF parse from in-memory buffer   ~150 ms
  └─ Store resumeText in DB

AI agent (fires after upload response)
  ├─ Read resumeText from DB           ~0 ms   ← replaces S3 download
  ├─ LLM: normalize_skills            ~450 ms
  ├─ LLM: calculate_match_score       ~450 ms
  └─ LLM: final output                ~450 ms
  ─────────────────────────────────────────────
  Total                              ~1350 ms  ✓
```

### Why We Also Dropped `extract_features`

The original `extract_features` tool existed to force the LLM to structure its extracted data before normalizing skills. With the resume text now provided directly in the user message (instead of via a tool result), the LLM reads experience, location, and skills in one pass without a dedicated tool call. Merging this step saves one full LLM round trip (~450 ms).

### Result

| Scenario | Before | After |
|---|---|---|
| New upload (text prefetched) | ~2400 ms | **~1350 ms** ✓ |
| Old profile / parse failure | ~2400 ms | ~1850 ms (S3 fallback, still fire-and-forget) |
| Tool calls per profile | 4 | 2 |

### Files Changed

| File | What changed |
|---|---|
| `prisma/schema.prisma` | Added `resumeText String?` to `hiringProfile` |
| `services/ai/tools/resumeParsingTool.ts` | Exported `extractPdfText` + `extractPptxText` for use outside the agent |
| `services/vendor/profileService.ts` | Parses PDF from in-memory buffer during `submitProfiles`, stores `resumeText` in DB |
| `services/ai/recommendationService.ts` | Selects `resumeText` from DB, passes it to the orchestrator |
| `services/ai/agentOrchestrator.ts` | New signature accepts pre-parsed text; falls back to S3 if text is null; tool loop reduced to 2 calls |
| `services/ai/llmCore.ts` | Removed `parse_resume` and `extract_features` from `TOOL_DEFINITIONS` |

---

## Key Architecture Decisions

- **Tenant isolation:** Every DB query filters by `tenantId` extracted from the JWT. Cross-tenant data leakage is structurally impossible.
- **RBAC:** Keycloak issues role claims. Backend middleware (`authorizeRole`) enforces roles. Frontend middleware (`middleware.js`) enforces route-level role guards.
- **S3 upload flow:** Backend generates presigned PUT URLs + encrypted upload tokens. Frontend sends files directly to S3. Backend never handles binary file data in memory.
- **Resume text prefetch:** PDF/PPTX is parsed from the in-memory buffer at upload time and stored in DB. The AI agent never re-downloads from S3, cutting pipeline latency by ~1000 ms.
- **Soft delete:** Profiles are never hard-deleted. `isDeleted: true` flag hides them from queries.
- **HM profile history:** The HM view shows all non-deleted profiles for an opening across all upload sessions. A SHORTLISTED profile from a previous session will remain visible — this is intentional, not a bug.
- **ACID:** All multi-step DB writes use `prisma.$transaction()`. AI recommendation writes are single atomic `update()` calls.
- **Prompt injection defence:** 4-layer sanitization — max-length truncation, regex pattern removal, HTML escape, boundary wrapping — applied to all text extracted from resumes before sending to LLM.
#
