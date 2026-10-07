import React, { useState } from 'react';
import { HardHat, LogIn, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth, DEMO_USERS } from '../context/AuthContext';

export const LoginView = () => {
  const { login, quickLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = async (demoKey) => {
    setError('');
    setLoading(true);
    try {
      await quickLogin(demoKey);
    } catch (err) {
      setError(err.message || 'Failed to authenticate demo user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'radial-gradient(ellipse at 50% 20%, rgba(37, 99, 235, 0.15), transparent 70%), #080d1a',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '460px',
          width: '100%',
          padding: '36px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(16px)',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Logo and Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
            }}
          >
            <HardHat size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '6px' }}>
            BuildPulse CMP
          </h1>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Enterprise Construction Management & Financial Ledger
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Regular Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Work Email</label>
            <input
              type="email"
              required
              className="form-control"
              placeholder="e.g. admin@alphaconstructions.test"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              required
              className="form-control"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '8px' }}
          >
            <LogIn size={18} />
            <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
          </button>
        </form>

        {/* One-Click Demo Personas */}
        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)' }}>
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--accent-amber)',
              letterSpacing: '0.08em',
              marginBottom: '12px',
              textAlign: 'center',
            }}
          >
            ★ Quick Demo Access (Pre-Seeded Roles)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {DEMO_USERS.map((d) => (
              <button
                key={d.key}
                onClick={() => handleQuick(d.key)}
                disabled={loading}
                className="btn btn-secondary btn-sm"
                style={{
                  justifyContent: 'flex-start',
                  padding: '8px 10px',
                  fontSize: '0.76rem',
                  borderColor: d.key.includes('beta') ? 'rgba(139, 92, 246, 0.4)' : 'var(--border-subtle)',
                }}
              >
                <CheckCircle2 size={13} color="var(--primary)" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
