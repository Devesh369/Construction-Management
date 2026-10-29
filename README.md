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
