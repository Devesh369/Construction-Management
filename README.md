# Construction Management Portal

A multi-tenant SaaS backend for construction companies built with **Django 5.2 LTS + Django REST Framework** on **PostgreSQL 15+**.

---

## 1. Quick Start

### Prerequisites
- Python 3.12
- PostgreSQL 15+ or Docker Compose

### Step 1: Virtual Environment & Dependencies
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Copy environment variables
cp .env.example .env
```

### Step 2: Database Setup
Using Docker Compose:
```bash
docker compose up -d db
```
Or use a local PostgreSQL instance with database `construction_db` and user `postgres`.

### Step 3: Run Database Migrations
```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

### Step 4: Run Tests
```bash
pytest -q
pytest --cov=.
```

### Step 5: Start API Server & OpenAPI Docs
```bash
python manage.py runserver
```
- Interactive Swagger UI: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)
- OpenAPI 3.0 Schema: [http://localhost:8000/api/schema/](http://localhost:8000/api/schema/)
- Redoc Documentation: [http://localhost:8000/api/redoc/](http://localhost:8000/api/redoc/)

---

## 2. Architecture & Modules

The platform is organized into 12 Django apps (1 shared foundation package + 11 domain modules):

| Layer | Module | Responsibility | Owner |
|---|---|---|---|
| **L0** | `core` | Multi-tenant base models, soft-delete, errors, sequences, money helper | Member A |
| **L1** | `accounts` | Users, Organization, JWT cookie rotation, lockout, invitations | Member A |
| **L2** | `audit` | Append-only security audit log (`log_action`) | Member A |
| **L3** | `projects` | Sites, GPS circle geofence, team roster, budget categories, spend | Member B |
| **L4** | `ledger` | Immutable double-entry financial journal, chart of accounts, statements | Member A |
| **L4** | `workforce` | Workers directory, daily/monthly pay rates, labor gangs, bank privacy | Member B |
| **L4** | `progress` | Daily Progress Reports (DPR), task completion %, photos, PM verification | Member B |
| **L5** | `attendance` | GPS check-in (Haversine), gang batch, holidays, night shifts, close-day | Member B |
| **L5** | `expenses` | Site expenses, receipts, credit purchases, utility baselines, approvals | Member C |
| **L6** | `payroll` | Worker advances, attendance-driven wage calculations, vouchers, PDF slips | Member C |
| **L7** | `dashboard` | Executive KPIs, alerts, burn rate, spend-by-category, 60s cache | Member A |
| **L7** | `reports` | PDF & Excel exports for payroll, DPR, expenses, trial balance | Member C |

---

## 3. Project Build Phases

- **Phase P0 (Current):** Skeleton — settings, Docker, CI, 12 registered apps, contract stubs, Swagger.
- **Phase P1:** Foundation — `core` & `accounts` (auth, JWT, lockout, invitations, org settings).
- **Phase P2:** Master Data — `projects` & `workforce`.
- **Phase P3:** Accounting Core — `ledger` double-entry & full `audit`.
- **Phase P4:** Site Operations — `attendance` & `progress` (DPR).
- **Phase P5:** Spend Control — `expenses` & vendors.
- **Phase P6:** Payroll — advances, vouchers & wage engine.
- **Phase P7:** Insight — `dashboard` KPIs & `reports` exports.
- **Phase P8:** Integration — `seed_all` demo data & end-to-end workflow tests.
- **Phase P9:** Frontend Wiring — React.js client integration.
