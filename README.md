# BuildSphere — Construction Management Platform

An enterprise Construction Project Management, Workforce Tracking, Attendance, Payroll, Expenses, and Financial Control Platform rewritten as a modern React application.

---

## 1. Overview

BuildSphere is a full-featured construction management platform with multi-role access control, project financial tracking, workforce management, and double-entry accounting.

### Key Capabilities
- **Executive Dashboard**: Real-time project telemetry, active labor headcounts, budget burn rates, KPI sparklines, and attendance trends.
- **Project Portfolio**: Multi-site tracking, budget categories, actual spend tracking, milestone timelines, and member assignment.
- **Workforce Management**: Employee profiles, trade/skill classification (Karigar, Helper, Mason, Carpenter, Electrician, etc.), daily wage / monthly salary models, bank/UPI details, and labor gangs.
- **Daily Attendance & Shifts**: Mobile-optimized batch check-in, half-day/overtime tracking, night shift management, holiday calendars, and supervisor approval workflow.
- **Daily Progress Reports (DPR)**: Daily activity logs, material consumption records, site photos, supervisor submission, and engineer verification/rejection.
- **Expenses & Vendors**: Material, equipment, and fuel expense logging, receipt attachments, vendor management, and vendor ledger reconciliations.
- **UPAD & Worker Advances**: Field advance payments, remaining salary calculations, batch payouts, and automatic payroll deductions.
- **Payment Central**: Unified transaction ledger tracking cash and bank inflows and outflows.
- **Automated Payroll**: Cycle-based payroll generation (weekly/bi-weekly/monthly), wage calculations with overtime & UPAD advance deductions, voucher generation, and payment settlement.
- **Double-Entry Ledger**: Chart of accounts (Assets, Liabilities, Equity, Revenue, Expenses), journal entries, Trial Balance, Profit & Loss statement, and Balance Sheet.
- **Reports & Exporting**: PDF and Excel exports for payroll summaries, attendance logs, DPRs, expenses, and financial statements.

---

## 2. Role-Based Access Control (RBAC)

The platform supports pre-configured enterprise roles:

| Role | Default Tab | Allowed Modules |
|---|---|---|
| **Organization Admin** (`devesh@buildsphere.com`) | Dashboard | All modules (Dashboard, Projects, Workforce, Attendance, DPR, Expenses, UPAD, Payment Central, Payroll, Ledger, Reports, Settings) |
| **Project Manager** (`darshil@buildsphere.com`) | Dashboard | Dashboard, Projects, Expenses, Reports |
| **Site Engineer** (`viren@buildsphere.com`) | Progress | Progress (DPR), Projects |
| **Accountant** (`san@gmail.com`) | Ledger | Ledger, Expenses, UPAD, Payment Central, Payroll, Reports |
| **Supervisor** | Attendance | Attendance, Workforce |

One-click quick demo login buttons are available directly on the sign-in screen.

---

## 3. Technology Stack

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4 (with light & dark theme support)
- **State & Storage**: Reactive in-browser state with `localStorage` persistence, preloaded with comprehensive real-world construction site data.
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

---

## 4. Development

```bash
# Install dependencies
npm install

# Start Vite dev server on port 3000
npm run dev

# Build for production
npm run build
```

---

## 5. AI Cost Estimator Module (`cost_estimator`)

The **AI Cost Estimator** module enables general contractors, site managers, and quantity surveyors to generate itemized construction cost estimates adjusted for local market rates across Indian cities, choose custom profit margins, and export formal Bill of Quantities (BOQ) PDF reports.

### Architecture & Capabilities
1. **8-Section Input Specifications**:
   - Project basics (Apartment, Villa, Complex, Commercial; New/Renovation/Extension)
   - City & location tiering (Mumbai, Ahmedabad, Anand, Bengaluru, Pune, etc.)
   - Built-up area footprint & floor calculations
   - Structural systems (RCC frame, load-bearing, steel) and soil parameters
   - Quality finishes (Economy, Standard, Premium, Luxury)
   - Extra scopes (compound wall, landscaping, solar PV, borewell, interior fit-outs)
   - Contract type (turnkey vs. labour-only) and timeline
   - Contractor profit margin selector (`5%`, `9%`, `13%`, `17%`, `20%`, and validated `Custom %` from 0 to 100).
2. **Anthropic AI Integration with Deterministic Local Fallback**:
   - Calls Claude API (`ANTHROPIC_MODEL`) using quantity surveyor persona.
   - Fallback database model `LocationCostIndex` seeded for 15+ Indian cities. If the API key is not present or times out, benchmark rates provide instant fallback calculation marked *"Fallback estimate (AI unavailable)"*.
3. **Strict Python Financial Recomputation**:
   - Subtotal, contingency buffer, contractor margin (applied strictly on subtotal), and 18% works GST are re-calculated in Python to ensure arithmetic integrity.
4. **Interactive Actions**:
   - **Recalculate with different margin**: Instant Python recalculation without calling the AI again.
   - **Download PDF**: Formatted BOQ specification sheet with company letterhead and client breakdown.
   - **Attach to project**: Links the estimate directly to an active project.

### Configuration & Environment Variables
Add to your `.env`:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_TIMEOUT=30
```

### Django Backend Execution Commands
```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Run database migrations (creates CostEstimate & LocationCostIndex)
python manage.py makemigrations cost_estimator
python manage.py migrate

# 3. Seed or refresh 15 Indian cities baseline rates
python manage.py loaddata cost_estimator/fixtures/initial_cities.json

# 4. Run automated test suite (form validation, custom margin, Python math, mock API, permissions)
pytest cost_estimator/tests.py -v

# 5. Start Django development server
python manage.py runserver
```

### Updating City Benchmark Rates
Navigate to Django Admin (`/admin/cost_estimator/locationcostindex/`) to calibrate:
- Base rates per sq ft for Economy, Standard, Premium, and Luxury specifications.
- Local material index (e.g., 1.08) and labour index (e.g., 0.95).
- Logistics and regional constraints notes.

