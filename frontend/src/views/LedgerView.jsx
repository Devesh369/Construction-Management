import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Scale,
  TrendingUp,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';

export const LedgerView = () => {
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

  const isBalanced = trialBalance?.is_balanced;

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
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Scale size={18} color="var(--primary)" />
              <span>Real-Time Trial Balance</span>
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Total Debits = Total Credits
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Computing chart of accounts balances...
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Account Code</th>
                    <th>Account Name</th>
                    <th>Classification</th>
                    <th style={{ textAlign: 'right' }}>Debit (DR)</th>
                    <th style={{ textAlign: 'right' }}>Credit (CR)</th>
                  </tr>
                </thead>
                <tbody>
                  {(trialBalance?.accounts || []).map((acc) => (
                    <tr key={acc.code}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>
                        {acc.code}
                      </td>
                      <td style={{ fontWeight: 500 }}>{acc.name}</td>
                      <td>
                        <Badge status={acc.type}>{acc.type}</Badge>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                        {Number(acc.debit || 0) > 0 ? formatCurrency(acc.debit) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                        {Number(acc.credit || 0) > 0 ? formatCurrency(acc.credit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.05)', fontWeight: 700 }}>
                    <td colSpan={3} style={{ textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Grand Totals:
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: '1rem', color: '#60a5fa' }}>
                      {formatCurrency(trialBalance?.total_debit)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontSize: '1rem', color: '#60a5fa' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {entries.map((entry) => (
            <div key={entry.id} className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#60a5fa' }}>
                      {entry.entry_number}
                    </span>
                    <span style={{ color: 'var(--text-subtle)' }}>•</span>
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>{entry.date}</span>
                    <Badge variant="blue">{entry.reference_type || 'MANUAL'}</Badge>
                  </div>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)', marginTop: '4px', fontSize: '0.92rem' }}>
                    {entry.description}
                  </div>
                </div>
                {entry.project_name && (
                  <Badge variant="cyan">{entry.project_name}</Badge>
                )}
              </div>

              {/* Entry Lines */}
              <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                {(entry.lines || []).map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem',
                      padding: '4px 0',
                      borderBottom: idx < (entry.lines || []).length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)', marginRight: '8px' }}>
                        {line.account_code}
                      </span>
                      <span style={{ color: 'var(--text-main)' }}>{line.account_name}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                      {line.side === 'DR' ? (
                        <span style={{ color: '#38bdf8' }}>DR {formatCurrency(line.amount)}</span>
                      ) : (
                        <span style={{ color: '#c084fc' }}>CR {formatCurrency(line.amount)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
