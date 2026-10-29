import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Building,
  User,
  Sparkles,
  LogIn,
  KeyRound,
  UserPlus,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { api } from '../api/client';
import { cn } from '../utils/cn';
import constructionBg from '../assets/construction-bg.png';
import buildsphereLogo from '../assets/buildsphere_logo.png';

export const LoginView = ({ isAlreadyAuthenticated = false }) => {
  const { login, setupAdmin, acceptInvite, logout, user } = useAuth();

  // Mode: 'login' | 'setup' | 'invite'
  const [mode, setMode] = useState('login');
  const [isInitialized, setIsInitialized] = useState(true);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Setup form state (Register Organization & Super Admin)
  const [setupForm, setSetupForm] = useState({
    org_name: '',
    name: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  // Invite form state (Accept Team Member Invitation)
  const [inviteForm, setInviteForm] = useState({
    token: '',
    name: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check URL params and system initialization status on mount
  useEffect(() => {
    const checkParamsAndStatus = async () => {
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get('invite') || params.get('token');
      const modeParam = params.get('mode');
      const isRegister = params.get('register') === 'true';
      const emailParam = params.get('email');

      if (inviteToken) {
        setMode('invite');
        setInviteForm((prev) => ({
          ...prev,
          token: inviteToken,
          email: emailParam || prev.email,
        }));
      } else if (modeParam === 'setup' || isRegister) {
        setMode('setup');
      } else if (modeParam === 'invite') {
        setMode('invite');
      } else if (modeParam === 'login') {
        setMode('login');
      }

      try {
        const res = await api.auth.getSystemStatus();
        setIsInitialized(res.initialized);
        if (!res.initialized && !inviteToken) {
          setMode('setup');
        }
      } catch (err) {
        console.warn('System status check skipped:', err);
      }
    };

    checkParamsAndStatus();
  }, []);

  // Switch tabs smoothly and update URL query params
  const switchMode = (newMode) => {
    setError('');
    setSuccess('');
    setMode(newMode);
    try {
      const url = new URL(window.location.href);
      if (newMode === 'setup') {
        url.searchParams.set('mode', 'setup');
        url.searchParams.delete('invite');
        url.searchParams.delete('token');
      } else if (newMode === 'invite') {
        url.searchParams.set('mode', 'invite');
      } else {
        url.searchParams.delete('mode');
        url.searchParams.delete('register');
        url.searchParams.delete('invite');
        url.searchParams.delete('token');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

  // 1. Handle standard login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide your work email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      setError(
        err.message?.includes('invalid_credentials') || err.message?.includes('Invalid email')
          ? 'Invalid email or password. Please verify credentials or register your organization.'
          : err.message || 'Authentication failed. Please check credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle initial admin & company setup (Register Organization)
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
    if (setupForm.confirm_password && setupForm.password !== setupForm.confirm_password) {
      setError('Passwords do not match. Please re-enter.');
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
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      setError(err.message || 'Failed to initialize organization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle accepting team member invitation
  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.token.trim()) {
      setError('Invitation token is required. Please check your invitation link.');
      return;
    }
    if (!inviteForm.name.trim()) {
      setError('Please provide your full name.');
      return;
    }
    if (!inviteForm.password || inviteForm.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (inviteForm.confirm_password && inviteForm.password !== inviteForm.confirm_password) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await acceptInvite({
        token: inviteForm.token.trim(),
        password: inviteForm.password,
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
      });
      setSuccess('Account activated! Entering workspace...');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      setError(err.message || 'Failed to accept invitation. The link may have expired or is invalid.');
    } finally {
      setLoading(false);
    }
  };

  // Demo accounts helper
  const handleQuickDemo = async (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
    setLoading(true);
    try {
      await login(demoEmail, demoPass);
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  const showInviteTab = mode === 'invite' || Boolean(inviteForm.token);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-4 overflow-y-auto overflow-x-hidden bg-slate-950 select-none">
      {/* 100% FIXED background image layer - never scrolls or moves */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
        style={{
          backgroundImage: `url(${constructionBg})`,
          backgroundAttachment: 'fixed',
        }}
      />

      {/* FIXED dark gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950/94 via-blue-950/88 to-slate-950/94 backdrop-blur-[2px] pointer-events-none z-0" />

      {/* FIXED subtle grid texture */}
      <div
        className="fixed inset-0 opacity-20 pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Centered Compact Auth Card - strictly fitted to viewport */}
      <div className="relative z-10 w-full max-w-[460px] my-auto animate-fade-in">
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-5 sm:p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
          {/* Active session banner if user is already logged in */}
          {isAlreadyAuthenticated && user && (
            <div className="mb-3 p-2 rounded-lg bg-blue-950/80 border border-blue-500/40 text-blue-200 text-[11px] flex items-center justify-between gap-2 shadow-inner">
              <div className="truncate">
                Logged in: <strong className="text-white">{user.name}</strong> ({user.role})
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = window.location.pathname;
                  }}
                  className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] cursor-pointer transition-colors"
                >
                  App
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[10px] cursor-pointer transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Compact Logo & Header */}
          <div className="text-center mb-3">
            <div className="inline-flex items-center justify-center bg-white rounded-2xl px-4 py-2.5 shadow-xl shadow-blue-500/25 border-2 border-white ring-4 ring-blue-500/20 mb-2 transition-transform hover:scale-105">
              <img
                src={buildsphereLogo}
                alt="BuildSphere AI"
                className="h-14 w-auto object-contain drop-shadow-sm"
              />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white leading-tight">
              BuildSphere
            </h1>
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-blue-400">
              Construction Management Platform
            </p>
          </div>

          {/* Segmented Navigation Tabs */}
          <div
            className={cn(
              'grid gap-1 p-0.5 bg-slate-950/80 rounded-xl border border-white/10 mb-3.5 shadow-inner',
              showInviteTab ? 'grid-cols-3' : 'grid-cols-2'
            )}
          >
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={cn(
                'py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => switchMode('setup')}
              className={cn(
                'py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                mode === 'setup'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Register Org</span>
            </button>

            {showInviteTab && (
              <button
                type="button"
                onClick={() => switchMode('invite')}
                className={cn(
                  'py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                  mode === 'invite'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Join Team</span>
              </button>
            )}
          </div>

          {/* First-time Fresh Install Alert Badge */}
          {!isInitialized && mode === 'setup' && (
            <div className="mb-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
              <Sparkles size={14} className="shrink-0 text-amber-400" />
              <span>
                <strong>Fresh System Setup:</strong> Register master Super Admin to launch.
              </span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-2 mb-2.5 rounded-lg bg-red-950/60 border border-red-500/60 text-red-200 text-[11px] animate-shake">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div className="flex items-center gap-2 p-2 mb-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/60 text-emerald-200 text-[11px]">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: REGISTER NEW ORGANIZATION & SUPER ADMIN (Setup Mode)               */}
          {/* ========================================================================= */}
          {mode === 'setup' && (
            <form onSubmit={handleSetupSubmit} className="space-y-2.5">
              <div className="text-center mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                  Register New Organization & Super Admin
                </span>
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5">
                  Company / Organization Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Builders & Developers"
                    value={setupForm.org_name}
                    onChange={(e) => setSetupForm({ ...setupForm, org_name: e.target.value })}
                    style={{
                      color: '#ffffff',
                      backgroundColor: 'rgba(2, 6, 23, 0.85)',
                      caretColor: '#ffffff',
                    }}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </div>
              </div>

              {/* 2-column: Admin Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5">
                    Admin Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rajesh Sharma"
                      value={setupForm.name}
                      onChange={(e) => setSetupForm({ ...setupForm, name: e.target.value })}
                      style={{
                        color: '#ffffff',
                        backgroundColor: 'rgba(2, 6, 23, 0.85)',
                        caretColor: '#ffffff',
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5">
                    Admin Work Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="admin@company.com"
                      value={setupForm.email}
                      onChange={(e) => setSetupForm({ ...setupForm, email: e.target.value })}
                      style={{
                        color: '#ffffff',
                        backgroundColor: 'rgba(2, 6, 23, 0.85)',
                        caretColor: '#ffffff',
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>

              {/* 2-column: Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5">
                    Password (min 6)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={setupForm.password}
                      onChange={(e) => setSetupForm({ ...setupForm, password: e.target.value })}
                      style={{
                        color: '#ffffff',
                        backgroundColor: 'rgba(2, 6, 23, 0.85)',
                        caretColor: '#ffffff',
                      }}
                      className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={setupForm.confirm_password}
                      onChange={(e) => setSetupForm({ ...setupForm, confirm_password: e.target.value })}
                      style={{
                        color: '#ffffff',
                        backgroundColor: 'rgba(2, 6, 23, 0.85)',
                        caretColor: '#ffffff',
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={loading}
                rightIcon={<ArrowRight className="w-4 h-4 shrink-0" />}
                className="w-full mt-2 font-black tracking-wider uppercase text-xs py-2.5 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 cursor-pointer rounded-xl whitespace-nowrap flex-nowrap justify-center"
              >
                Register Organization & Launch
              </Button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Already registered? Sign in to existing workspace
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ACCEPT TEAM INVITATION (Invite Mode)                                */}
          {/* ========================================================================= */}
          {mode === 'invite' && (
            <form onSubmit={handleInviteSubmit} className="space-y-2.5">
              <div className="text-center mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                  Accept Team Member Invitation
                </span>
              </div>

              {/* 2-column: Code & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5">
                    Invitation Code / ID
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Token ID"
                      value={inviteForm.token}
                      onChange={(e) => setInviteForm({ ...inviteForm, token: e.target.value })}
                      style={{
                        color: '#ffffff',
                        backgroundColor: 'rgba(2, 6, 23, 0.85)',
                        caretColor: '#ffffff',
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5">
                    Your Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vikram Verma"
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                      style={{
                        color: '#ffffff',
                        backgroundColor: 'rgba(2, 6, 23, 0.85)',
                        caretColor: '#ffffff',
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>

              {/* Work Email */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5">
                  Work Email (Optional if token matches invite)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    placeholder="member@company.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    style={{
                      color: '#ffffff',
                      backgroundColor: 'rgba(2, 6, 23, 0.85)',
                      caretColor: '#ffffff',
                    }}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </div>
              </div>

              {/* 2-column: Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5">
                    Set Password (min 6)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={inviteForm.password}
                      onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                      style={{
                        color: '#ffffff',
                        backgroundColor: 'rgba(2, 6, 23, 0.85)',
                        caretColor: '#ffffff',
                      }}
                      className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={inviteForm.confirm_password}
                      onChange={(e) => setInviteForm({ ...inviteForm, confirm_password: e.target.value })}
                      style={{
                        color: '#ffffff',
                        backgroundColor: 'rgba(2, 6, 23, 0.85)',
                        caretColor: '#ffffff',
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={loading}
                rightIcon={<CheckCircle2 className="w-4 h-4 shrink-0" />}
                className="w-full mt-2 font-black tracking-wider uppercase text-xs py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/25 cursor-pointer rounded-xl whitespace-nowrap flex-nowrap justify-center"
              >
                Activate Account & Join
              </Button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Already registered? Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: STANDARD SIGN IN                                                   */}
          {/* ========================================================================= */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-2.5">
              {/* Email Field */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5"
                >
                  Work Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
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
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-0.5"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
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
                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-700/90 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={loading}
                rightIcon={<ArrowRight className="w-4 h-4 shrink-0" />}
                className="w-full mt-1.5 font-black tracking-wider uppercase text-xs py-2.5 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 cursor-pointer rounded-xl whitespace-nowrap flex-nowrap justify-center"
              >
                Sign In to Portal
              </Button>

              {/* Compact Navigation Action Links */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => switchMode('setup')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>New company or organization? Register here</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('invite')}
                  className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3 text-emerald-400" />
                  <span>Have an invitation token? Activate account</span>
                </button>
              </div>

              {/* Organization Role Quick Access */}
              <div className="mt-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Quick Role Access
                  </p>
                  <span className="text-[9px] text-slate-500 font-medium">
                    Click to sign in by role
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickDemo('deveshpatel@gmail.com', 'password123')}
                    title="Org Admin (Devesh Patel)"
                    className="px-2 py-1.5 text-[10px] font-bold bg-slate-800/90 hover:bg-blue-600/30 hover:border-blue-500/80 border border-slate-700/70 rounded-lg text-slate-200 hover:text-white transition-all text-center truncate cursor-pointer shadow-xs active:scale-95"
                  >
                    Org Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemo('viren@gmail.com', 'password123')}
                    title="Project Manager (Viren Prajapati)"
                    className="px-2 py-1.5 text-[10px] font-bold bg-slate-800/90 hover:bg-blue-600/30 hover:border-blue-500/80 border border-slate-700/70 rounded-lg text-slate-200 hover:text-white transition-all text-center truncate cursor-pointer shadow-xs active:scale-95"
                  >
                    Project Mgr
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemo('sitemanager@buildsphere.com', 'password123')}
                    title="Site Manager (Site Operations & DPR)"
                    className="px-2 py-1.5 text-[10px] font-bold bg-slate-800/90 hover:bg-blue-600/30 hover:border-blue-500/80 border border-slate-700/70 rounded-lg text-slate-200 hover:text-white transition-all text-center truncate cursor-pointer shadow-xs active:scale-95"
                  >
                    Site Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemo('viren@buildsphere.com', 'password123')}
                    title="Site Engineer (Field Engineering)"
                    className="px-2 py-1.5 text-[10px] font-bold bg-slate-800/90 hover:bg-blue-600/30 hover:border-blue-500/80 border border-slate-700/70 rounded-lg text-slate-200 hover:text-white transition-all text-center truncate cursor-pointer shadow-xs active:scale-95"
                  >
                    Site Eng
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemo('san@gmail.com', 'password123')}
                    title="Accountant (Sankalp - Finance & Ledger)"
                    className="px-2 py-1.5 text-[10px] font-bold bg-slate-800/90 hover:bg-blue-600/30 hover:border-blue-500/80 border border-slate-700/70 rounded-lg text-slate-200 hover:text-white transition-all text-center truncate cursor-pointer shadow-xs active:scale-95"
                  >
                    Accountant
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemo('labour@buildsphere.com', 'password123')}
                    title="Labour / Employee (Darshil - Karigar)"
                    className="px-2 py-1.5 text-[10px] font-bold bg-slate-800/90 hover:bg-blue-600/30 hover:border-blue-500/80 border border-slate-700/70 rounded-lg text-slate-200 hover:text-white transition-all text-center truncate cursor-pointer shadow-xs active:scale-95"
                  >
                    Labour / Emp
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Secure System Notice */}
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-center">
            <p className="text-[10px] text-slate-500 font-medium">
              Enterprise Multi-Tenant Role-Based Access Control
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
