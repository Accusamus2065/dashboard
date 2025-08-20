# Model Registry (React + AntD · Express + Sequelize · Postgres)

A lightweight internal **Model Registry** with upload, compliance, metrics, and audit trails.  
Built for demos/coursework with role-based access (`admin`, `uploader`, `auditor`, `viewer`).

## What’s inside

- **Frontend** (`/frontend`): React 19 + Vite + Ant Design 5
    - Advanced filters (schema, risk, license, tags, metrics, **compliance status**, **updated-at presets + custom range**)
    - Sort by **Recently updated / Oldest updated** plus metrics/latency/name
    - Metrics chips rounded to 2 decimals
    - Pagination that respects backend totals and resets correctly on filter/pageSize changes
    - Model detail: README (MD/PDF), approved compliance docs (inline PDF preview), audit trail, **owner contact visible to viewer**
- **Backend** (`/backend`): Express 5 + Sequelize 6 + PostgreSQL + JWT
    - Endpoints for auth, search, upload, compliance docs, audit history
    - Static `/uploads` hosting
    - Seed script: **4 users** + **24 realistic models**
        - Every model has full metrics (acc, f1, auc, latency) — no missing values
        - `created_at`/`updated_at` distributed between **June 1 and Aug 19 (this year)**
        - Business tags may repeat across models
        - Risk→required docs: high = FRIA/DPIA/PRIVACY; medium = PRIVACY
- **Auth & roles:** JWT; pages gated in frontend via `RequireAuth`

## Quick start

```bash
# prerequisites
node -v   # >= 18
npm -v    # >= 8

# backend
cd backend
# IMPORTANT: Update DATABASE_URL in .env to point to your database
# Example:
# DATABASE_URL=postgresql://username:password@hostname:5432/your_database
npm install
npm run seed
npm run dev

# frontend
cd ../frontend
npm install
npm run dev
```

## Demo logins
- admin@acme.com / Password123!
- auditor@acme.com / Password123!
- uploader@acme.com / Password123!
- viewer@acme.com / Password123!