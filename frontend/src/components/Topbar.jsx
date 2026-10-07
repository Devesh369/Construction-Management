import React from 'react';
import { RefreshCw, Smartphone, Monitor, ShieldCheck, Building } from 'lucide-react';
import { useAuth, DEMO_USERS } from '../context/AuthContext';

export const Topbar = ({ projects = [], selectedProjectId, setSelectedProjectId, onRefresh, isRefreshing }) => {
  const { user, quickLogin, activeMode, setActiveMode } = useAuth();

  return (
    <header className="topbar">
      {/* Left side: Project Filter */}
      <div className="topbar-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building size={18} color="var(--primary)" />
          <select
            className="form-control"
            style={{ width: '220px', padding: '6px 12px', fontSize: '0.85rem' }}
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All Projects (Enterprise View)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm"
            title="Refresh Data & KPIs"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        )}
      </div>

      {/* Right side: Persona Switcher & Mode Switch */}
      <div className="topbar-right">
        {/* Persona quick switch */}
        <div className="persona-switcher" title="Instant Role Persona Switcher (Seed Data)">
          <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', paddingLeft: '8px', fontWeight: 600 }}>
            SWITCH DEMO:
          </span>
          {DEMO_USERS.map((demo) => {
            const isCurrent = user?.email === demo.email;
            return (
              <button
                key={demo.key}
                onClick={() => quickLogin(demo.key)}
                className={`persona-pill ${isCurrent ? 'active' : ''}`}
                title={`Login as ${demo.label} (${demo.email})`}
              >
                {demo.label}
              </button>
            );
          })}
        </div>

        {/* Portal vs PWA toggle button */}
        <button
          onClick={() => setActiveMode(activeMode === 'admin' ? 'field' : 'admin')}
          className="btn btn-secondary btn-sm"
          style={{ borderColor: activeMode === 'field' ? 'var(--accent-amber)' : 'var(--border-medium)' }}
        >
          {activeMode === 'admin' ? (
            <>
              <Smartphone size={14} color="var(--accent-amber)" />
              <span>Mobile PWA</span>
            </>
          ) : (
            <>
              <Monitor size={14} color="var(--primary)" />
              <span>Admin Portal</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
