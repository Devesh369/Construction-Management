import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  Building,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Percent,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';

export const DashboardView = ({ selectedProjectId, onNavigate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.dashboard.getOverview(selectedProjectId, true);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load executive dashboard overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [selectedProjectId]);

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Loading Executive KPIs...</div>
        <div style={{ fontSize: '0.85rem' }}>Aggregating project budgets, attendance, and ledger postings</div>
      </div>
    );
  }

  const spendCategories = data?.spend_by_category || [];
  const alerts = data?.alerts || [];
  const totalSpend = Number(data?.total_spend || 0);
  const totalBudget = Number(data?.total_budget || 0);
  const budgetUtilization = totalBudget > 0 ? ((totalSpend / totalBudget) * 100).toFixed(1) : 0;

  return (
    <div>
      {/* Page Title & Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
            Executive Dashboard
          </h2>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Multi-project financial burn rate, site operations, and compliance telemetry.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Auto-refreshed cache:</span>
          <Badge variant="green">Live Realtime</Badge>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Critical Alerts Banner (e.g. UNPAID_VENDOR_DUE, BUDGET_OVERRUN) */}
      {alerts.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: '24px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(239, 68, 68, 0.1))',
            borderColor: 'rgba(245, 158, 11, 0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <ShieldAlert size={22} color="var(--accent-amber)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fde047' }}>
              Action Required: {alerts.length} Operational & Financial Alerts
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {alerts.map((alt, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Badge variant="amber">{alt.type}</Badge>
                  <span style={{ color: 'var(--text-main)' }}>{alt.message || alt.description}</span>
                </div>
                {alt.vendor_id && onNavigate && (
                  <button
                    onClick={() => onNavigate('expenses')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem' }}
                  >
                    View Vendor Statement
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {/* Total Actual Spend */}
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Actual Spend</span>
            <div className="kpi-icon" style={{ background: 'var(--primary-light)', color: '#60a5fa' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="kpi-value">{formatCurrency(data?.total_spend)}</div>
          <div className="kpi-subtext">
            <span>Posted to general ledger</span>
          </div>
        </div>

        {/* Estimated Budget */}
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Estimated Budget</span>
            <div className="kpi-icon" style={{ background: 'var(--purple-bg)', color: '#c084fc' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="kpi-value">{formatCurrency(data?.total_budget)}</div>
          <div className="kpi-subtext">
            <span style={{ color: '#34d399' }}>{budgetUtilization}% utilized</span>
          </div>
        </div>

        {/* Attendance Today */}
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Today's Attendance</span>
            <div className="kpi-icon" style={{ background: 'var(--success-bg)', color: '#34d399' }}>
              <Percent size={20} />
            </div>
          </div>
          <div className="kpi-value">{data?.attendance_percentage_today || '0'}%</div>
          <div className="kpi-subtext">
            <span>{data?.present_workers_count || 0} active workers clocked in</span>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Pending Approvals</span>
            <div className="kpi-icon" style={{ background: 'var(--warning-bg)', color: '#fbbf24' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="kpi-value">{data?.pending_approvals_count || 0}</div>
          <div className="kpi-subtext">
            <span>Site expenses & payroll vouchers</span>
          </div>
        </div>
      </div>

      {/* Budget vs Spend Meter */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">
            <Building size={18} color="var(--primary)" />
            <span>Budget vs Actual Spend Progress</span>
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Remaining Headroom: {formatCurrency(totalBudget - totalSpend)}
          </span>
        </div>
        <div
          style={{
            height: '14px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
            marginBottom: '10px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(budgetUtilization, 100)}%`,
              background:
                budgetUtilization > 90
                  ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                  : 'linear-gradient(90deg, #2563eb, #3b82f6)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
          <span>0%</span>
          <span>50%</span>
          <span>100% (Budget Limit)</span>
        </div>
      </div>

      {/* Spend By Category */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <TrendingUp size={18} color="var(--accent-amber)" />
            <span>Spend Breakdown by Category</span>
          </h3>
        </div>

        {spendCategories.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-subtle)' }}>
            No expenses posted yet for the selected scope.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total Spent</th>
                  <th>Share (%)</th>
                  <th>Visual Share</th>
                </tr>
              </thead>
              <tbody>
                {spendCategories.map((c, idx) => {
                  const amt = Number(c.total || 0);
                  const share = totalSpend > 0 ? ((amt / totalSpend) * 100).toFixed(1) : 0;
                  return (
                    <tr key={idx}>
                      <td>
                        <Badge status={c.category}>{c.category}</Badge>
                      </td>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                        {formatCurrency(amt)}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{share}%</td>
                      <td style={{ width: '40%' }}>
                        <div
                          style={{
                            height: '8px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: 'var(--radius-full)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(share, 100)}%`,
                              background: 'var(--primary)',
                              borderRadius: 'var(--radius-full)',
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
