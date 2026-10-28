import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, Mail, Eye, EyeOff, Building, User, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { api } from '../api/client';
import constructionBg from '../assets/construction-bg.png';
import buildsphereLogo from '../assets/buildsphere_logo.png';

export const LoginView = () => {
  const { login, setupAdmin } = useAuth();

  // Mode: 'login' | 'setup'
  const [mode, setMode] = useState('login');
  const [isInitialized, setIsInitialized] = useState(true);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Setup form state
  const [setupForm, setSetupForm] = useState({
    org_name: '',
    name: '',
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if system has any registered users on mount
  useEffect(() => {
    const checkSystem = async () => {
      try {
        const res = await api.auth.getSystemStatus();
        setIsInitialized(res.initialized);
        if (!res.initialized) {
          setMode('setup'); // Automatically switch to setup mode if 0 users exist!
        }
      } catch (err) {
        console.warn('System status check skipped:', err);
      }
    };
    checkSystem();
  }, []);

  // Handle standard login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(
        err.message?.includes('invalid_credentials') || err.message?.includes('Invalid email')
          ? 'Invalid email or password. Please check your credentials or create an admin account.'
          : err.message || 'Authentication failed. Please check credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle initial admin setup
  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    if (!setupForm.name.trim() || !setupForm.email.trim() || !setupForm.password) {
      setError('Please fill in your company name, full name, email, and password.');
      return;
    }
    if (setupForm.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await setupAdmin({
        org_name: setupForm.org_name.trim() || 'BuildSphere Construction Ltd',
        name: setupForm.name.trim(),
        email: setupForm.email.trim(),
        password: setupForm.password,
      });
    } catch (err) {
      setError(err.message || 'Failed to initialize system. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-slate-950">
      {/* Full-screen construction background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${constructionBg})` }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/92 via-blue-950/85 to-slate-950/92 backdrop-blur-[2px]" />

      {/* SVG grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Centered Auth Card */}
      <div className="relative z-10 w-full max-w-md my-8 animate-fade-in">
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/90 backdrop-blur-xl p-8 sm:p-10 shadow-[0_0_80px_rgba(0,0,0,0.6)]">
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center p-2 shadow-xl shadow-blue-500/20 border border-white/20">
              <img
                src={buildsphereLogo}
                alt="BuildSphere"
                className="w-full h-full object-contain drop-shadow"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              BuildSphere
            </h1>
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-blue-400 mt-1">
              Construction Management Platform
            </p>
            <p className="text-xs text-slate-400 mt-2 font-medium">
              Enterprise Construction Management & Project Accounting Platform
            </p>
          </div>

          {/* First-time Setup Alert Badge */}
          {!isInitialized && (
            <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <Sparkles size={16} className="shrink-0 text-amber-400" />
              <span>
                <strong>Fresh Install:</strong> No admin account exists yet. Create your initial Super Admin account below to get started.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-3.5 mb-5 rounded-xl bg-red-950/60 border border-red-500/60 text-red-200 text-xs animate-shake">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* FORM 1: FIRST-TIME ADMIN & ORG SETUP                                      */}
          {/* ========================================================================= */}
          {mode === 'setup' ? (
            <form onSubmit={handleSetupSubmit} className="space-y-3.5">
              <div className="text-center mb-4">
                <span className="text-xs font-black uppercase tracking-wider text-blue-400">
                  Initial Super Admin Setup
                </span>
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1">
                  Company / Organization Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Shree Ram Construction"
                    value={setupForm.org_name}
                    onChange={(e) => setSetupForm({ ...setupForm, org_name: e.target.value })}
                    style={{
                      color: '#ffffff',
                      backgroundColor: 'rgba(2, 6, 23, 0.85)',
                      caretColor: '#ffffff',
                    }}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Admin Full Name */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1">
                  Admin Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Naresh Patel"
                    value={setupForm.name}
                    onChange={(e) => setSetupForm({ ...setupForm, name: e.target.value })}
                    style={{
                      color: '#ffffff',
                      backgroundColor: 'rgba(2, 6, 23, 0.85)',
                      caretColor: '#ffffff',
                    }}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Admin Email */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1">
                  Admin Work Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    placeholder="admin@construction.com"
                    value={setupForm.email}
                    onChange={(e) => setSetupForm({ ...setupForm, email: e.target.value })}
                    style={{
                      color: '#ffffff',
                      backgroundColor: 'rgba(2, 6, 23, 0.85)',
                      caretColor: '#ffffff',
                    }}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Admin Password */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1">
                  Admin Password (min 6 chars)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={setupForm.password}
                    onChange={(e) => setSetupForm({ ...setupForm, password: e.target.value })}
                    style={{
                      color: '#ffffff',
                      backgroundColor: 'rgba(2, 6, 23, 0.85)',
                      caretColor: '#ffffff',
                    }}
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={loading}
                className="w-full mt-3 font-black tracking-wider uppercase text-xs py-3.5 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 cursor-pointer rounded-xl"
              >
                Create Company & Sign In
              </Button>

              {isInitialized && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* ========================================================================= */
            /* FORM 2: STANDARD SIGN IN                                                  */
            /* ========================================================================= */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Email Field */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5"
                >
                  Work Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    autoFocus
                    autoComplete="username"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      color: '#ffffff',
                      backgroundColor: 'rgba(2, 6, 23, 0.85)',
                      caretColor: '#ffffff',
                    }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      color: '#ffffff',
                      backgroundColor: 'rgba(2, 6, 23, 0.85)',
                      caretColor: '#ffffff',
                    }}
                    className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={loading}
                className="w-full mt-2 font-black tracking-wider uppercase text-xs py-3.5 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 cursor-pointer rounded-xl"
              >
                Sign In to Portal
              </Button>

              {!isInitialized && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setMode('setup')}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                  >
                    No admin account yet? Click here to set up
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Secure System Notice */}
          <div className="mt-8 pt-4 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500 font-medium">
              Protected by Enterprise Multi-Tenant Role-Based Access Control
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
