import React, { useState, useEffect } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { useAuth } from '../context/AuthContext';

export const ReportsView = ({ selectedProjectId }) => {
  const { role } = useAuth();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(selectedProjectId || '');
  const [dateFrom, setDateFrom] = useState('2026-09-01');
  const [dateTo, setDateTo] = useState('2026-10-31');
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await api.projects.list();
        const list = Array.isArray(res) ? res : res.results || [];
        setProjects(list);
        if (list.length > 0 && !projectId) {
          setProjectId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    };
    loadProjects();
  }, []);

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleDownload = async (reportType, filename, apiCall, payload) => {
    setDownloading(reportType);
    try {
      const blob = await apiCall(payload);
      triggerDownload(blob, filename);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const reportCards = [
    {
      id: 'wage_pdf',
      title: 'Weekly Wage Register & Payslips',
      format: 'PDF',
      icon: FileText,
      color: '#f87171',
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ACCOUNTANT'],
      description: 'Formal PDF payslip document with worker attendance units, overtime hours, gross earnings, advance deductions, and net payouts.',
      action: () => {
        if (!projectId) {
          alert('Please create and select a project first to export the wage register.');
          return;
        }
        handleDownload(
          'wage_pdf',
          `Wage_Register_${projectId || 'All'}.pdf`,
          api.reports.exportPayrollPDF,
          { project_id: Number(projectId), period_start: dateFrom, period_end: dateTo }
        );
      },
    },
    {
      id: 'dpr_excel',
      title: 'Daily Progress Reports (DPR) Log',
      format: 'EXCEL',
      icon: FileSpreadsheet,
      color: '#34d399',
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'SITE_ENGINEER', 'ACCOUNTANT'],
      description: 'Multi-tab workbook containing site weather summaries, cumulative task completion percentages, and tracked material usages.',
      action: () =>
        handleDownload(
          'dpr_excel',
          `DPR_Summary_Log.xlsx`,
          api.reports.exportDPRExcel,
          { project_id: projectId ? Number(projectId) : null, date_from: dateFrom, date_to: dateTo }
        ),
    },
    {
      id: 'expense_excel',
      title: 'Site Expenses & Procurement Ledger',
      format: 'EXCEL',
      icon: FileSpreadsheet,
      color: '#38bdf8',
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ACCOUNTANT'],
      description: 'Itemized material, fuel, transport, and credit purchase records with approver audit timestamps and vendor references.',
      action: () =>
        handleDownload(
          'expense_excel',
          `Expenses_Ledger.xlsx`,
          api.reports.exportExpensesExcel,
          { project_id: projectId ? Number(projectId) : null, date_from: dateFrom, date_to: dateTo }
        ),
    },
    {
      id: 'att_excel',
      title: 'Workforce Attendance Muster Roll',
      format: 'EXCEL',
      icon: FileSpreadsheet,
      color: '#fbbf24',
      roles: ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'SUPERVISOR', 'ACCOUNTANT'],
      description: 'Monthly site muster sheet with daily check-in marks (P, H, A) and overtime hours.',
      action: () => {
        if (!projectId) {
          alert('Please create and select a project first to export the attendance muster.');
          return;
        }
        handleDownload(
          'att_excel',
          `Attendance_Muster.xlsx`,
          api.reports.exportAttendanceExcel,
          { project_id: Number(projectId), month: Number(dateFrom.split('-')[1]), year: Number(dateFrom.split('-')[0]) }
        );
      },
    },
    {
      id: 'tb_pdf',
      title: 'Trial Balance Financial Report',
      format: 'PDF',
      icon: FileText,
      color: '#c084fc',
      roles: ['ORG_ADMIN', 'ACCOUNTANT'],
      description: 'Official double-entry trial balance verifying debits equal credits across all asset, liability, equity, revenue, and expense accounts.',
      action: () =>
        handleDownload(
          'tb_pdf',
          `Trial_Balance.pdf`,
          api.reports.exportTrialBalancePDF,
          { as_of_date: dateTo }
        ),
    },
    {
      id: 'pnl_pdf',
      title: 'Profit & Loss Statement (P&L)',
      format: 'PDF',
      icon: FileText,
      color: '#60a5fa',
      roles: ['ORG_ADMIN', 'ACCOUNTANT'],
      description: 'Comprehensive financial statement showing project contract revenues against direct site material, wage, and overhead costs.',
      action: () =>
        handleDownload(
          'pnl_pdf',
          `Profit_and_Loss.pdf`,
          api.reports.exportProfitLossPDF,
          { date_from: dateFrom, date_to: dateTo }
        ),
    },
  ];

  const allowedReportCards = reportCards.filter((rc) => !rc.roles || rc.roles.includes(role));

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
          Reports & Export Center
        </h2>
        <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
          Production-grade PDF document generators and multi-tab Excel workbooks.
        </p>
      </div>

      {/* Scope Controls */}
      <div className="card" style={{ marginBottom: '24px', padding: '18px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Project Scope</label>
            <select
              className="form-control"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Date From</label>
            <input
              type="date"
              max={new Date().toISOString().split('T')[0]}
              className="form-control"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Date To</label>
            <input
              type="date"
              max={new Date().toISOString().split('T')[0]}
              className="form-control"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
        {allowedReportCards.map((rc) => {
          const Icon = rc.icon;
          const isBusy = downloading === rc.id;

          return (
            <div key={rc.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: rc.color,
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {rc.title}
                    </h3>
                    <Badge variant={rc.format === 'PDF' ? 'red' : 'green'}>
                      {rc.format}
                    </Badge>
                  </div>
                </div>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.5, flex: 1 }}>
                {rc.description}
              </p>

              <button
                onClick={rc.action}
                disabled={isBusy}
                className="btn btn-primary btn-sm"
                style={{ width: '100%', marginTop: 'auto' }}
              >
                <Download size={14} />
                <span>{isBusy ? 'Generating Export...' : `Download ${rc.format}`}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
