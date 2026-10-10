import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const [username, setUsername] = useState('bhavya05@mail.com');
  const [password, setPassword] = useState('12345');
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
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-[var(--accent)] opacity-10 blur-[120px] pointer-events-none rounded-full" />
      
      <div className="w-full max-w-[420px] flex flex-col items-center text-center relative z-10 my-8">
        {/* Logo Badge */}
        <div className="relative mb-4 group">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-[var(--accent)] to-[#FFA770] opacity-35 blur-md group-hover:opacity-60 transition-opacity" />
          <div className="relative w-20 h-20 rounded-2xl bg-[var(--bg-surface)] border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] shadow-xl flex items-center justify-center p-2 overflow-hidden">
            <img src="/logo.png" alt="Autumn Logo" className="w-full h-full rounded-xl object-cover" />
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-1.5">
          Welcome to <span className="bg-gradient-to-r from-[var(--accent)] to-[#FFA770] bg-clip-text text-transparent">Autumn</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-[0.88rem] mb-6">Private, on-device intelligence</p>
        
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] py-1 px-3 rounded-full text-[0.75rem] font-medium text-[var(--text-secondary)] flex items-center gap-1.5 shadow-xs">
            <Lock size={12} className="text-[var(--accent)]" />
            <span>Secure Access</span>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] py-1 px-3 rounded-full text-[0.75rem] font-medium text-[var(--text-secondary)] flex items-center gap-1.5 shadow-xs">
            <Shield size={12} className="text-[var(--accent)]" />
            <span>100% Local & Private</span>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)]/90 backdrop-blur-xl p-6 sm:p-7 rounded-2xl border border-[var(--border-subtle)] shadow-[0_12px_40px_rgba(0,0,0,0.18)] w-full text-left">
          {error && (
            <div className="bg-[rgba(239,68,68,0.1)] text-[var(--error)] p-3 rounded-xl mb-4 text-xs font-medium border border-[rgba(239,68,68,0.25)] text-center">
              {error}
            </div>
          )}
          {(success || locationSuccess) && (
            <div className="bg-[var(--accent-muted)] text-[var(--accent)] p-3 rounded-xl mb-4 text-xs font-medium border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] text-center">
              {success || locationSuccess}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 px-0.5">Username / Email</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl py-2.5 px-3.5 text-[0.92rem] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 px-0.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl py-2.5 pl-3.5 pr-10 text-[0.92rem] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((previous) => !previous)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="pt-0.5 flex items-center justify-between gap-2">
                <span className="text-[0.72rem] text-[var(--text-muted)] font-medium">Quick Login:</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setUsername('bhavya05@mail.com');
                      setPassword('12345');
                    }}
                    className={`text-[0.72rem] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      username === 'bhavya05@mail.com'
                        ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)] font-semibold'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                    }`}
                  >
                    👑 Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername('testuser@autumn.ai');
                      setPassword('12345');
                    }}
                    className={`text-[0.72rem] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      username === 'testuser@autumn.ai'
                        ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)] font-semibold'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                    }`}
                  >
                    🧪 Tester
                  </button>
                </div>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isLoading}
              style={{ background: 'var(--energy-gradient)' }}
              className="w-full hover:brightness-110 active:scale-[0.99] text-white font-semibold py-2.5 px-4 rounded-xl transition-all mt-4 flex justify-center items-center gap-2 disabled:opacity-50 shadow-md cursor-pointer border-none text-[0.92rem]"
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
