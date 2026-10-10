import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';

export function AdminRecoveryPage() {
  const navigate = useNavigate();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    if (!recoveryKey.trim()) {
      setError('Recovery key is required.');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('/auth/admin-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recovery_key: recoveryKey, new_password: password }),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Invalid recovery key');
      }
      
      navigate('/login', { state: { success: 'Admin password recovered successfully. You can now log in.' } });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to recover password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] bg-[var(--bg-surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert size={18} className="text-[var(--error)]" />
          <h1 className="text-xl font-semibold">Admin Password Recovery</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          Enter the recovery key found in your server's <code className="bg-[var(--bg-primary)] px-1 rounded">.env</code> file.
        </p>
        
        {error && <div className="mb-4 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--error)_20%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-3 text-center text-sm text-[var(--error)]">{error}</div>}
        
        <form onSubmit={submit} className="space-y-4">
          <input 
            type="text" 
            value={recoveryKey} 
            onChange={(event) => setRecoveryKey(event.target.value)} 
            placeholder="Recovery Key (e.g. TRPW-XXXX-XXXX-XXXX)" 
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] font-mono text-sm uppercase" 
            required 
          />
          
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password} 
              onChange={(event) => setPassword(event.target.value)} 
              placeholder="New Admin Password" 
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 pr-11 text-[var(--text-primary)]" 
              required 
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          <input 
            type={showPassword ? 'text' : 'password'} 
            value={confirmation} 
            onChange={(event) => setConfirmation(event.target.value)} 
            placeholder="Confirm new password" 
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)]" 
            required 
          />
          
          <p className="text-xs text-[var(--text-muted)]">Use 10+ characters, at most 72 UTF-8 bytes.</p>
          
          <button type="submit" disabled={isLoading} className="w-full rounded-[var(--radius-md)] bg-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_80%,black)] transition-colors p-3 font-medium text-white disabled:opacity-50 mt-2">
            {isLoading ? 'Processing...' : 'Recover Admin Account'}
          </button>
          
          <div className="mt-4 text-center">
            <button type="button" onClick={() => navigate('/login')} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              Return to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
