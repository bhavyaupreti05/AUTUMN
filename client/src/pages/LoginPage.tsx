import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationSuccess = (location.state as { success?: string } | null)?.success;

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (!isLogin) {
        const res = await fetch('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.detail || 'Registration failed');
        }
        
        setSuccess('Registration successful! Your account is pending admin approval.');
        setIsLogin(true);
        setIsLoading(false);
        return;
      }

      // Login Logic
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const res = await fetch('/auth/login', {
        credentials: "include",
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || 'Invalid username or password');
      }

      await login();
      navigate('/'); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

// ... (in the component)

  const handleForgotPassword = async () => {
    if (!username) {
      setError('Please enter your username first to request a password reset.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch('/auth/forgot-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      if (!res.ok) {
        throw new Error('Failed to request password reset');
      }
      
      setSuccess('If the account exists, the administrator has been notified of your password reset request.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden text-white">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-[#8B2BFF] opacity-15 blur-[140px] pointer-events-none rounded-full" />
      
      <div className="w-full max-w-[420px] flex flex-col items-center text-center relative z-10 my-8">
        {/* Logo Badge */}
        <div className="relative mb-5 group">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-[#8B2BFF] to-[#601AB8] opacity-50 blur-lg group-hover:opacity-80 transition-opacity" />
          <div className="relative w-16 h-16 rounded-2xl bg-[#0D0D14] border border-[#8B2BFF]/50 shadow-[0_0_25px_rgba(139,43,255,0.3)] flex items-center justify-center p-2">
            <div className="w-5 h-5 rounded-full bg-[#8B2BFF] shadow-[0_0_12px_#8B2BFF] animate-pulse" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
          Welcome to <span className="text-[#8B2BFF] drop-shadow-[0_0_20px_rgba(139,43,255,0.4)]">Autumn</span>
        </h1>
        <p className="text-zinc-400 text-xs sm:text-sm mb-6">Personal AI Operating System</p>
        
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <div className="bg-[#0D0D14] border border-white/5 py-1 px-3 rounded-full text-[0.72rem] font-medium text-zinc-300 flex items-center gap-1.5 shadow-xs">
            <Lock size={12} className="text-[#8B2BFF]" />
            <span>Secure Enterprise Access</span>
          </div>
          <div className="bg-[#0D0D14] border border-white/5 py-1 px-3 rounded-full text-[0.72rem] font-medium text-zinc-300 flex items-center gap-1.5 shadow-xs">
            <Shield size={12} className="text-[#8B2BFF]" />
            <span>Cloud & Local Intelligence</span>
          </div>
        </div>

        <div className="bg-[#0B0B10] p-6 sm:p-7 rounded-2xl border border-[#8B2BFF]/30 shadow-[0_20px_60px_rgba(0,0,0,0.85)] w-full text-left text-white">
          {error && (
            <div className="bg-red-500/10 text-red-400 p-3 rounded-xl mb-4 text-xs font-medium border border-red-500/25 text-center">
              {error}
            </div>
          )}
          {(success || locationSuccess) && (
            <div className="bg-[#8B2BFF]/15 text-[#A75BFF] p-3 rounded-xl mb-4 text-xs font-medium border border-[#8B2BFF]/30 text-center">
              {success || locationSuccess}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1 px-0.5">Username / Email</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-black text-white border border-white/10 rounded-xl py-2.5 px-3.5 text-[0.92rem] focus:outline-none focus:border-[#8B2BFF] focus:ring-1 focus:ring-[#8B2BFF] transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1 px-0.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-black text-white border border-white/10 rounded-xl py-2.5 pl-3.5 pr-10 text-[0.92rem] focus:outline-none focus:border-[#8B2BFF] focus:ring-1 focus:ring-[#8B2BFF] transition-all"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((previous) => !previous)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#8B2BFF] via-[#7B1FFF] to-[#581C87] hover:brightness-110 active:scale-[0.99] text-white font-semibold py-2.5 px-4 rounded-xl transition-all mt-4 flex justify-center items-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(139,43,255,0.35)] cursor-pointer border border-[#A75BFF]/30 text-[0.92rem]"
            >
              {isLoading ? 'Processing...' : (isLogin ? 'Log In' : 'Create Account')}
            </button>
          </form>

          {isLogin && (
            <div className="mt-4 flex flex-col items-center gap-2.5">
              <button type="button" onClick={handleForgotPassword} className="text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer border-none bg-transparent">
                Forgot your password?
              </button>
              <button 
                type="button" 
                onClick={() => navigate('/admin-recovery')} 
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--error)] uppercase font-semibold tracking-wider transition-colors cursor-pointer border-none bg-transparent"
                title="Only for System Administrators"
              >
                Emergency Admin Recovery
              </button>
            </div>
          )}

          <div className="mt-4 pt-3.5 border-t border-[var(--border-subtle)] text-center">
            <button 
              type="button" 
              onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }} 
              className="text-[var(--text-secondary)] hover:text-[var(--accent)] text-xs font-medium transition-colors cursor-pointer border-none bg-transparent"
            >
              {isLogin ? "Need an account? Request Access" : "Already have an account? Log in"}
            </button>
          </div>
          {!isLogin && (
            <p className="mt-2 text-center text-[0.72rem] text-[var(--text-muted)]">
              Password requirements: 10+ characters, at most 72 UTF-8 bytes.
            </p>
          )}
        </div>
      </div>
      
      <div className="mt-auto pb-4 text-center text-[0.72rem] text-[var(--text-muted)] relative z-10">
        <span className="font-semibold text-[var(--accent)]">Autumn AI</span> <span className="opacity-60">• Local, Private, Resilient</span>
      </div>
    </div>
  );
}
