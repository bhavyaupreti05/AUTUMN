import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const hashToken = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (hashToken) {
      sessionStorage.setItem('password_reset_token', hashToken);
      setToken(hashToken);
    } else if (!token) {
      setToken(sessionStorage.getItem('password_reset_token') || '');
    }
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('Passwords do not match');
      return;
    }
    if (new TextEncoder().encode(password).length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('Password must be at most 72 UTF-8 bytes.');
      return;
    }
    if (!token) {
      setError('This reset link is missing or invalid. Ask your administrator for a new link.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Invalid or expired reset link');
      }
      sessionStorage.removeItem('password_reset_token');
      navigate('/login', { state: { success: 'Password reset successfully. You can now log in.' } });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] bg-[var(--bg-surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-2 mb-5"><Lock size={18} className="text-[var(--accent)]" /><h1 className="text-xl font-semibold">Set a new password</h1></div>
        {error && <div className="mb-4 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--error)_20%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-3 text-center text-sm text-[var(--error)]">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 pr-11 text-[var(--text-primary)]" required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <input type={showPassword ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirm new password" className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)]" required />
          <p className="text-xs text-[var(--text-muted)]">Use 10+ characters, at most 72 UTF-8 bytes. Avoid your username and common passwords.</p>
          <button type="submit" disabled={isLoading} className="w-full rounded-[var(--radius-md)] bg-[var(--accent)] p-3 font-medium text-white disabled:opacity-50">{isLoading ? 'Processing...' : 'Reset password'}</button>
        </form>
      </div>
    </div>
  );
}