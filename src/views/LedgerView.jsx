import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Scale,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { useAuth } from '../context/AuthContext';

export const LedgerView = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState('trial-balance'); // 'trial-balance' | 'entries' | 'pnl' | 'balance-sheet'
  const [trialBalance, setTrialBalance] = useState(null);
  const [entries, setEntries] = useState([]);
  const [pnl, setPnl] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tbRes, entriesRes] = await Promise.all([
        api.ledger.getTrialBalance(),
        api.ledger.getJournalEntries(),
      ]);
      setTrialBalance(tbRes);
      setEntries(Array.isArray(entriesRes) ? entriesRes : entriesRes.results || []);
    } catch (err) {
      console.error('Failed to load ledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isBalanced = Boolean(trialBalance?.is_balanced);

  if (!['ORG_ADMIN', 'ACCOUNTANT'].includes(role)) {
    return (
      <div className="card" style={{ maxWidth: '640px', margin: '48px auto', padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <ShieldAlert size={32} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
          Accounting Ledger Restricted
        </h2>
        <p style={{ color: 'var(--text-subtle)', fontSize: '0.92rem', lineHeight: '1.6' }}>
          Double-entry financial ledgers, chart of accounts, and trial balance statements are restricted to Organization Administrators and Accountants.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
            Financial Ledger & Double-Entry Statements
          </h2>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Immutable accounting journal, auto-posted entries, and real-time trial balance.
          </p>
        </div>

        {isBalanced && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 'var(--radius-full)',
              color: '#34d399',
              fontWeight: 600,
              fontSize: '0.86rem',
            }}
          >
            <CheckCircle2 size={18} />
            <span>Trial Balance Perfectly Balanced</span>
          </div>
        )}
      </div>

      {/* Navigation tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('trial-balance')}
          className={`btn btn-sm ${activeTab === 'trial-balance' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Trial Balance
        </button>
        <button
          onClick={() => setActiveTab('entries')}
          className={`btn btn-sm ${activeTab === 'entries' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Journal Entries ({entries.length})
        </button>
      </div>

      {activeTab === 'trial-balance' ? (
        <div className="card card-table">
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={18} color="var(--primary)" />
              <span>Real-Time Trial Balance</span>
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Dual-Aspect Rule: Total Debits (DR) must equal Total Credits (CR)
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Computing chart of accounts balances...
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}>Account Code</th>
                    <th>Account Name</th>
                    <th style={{ textAlign: 'center', width: '150px' }}>Classification</th>
                    <th style={{ textAlign: 'right', width: '180px' }}>Debit (DR)</th>
                    <th style={{ textAlign: 'right', width: '180px' }}>Credit (CR)</th>
                  </tr>
                </thead>
                <tbody>
                  {(trialBalance?.accounts || []).map((acc) => {
                    const code = acc.account_code || acc.code;
                    const name = acc.account_name || acc.name;
                    const type = acc.account_type || acc.type;
                    const debit = Number(acc.debit || 0);
                    const credit = Number(acc.credit || 0);

                    return (
                      <tr key={code || acc.account_id}>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.82rem' }}>
                            {code}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <Badge status={type}>{type}</Badge>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 600, color: debit > 0 ? 'var(--text-main)' : 'var(--text-subtle)' }}>
                          {debit > 0 ? formatCurrency(debit) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 600, color: credit > 0 ? 'var(--text-main)' : 'var(--text-subtle)' }}>
                          {credit > 0 ? formatCurrency(credit) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.82rem' }}>
                      Grand Totals:
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent)' }}>
                      {formatCurrency(trialBalance?.total_debit)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent)' }}>
                      {formatCurrency(trialBalance?.total_credit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Journal Entries Log Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {entries.length === 0 ? (
            <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-subtle)' }}>
              No journal entries recorded in this period.
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="card card-table">
                <div style={{ padding: '14px 18px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: '0.92rem' }}>
                      {entry.entry_number}
                    </span>
                    <span style={{ color: 'var(--border-default)' }}>|</span>
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-subtle)', fontWeight: 500 }}>{entry.date}</span>
                    <Badge variant="blue">{entry.reference_type || 'MANUAL'}</Badge>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                      {entry.description}
                    </span>
                  </div>
                  {entry.project_name && (
                    <Badge variant="cyan">{entry.project_name}</Badge>
                  )}
                </div>

                {/* Entry Lines as a clean sub-table */}
                <div className="table-container" style={{ margin: 0 }}>
                  <table className="data-table" style={{ fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '130px', padding: '8px 16px', fontSize: '0.68rem' }}>Account Code</th>
                        <th style={{ padding: '8px 16px', fontSize: '0.68rem' }}>Account Description</th>
                        <th style={{ textAlign: 'center', width: '90px', padding: '8px 16px', fontSize: '0.68rem' }}>Side</th>
                        <th style={{ textAlign: 'right', width: '160px', padding: '8px 16px', fontSize: '0.68rem' }}>Debit (DR)</th>
                        <th style={{ textAlign: 'right', width: '160px', padding: '8px 16px', fontSize: '0.68rem' }}>Credit (CR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(entry.lines || []).map((line, idx) => (
                        <tr key={idx}>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-subtle)' }}>
                              {line.account_code}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{line.account_name}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: line.side === 'DR' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                              color: line.side === 'DR' ? '#0284c7' : '#9333ea',
                            }}>
                              {line.side}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 600, color: line.side === 'DR' ? '#0284c7' : 'var(--text-subtle)' }}>
                            {line.side === 'DR' ? formatCurrency(line.amount) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 600, color: line.side === 'CR' ? '#9333ea' : 'var(--text-subtle)' }}>
                            {line.side === 'CR' ? formatCurrency(line.amount) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
