import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Users, MessageSquare, Activity, Database, Check, X, Shield, ShieldOff, UserX, KeyRound, Eye, EyeOff, Loader2, Search, Copy, WandSparkles } from 'lucide-react';
import { useAdminUsers, useAdminAnalytics, useAdminFeedback, useAdminLearningInsights, useAdminSuggestions } from '../hooks/useAdmin';
import type { AdminUser } from '../hooks/useAdmin';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend } from 'recharts';
import { useState, useEffect } from 'react';
import { useUserConversations } from '../hooks/useAdmin';
import { useAuth } from '../contexts/AuthContext';
import { copyText } from '../utils/copy';
import { CustomBotsPage } from './CustomBotsPage';

export function LegacyTemporaryUserGenerator() {
  const [isOpen, setIsOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [credentials, setCredentials] = useState<{ username: string; password: string; expires_at: string } | null>(null);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setCredentials(null); setIsGenerating(true);
    try {
      const response = await fetch('/auth/admin/users/generate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain, duration_minutes: Number(durationMinutes) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Could not generate temporary user');
      setCredentials(data);
    } catch (generationError) { setError(generationError instanceof Error ? generationError.message : 'Could not generate temporary user'); }
    finally { setIsGenerating(false); }
  };

  const copyCredential = async (value: string) => { await copyText(value); };

  return <>
    <button type="button" onClick={() => { setIsOpen(true); setCredentials(null); setError(''); }} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"><WandSparkles size={15} />Generate temporary login</button>
    {isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setIsOpen(false)}><div role="dialog" aria-modal="true" aria-label="Generate temporary login" className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-[var(--text-primary)]">Generate temporary login</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Create an approved account that expires at the time you choose.</p></div><button type="button" onClick={() => setIsOpen(false)} aria-label="Close" className="p-2 text-[var(--text-muted)]">×</button></div>
      {error && <div className="mt-4 rounded-[var(--radius-md)] border border-[rgba(250,82,82,0.35)] bg-[rgba(250,82,82,0.1)] p-3 text-sm text-[var(--error)]">{error}</div>}
      {!credentials ? <form onSubmit={generate} className="mt-5 space-y-4"><label className="block text-sm font-medium text-[var(--text-primary)]">Email domain<input required value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /><span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">The server will generate a unique address on this domain.</span></label><label className="block text-sm font-medium text-[var(--text-primary)]">Login available for<input required type="number" min="5" max="43200" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /><span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">5 minutes to 30 days. Expiry is enforced at login.</span></label><button type="submit" disabled={isGenerating} className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isGenerating ? 'Generating...' : 'Generate credentials'}</button></form> : <div className="mt-5 space-y-3"><div className="rounded-[var(--radius-md)] border border-[rgba(234,166,85,0.4)] bg-[rgba(234,166,85,0.08)] p-4 text-sm text-[var(--text-primary)]"><p className="font-semibold text-[var(--accent)]">Copy these credentials now</p><p className="mt-1 text-xs text-[var(--text-secondary)]">The password will not be shown again after closing this dialog.</p>{[['Email', credentials.username], ['Password', credentials.password], ['Expires', new Date(credentials.expires_at).toLocaleString()]].map(([label, value]) => <div key={label} className="mt-3 flex items-center gap-2"><span className="w-20 shrink-0 text-xs text-[var(--text-muted)]">{label}</span><code className="min-w-0 flex-1 break-all text-sm">{value}</code>{label !== 'Expires' && <button type="button" title={`Copy ${label}`} onClick={() => copyCredential(value)} className="p-1.5 text-[var(--accent)]"><Copy size={15} /></button>}</div>)}</div><button type="button" onClick={() => setIsOpen(false)} className="w-full rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white">Done</button></div>}
    </div></div>}
  </>;
}

function ClearTemporaryUserGenerator() {
  const [isOpen, setIsOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [durationValue, setDurationValue] = useState('1');
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const [credentials, setCredentials] = useState<{ username: string; password: string; expires_at: string } | null>(null);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const cleanDomain = domain.trim().toLowerCase().replace(/^@/, '').replace(/\.+$/, '');
  const multiplier = durationUnit === 'minutes' ? 1 : durationUnit === 'hours' ? 60 : 1440;
  const totalMinutes = Number(durationValue) * multiplier;
  const previewEmail = cleanDomain ? `guest-xxxx@${cleanDomain}` : 'guest-xxxx@example.com';

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setCredentials(null); setIsGenerating(true);
    try {
      const response = await fetch('/auth/admin/users/generate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: cleanDomain, duration_minutes: totalMinutes }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Could not generate temporary login');
      setCredentials(data);
    } catch (generationError) { setError(generationError instanceof Error ? generationError.message : 'Could not generate temporary login'); }
    finally { setIsGenerating(false); }
  };

  return <>
    <button type="button" onClick={() => { setIsOpen(true); setCredentials(null); setError(''); }} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"><WandSparkles size={15} />Generate temporary login</button>
    {isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setIsOpen(false)}><div role="dialog" aria-modal="true" aria-label="Generate temporary login" className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-[var(--text-primary)]">Generate temporary login</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Create a time-limited login for a user on a domain you control.</p></div><button type="button" onClick={() => setIsOpen(false)} aria-label="Close" className="p-2 text-[var(--text-muted)]">×</button></div>
      {error && <div className="mt-4 rounded-[var(--radius-md)] border border-[rgba(250,82,82,0.35)] bg-[rgba(250,82,82,0.1)] p-3 text-sm text-[var(--error)]">{error}</div>}
      {!credentials ? <form onSubmit={generate} className="mt-5 space-y-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Generated login preview</p><p className="mt-1 font-mono text-sm text-[var(--accent)]">{previewEmail}</p><p className="mt-1 text-xs text-[var(--text-muted)]">This is a login ID format, not a real mailbox.</p></div>
        <label className="block text-sm font-medium text-[var(--text-primary)]">Email domain <span className="text-[var(--error)]">*</span><div className="mt-2 flex items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] focus-within:border-[var(--accent)]"><span className="pl-3 text-[var(--text-muted)]">@</span><input required value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="company.com" className="min-w-0 flex-1 bg-transparent p-3 pl-1 text-[var(--text-primary)] outline-none" /></div><span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">Enter only the domain, without `@`, for example `company.com`.</span></label>
        <div><label className="block text-sm font-medium text-[var(--text-primary)]">Login available for <span className="text-[var(--error)]">*</span></label><div className="mt-2 grid grid-cols-[1fr_1fr] gap-2"><input required type="number" min="1" value={durationValue} onChange={(event) => setDurationValue(event.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /><select value={durationUnit} onChange={(event) => setDurationUnit(event.target.value as typeof durationUnit)} className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div><p className="mt-1 text-xs text-[var(--text-muted)]">Account expires after {Number.isFinite(totalMinutes) ? `${durationValue} ${durationUnit}` : 'the selected duration'} and cannot log in afterward.</p></div>
        <button type="submit" disabled={isGenerating || !cleanDomain || !Number.isFinite(totalMinutes) || totalMinutes < 5 || totalMinutes > 43200} className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isGenerating ? 'Generating...' : 'Generate credentials'}</button>
      </form> : <div className="mt-5 space-y-3"><div className="rounded-[var(--radius-md)] border border-[rgba(234,166,85,0.4)] bg-[rgba(234,166,85,0.08)] p-4 text-sm text-[var(--text-primary)]"><p className="font-semibold text-[var(--accent)]">Credentials generated</p><p className="mt-1 text-xs text-[var(--text-secondary)]">Copy the email and password now. The password will not be shown again after closing.</p>{[['Email', credentials.username], ['Password', credentials.password], ['Expires', new Date(credentials.expires_at).toLocaleString()]].map(([label, value]) => <div key={label} className="mt-3 flex items-center gap-2"><span className="w-20 shrink-0 text-xs text-[var(--text-muted)]">{label}</span><code className="min-w-0 flex-1 break-all text-sm">{value}</code>{label !== 'Expires' && <button type="button" title={`Copy ${label}`} onClick={() => copyText(value)} className="p-1.5 text-[var(--accent)]"><Copy size={15} /></button>}</div>)}</div><button type="button" onClick={() => setIsOpen(false)} className="w-full rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white">Done</button></div>}
    </div></div>}
  </>;
}

export function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'bots' | 'security'>('overview');
  const [activeUserTab, setActiveUserTab] = useState<'active' | 'pending' | 'temporary' | 'resets'>('active');
  const [activeAnalyticsPage, setActiveAnalyticsPage] = useState<'summary' | 'feedback' | 'suggestions' | 'learning' | 'engagement' | 'content'>('summary');
  const [range, setRange] = useState<'hourly' | 'daily' | 'monthly' | 'yearly'>('daily');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [activeUserSearch, setActiveUserSearch] = useState('');
  const [resetLink, setResetLink] = useState<{ token: string; expires_at: string } | null>(null);
  const [resetLinkCopied, setResetLinkCopied] = useState(false);
  const [resetError, setResetError] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const { userId } = useAuth();

  const { data, isLoading, error, refetch } = useAdminAnalytics(range);
  const { data: feedbackItems = [], isLoading: isFeedbackLoading } = useAdminFeedback();
  const { data: suggestions = [], isLoading: isSuggestionsLoading } = useAdminSuggestions();
  const { data: learningInsights, isLoading: isLearningLoading, isError: isLearningError } = useAdminLearningInsights();

  const {
    pendingUsers,
    activeUsers,
    resetRequests,
    isLoading: isLoadingUsers,
    approveUser,
    rejectUser,
    promoteUser,
    demoteUser,
    deactivateUser,
    issueResetToken,
    resolveResetRequest,
    extendUserExpiry,
    isIssuingResetToken,
    errors,
    clearErrors
  } = useAdminUsers();

  const issueReset = async () => {
    if (!resetUser) return;
    setResetError('');
    try {
      setResetLink(await issueResetToken({ userId: resetUser.id, adminPassword }));
      setResetLinkCopied(false);
      setAdminPassword('');
      setShowAdminPassword(false);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Unable to issue reset link');
    }
  };

  useEffect(() => {
    if (activeTab === 'security' && !recoveryKey) {
      fetch('/auth/admin/recovery-key', { credentials: 'include' })
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(data => setRecoveryKey(data.recovery_key))
        .catch(err => {
          console.error(err);
          setRecoveryKey('Error fetching key');
        });
    }
  }, [activeTab, recoveryKey]);

  const copyResetLink = async () => {
    if (!resetLink) return;
    try {
      await copyText(`${window.location.origin}/reset-password#token=${resetLink.token}`);
      setResetLinkCopied(true);
      setResetError('');
    } catch {
      setResetError('Copy failed. Select the link and copy it manually.');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-4">
        <div className="bg-[var(--bg-surface)] p-8 rounded-[var(--radius-lg)] border border-[rgba(250,82,82,0.3)] text-center max-w-md w-full">
          <div className="text-[var(--error)] mb-4 flex justify-center">
            <Activity size={48} />
          </div>
          <h2 className="text-[var(--text-primary)] text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-[var(--text-secondary)] mb-6">
            {(error as Error).message}
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => refetch()}
              className="bg-[var(--bg-surface-hover)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] px-4 py-2 rounded-[var(--radius-md)] transition-colors inline-flex items-center gap-2"
            >
              Retry
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-[var(--radius-md)] transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Return to Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  const summary = data?.summary || { total_users: 0, total_conversations: 0, total_messages: 0, active_today: 0 };
  const topDocuments = data?.top_documents || [];
  const regularActiveUsers = activeUsers.filter((user) => !user.expires_at && !user.username.startsWith('guest-'));
  const temporaryActiveUsers = activeUsers.filter((user) => user.expires_at || user.username.startsWith('guest-'));

  const filteredRegularUsers = regularActiveUsers.filter((user) =>
    user.username.toLowerCase().includes(activeUserSearch.trim().toLowerCase())
  );
  
  const filteredTemporaryUsers = temporaryActiveUsers.filter((user) =>
    user.username.toLowerCase().includes(activeUserSearch.trim().toLowerCase())
  );

  const volume = data?.volume || [];
  const trending = data?.trending || [];
  const topUsers = data?.top_users || [];

  const userWiseData = (() => {
    const dates = new Set<string>();
    topUsers.forEach((u: any) => u.sparkline?.forEach((s: any) => dates.add(s.date)));
    
    const sortedDates = Array.from(dates).sort();
    return sortedDates.map(date => {
      const point: any = { date };
      topUsers.forEach((u: any) => {
        const match = u.sparkline?.find((s: any) => s.date === date);
        point[u.username] = match ? match.count : 0;
      });
      return point;
    });
  })();

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-6 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="w-full max-w-6xl mx-auto space-y-8">
        
        {selectedUser ? (
          <UserProfileView user={selectedUser} onBack={() => setSelectedUser(null)} range={range} setRange={setRange} />
        ) : (
          <>
            {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin Dashboard</h1>
            <p className="text-[var(--text-secondary)] mt-1">System analytics and user management</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] px-4 py-2 rounded-[var(--radius-md)] transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Chat
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-4 py-2 font-medium transition-all ${activeTab === 'bots' ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-md shadow-[color-mix(in_srgb,var(--accent)_25%,transparent)]' : 'border-[color-mix(in_srgb,var(--accent)_45%,var(--border-subtle))] bg-[var(--bg-surface)] text-[var(--accent)] hover:-translate-y-0.5 hover:bg-[var(--bg-surface-hover)] hover:shadow-md'}`}
            onClick={() => setActiveTab('bots')}
            title="Open Custom Bots"
          >
            <Bot size={17} />
            Custom Bots
          </button>
          <ClearTemporaryUserGenerator />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] gap-6">
          <button
            className={`pb-3 font-medium transition-colors border-b-2 ${activeTab === 'overview' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview & Analytics
          </button>
          <button
            className={`pb-3 font-medium transition-colors border-b-2 ${activeTab === 'users' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            onClick={() => setActiveTab('users')}
          >
            User Management {pendingUsers.length > 0 && <span className="ml-2 bg-[var(--accent)] text-white text-xs px-2 py-0.5 rounded-full">{pendingUsers.length}</span>}
          </button>
          <button
            className={`pb-3 font-medium transition-colors border-b-2 ${activeTab === 'security' ? 'border-[var(--error)] text-[var(--error)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            onClick={() => setActiveTab('security')}
          >
            Security
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="flex flex-wrap gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2">
            {([
              ['summary', 'Summary'],
              ['feedback', 'Train the AI Model'],
              ['suggestions', 'Bugs & Problems'],
              ['learning', 'Learning Signals'],
              ['engagement', 'Engagement'],
              ['content', 'Content Insights'],
            ] as const).map(([page, label]) => (
              <button
                key={page}
                type="button"
                onClick={() => setActiveAnalyticsPage(page)}
                className={`rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors ${activeAnalyticsPage === page ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeAnalyticsPage === 'summary' && <div className="space-y-8">
            {/* Range Selector */}
            <div className="flex justify-end">
              <div className="flex bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-1">
                {(['hourly', 'daily', 'monthly', 'yearly'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-sm capitalize transition-colors ${range === r ? 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {isLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="bg-[var(--bg-surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] animate-pulse h-28" />
                ))
              ) : (
                <>
                  <StatCard icon={<Users size={18} className="text-[var(--accent)]" />} title="Total Users" value={summary.total_users} />
                  <StatCard icon={<Database size={18} className="text-[var(--accent)]" />} title="Conversations" value={summary.total_conversations} />
                  <StatCard icon={<MessageSquare size={18} className="text-[var(--accent)]" />} title="Messages" value={summary.total_messages} />
                  <StatCard icon={<Activity size={18} className="text-[var(--accent)]" />} title="Active Today" value={summary.active_today} />
                </>
              )}
            </div>

            </div>}

            {activeAnalyticsPage === 'feedback' && <section className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Train the AI Model</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Review weak answers and provide corrections to train the AI.</p>
                </div>
                <span className="rounded-full bg-[var(--bg-surface-hover)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">{feedbackItems.length} recent</span>
              </div>
              {isFeedbackLoading ? (
                <div className="h-20 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-surface-hover)]" />
              ) : feedbackItems.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No answer feedback has been submitted yet.</p>
              ) : (
                <div className="space-y-4">
                  {feedbackItems.slice(0, 8).map((item: any) => (
                    <div key={`${item.message_id}-${item.created_at}`} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-0 overflow-hidden shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center justify-center rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${item.rating === 'positive' ? 'bg-[rgba(76,175,80,0.1)] text-[var(--success)]' : 'bg-[rgba(250,82,82,0.1)] text-[var(--error)]'}`}>
                            {item.rating}
                          </span>
                          <span className="text-xs font-medium text-[var(--text-secondary)]">by {item.username || 'Unknown user'}</span>
                        </div>
                      </div>
                      
                      <div className="p-4 space-y-4">
                        <div className="flex gap-3">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-xs text-[var(--text-primary)]">
                            <MessageSquare size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">User Question</p>
                            <p className="text-sm font-medium text-[var(--text-primary)]">{item.question || 'Question unavailable'}</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3 rounded-[var(--radius-md)] bg-[rgba(250,82,82,0.03)] p-3 border border-[rgba(250,82,82,0.1)]">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(250,82,82,0.1)] text-xs text-[var(--error)]">
                            <Bot size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--error)] opacity-80 mb-1">Original Bot Answer (Flagged)</p>
                            <p className="text-sm text-[var(--text-secondary)] line-clamp-3">{item.answer}</p>
                          </div>
                        </div>
                        
                        {item.resolution_note && (
                          <div className="flex gap-3 rounded-[var(--radius-md)] bg-[rgba(76,175,80,0.05)] p-3 border border-[rgba(76,175,80,0.2)]">
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(76,175,80,0.15)] text-xs text-[var(--success)]">
                              <Check size={14} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--success)] opacity-90 mb-1">New Training Data (Provided by User)</p>
                              <p className="text-sm font-medium text-[var(--text-primary)]">{item.resolution_note}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>}

            {activeAnalyticsPage === 'suggestions' && <section className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6">
              <div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-[var(--text-primary)]">Bugs & Problems</h3><p className="text-sm text-[var(--text-secondary)]">Review issues and bugs reported by users.</p></div><span className="rounded-full bg-[var(--bg-surface-hover)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">{suggestions.length} recent</span></div>
              {isSuggestionsLoading ? (
                <div className="h-20 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-surface-hover)]" />
              ) : suggestions.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No user suggestions have been submitted yet.</p>
              ) : (
                <div className="space-y-4">
                  {suggestions.slice(0, 8).map((item: any) => {
                    const isAiTraining = item.category === 'AI Training Rule';
                    
                    return (
                      <div key={item.id} className={`rounded-[var(--radius-lg)] border p-4 ${isAiTraining ? 'border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.03)]' : 'border-[var(--border-subtle)] bg-[var(--bg-primary)]'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3 mb-3 border-opacity-50">
                          <div className="flex items-center gap-2">
                            <span className={`flex items-center justify-center rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${isAiTraining ? 'bg-[rgba(76,175,80,0.15)] text-[var(--success)]' : 'bg-[var(--bg-surface-hover)] text-[var(--accent)]'}`}>
                              {isAiTraining ? <><WandSparkles size={10} className="mr-1" /> GLOBAL AI RULE</> : item.category}
                            </span>
                            <span className="text-xs font-medium text-[var(--text-secondary)]">by {item.username || 'Unknown user'}</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${isAiTraining ? 'bg-[rgba(76,175,80,0.1)] text-[var(--success)]' : 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)]'}`}>
                            {isAiTraining ? <Bot size={14} /> : <MessageSquare size={14} />}
                          </div>
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wider opacity-80 mb-1 ${isAiTraining ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                              {isAiTraining ? 'Actively Training AI Models' : 'User Input'}
                            </p>
                            <p className="whitespace-pre-wrap text-sm font-medium text-[var(--text-primary)]">
                              {item.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>}

            {activeAnalyticsPage === 'learning' && <section className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6">
              <div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-[var(--text-primary)]">Learning Signals</h3><p className="text-sm text-[var(--text-secondary)]">Measured interaction patterns used to prioritize verified improvements.</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${isLearningError ? 'bg-[rgba(250,82,82,0.1)] text-[var(--error)]' : 'bg-[rgba(76,175,80,0.1)] text-[var(--success)]'}`}>{isLearningError ? 'Unavailable' : isLearningLoading ? 'Loading' : 'Live tracking active'}</span></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-[var(--radius-md)] bg-[var(--bg-primary)] p-3"><p className="text-xs text-[var(--text-muted)]">Repeated questions</p><p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{learningInsights?.repeated_questions?.length ?? 0}</p></div><div className="rounded-[var(--radius-md)] bg-[var(--bg-primary)] p-3"><p className="text-xs text-[var(--text-muted)]">Pending weak answers</p><p className="mt-1 text-xl font-bold text-[var(--error)]">{learningInsights?.pending_negative_feedback ?? 0}</p></div><div className="rounded-[var(--radius-md)] bg-[var(--bg-primary)] p-3"><p className="text-xs text-[var(--text-muted)]">Verified corrections</p><p className="mt-1 text-xl font-bold text-[var(--success)]">{learningInsights?.verified_corrections ?? 0}</p></div></div>
              {learningInsights?.repeated_questions?.length > 0 && <div className="mt-4 space-y-2">{learningInsights.repeated_questions.slice(0, 5).map((item: any) => <div key={item.question} className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-2 text-sm"><span className="truncate text-[var(--text-secondary)]">{item.question}</span><span className="shrink-0 font-semibold text-[var(--accent)]">{item.count}x</span></div>)}</div>}
            </section>}

            {/* Two Side-by-Side YouTube-Style Charts */}
            {activeAnalyticsPage === 'engagement' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">System-Wide Engagement</h3>
                  <p className="text-[var(--text-secondary)] text-sm">Overall volume of messages sent</p>
                </div>
                
                <div className="h-[300px] w-full">
                  {isLoading ? (
                    <div className="w-full h-full animate-pulse bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)]" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={volume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="var(--text-secondary)" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(val) => {
                            if (range === 'hourly') return val.split(' ')[1] || val; 
                            if (range === 'yearly') return val;
                            const d = new Date(val);
                            return isNaN(d.getTime()) ? val : `${d.getMonth() + 1}/${d.getDate()}`;
                          }}
                        />
                        <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                          labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                        />
                        <Area type="monotone" dataKey="messages" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorMessages)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">User-Wise Engagement</h3>
                  <p className="text-[var(--text-secondary)] text-sm">Volume of messages from top users</p>
                </div>
                
                <div className="h-[300px] w-full">
                  {isLoading ? (
                    <div className="w-full h-full animate-pulse bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)]" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={userWiseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="var(--text-secondary)" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(val) => {
                            if (range === 'hourly') return val.split(' ')[1] || val; 
                            if (range === 'yearly') return val;
                            const d = new Date(val);
                            return isNaN(d.getTime()) ? val : `${d.getMonth() + 1}/${d.getDate()}`;
                          }}
                        />
                        <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                          labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                        {topUsers.map((u: any, i: number) => (
                          <Line key={u.username} type="monotone" dataKey={u.username} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>}

            {/* Secondary Grids (Trending/Docs) */}
            {activeAnalyticsPage === 'content' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6">
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Trending Topics</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trending} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                      <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="term" type="category" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} width={80} />
                      <Tooltip 
                        cursor={{ fill: 'var(--bg-surface-hover)' }}
                        contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                      />
                      <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6">
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Top Documents</h3>
                {!topDocuments.length ? (
                  <p className="text-[var(--text-secondary)] text-sm italic">No documents processed yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {topDocuments.map((d: any, idx: number) => (
                      <li key={idx} className="flex justify-between items-center bg-[var(--bg-primary)] px-4 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
                        <span className="font-medium text-[var(--text-primary)] truncate max-w-[200px]" title={d.filename}>{d.filename}</span>
                        <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-surface-hover)] px-2 py-1 rounded-full">{d.count} uses</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="flex flex-wrap gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2">
            {([
              ['active', 'Active Users'],
              ['pending', 'Pending Approvals'],
              ['temporary', 'Temporary Logins'],
              ['resets', 'Password Reset Requests'],
            ] as const).map(([page, label]) => (
              <button
                key={page}
                type="button"
                onClick={() => setActiveUserTab(page)}
                className={`rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors ${activeUserTab === page ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'}`}
              >
                {label}
                {page === 'pending' && pendingUsers.length > 0 && <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeUserTab === page ? 'bg-white text-[var(--accent)]' : 'bg-[var(--accent)] text-white'}`}>{pendingUsers.length}</span>}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {(errors.demote || errors.deactivate) && (
              <div className="bg-[rgba(250,82,82,0.1)] border border-[rgba(250,82,82,0.3)] p-4 rounded-[var(--radius-md)] flex justify-between items-center">
                <span className="text-[var(--error)] text-sm font-medium">{errors.demote || errors.deactivate}</span>
                <button onClick={clearErrors} className="text-[var(--error)] hover:text-white transition-colors p-1"><X size={16} /></button>
              </div>
            )}

            {/* Pending Approvals */}
            {activeUserTab === 'pending' && (
            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] overflow-hidden">
              <div className="bg-[var(--bg-surface-hover)] px-6 py-4 border-b border-[var(--border-subtle)]">
                <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  Pending Approvals
                  {pendingUsers.length > 0 && <span className="bg-[var(--accent)] text-white text-xs px-2 py-0.5 rounded-full">{pendingUsers.length}</span>}
                </h3>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Username</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Joined</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {isLoadingUsers ? (
                      <tr><td colSpan={3} className="px-6 py-4 text-center text-[var(--text-muted)] animate-pulse">Loading users...</td></tr>
                    ) : pendingUsers.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-[var(--text-muted)] italic">No pending user approvals.</td></tr>
                    ) : (
                      pendingUsers.map((user: AdminUser) => (
                        <tr key={user.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                          <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{user.username}</td>
                          <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => approveUser(user.id)} className="bg-[rgba(34,197,94,0.1)] hover:bg-[rgba(34,197,94,0.2)] text-green-500 p-2 rounded-[var(--radius-md)] transition-colors" title="Approve">
                                <Check size={16} />
                              </button>
                              <button onClick={() => rejectUser(user.id)} className="bg-[rgba(250,82,82,0.1)] hover:bg-[rgba(250,82,82,0.2)] text-[var(--error)] p-2 rounded-[var(--radius-md)] transition-colors" title="Reject">
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Active Users */}
            {activeUserTab === 'active' && (
            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] overflow-hidden">
              <div className="bg-[var(--bg-surface-hover)] px-6 py-4 border-b border-[var(--border-subtle)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Active Users</h3>
                  <label className="relative block w-full sm:max-w-xs">
                    <span className="sr-only">Search active users</span>
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="search"
                      value={activeUserSearch}
                      onChange={(event) => setActiveUserSearch(event.target.value)}
                      placeholder="Search users"
                      aria-label="Search active users"
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </label>
                </div>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Username</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Last Login</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {isLoadingUsers ? (
                      <tr><td colSpan={4} className="px-6 py-4 text-center text-[var(--text-muted)] animate-pulse">Loading active users...</td></tr>
                    ) : regularActiveUsers.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-[var(--text-muted)] italic">No active users.</td></tr>
                    ) : filteredRegularUsers.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-[var(--text-muted)] italic">No users match &quot;{activeUserSearch}&quot;.</td></tr>
                    ) : (
                      filteredRegularUsers.map((user: AdminUser) => (
                        <tr key={user.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                          <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{user.username}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${user.is_admin ? 'bg-[rgba(234,166,85,0.1)] text-[var(--accent)] border border-[rgba(234,166,85,0.3)]' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'}`}>
                              {user.is_admin ? 'ADMIN' : 'USER'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{(user.last_login || user.last_active || user.created_at) ? new Date(user.last_login || user.last_active || user.created_at!).toLocaleDateString() : 'Never'}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button onClick={() => setSelectedUser(user)} className="bg-[var(--bg-primary)] hover:bg-[rgba(59,130,246,0.1)] hover:text-blue-500 border border-[var(--border-subtle)] text-[var(--text-secondary)] px-3 py-1.5 rounded-[var(--radius-md)] transition-colors flex items-center gap-1 text-xs font-medium" title="Open user profile">
                                <Eye size={14} /> Profile
                              </button>
                              <button onClick={() => setSelectedUser(user)} className="bg-[var(--bg-primary)] hover:bg-[rgba(59,130,246,0.08)] hover:text-[var(--accent)] border border-[var(--border-subtle)] text-[var(--text-secondary)] px-3 py-1.5 rounded-[var(--radius-md)] transition-colors flex items-center gap-1 text-xs font-medium" title="View user analytics">
                                <Activity size={14} /> Analytics
                              </button>
                              {!user.is_admin ? (
                                <button onClick={() => promoteUser(user.id)} className="bg-[var(--bg-primary)] hover:bg-[rgba(234,166,85,0.1)] hover:text-[var(--accent)] border border-[var(--border-subtle)] text-[var(--text-secondary)] px-3 py-1.5 rounded-[var(--radius-md)] transition-colors flex items-center gap-1 text-xs font-medium" title="Promote to Admin">
                                  <Shield size={14} /> Promote
                                </button>
                              ) : (
                                <button onClick={() => demoteUser(user.id)} className="bg-[var(--bg-primary)] hover:bg-[rgba(250,82,82,0.1)] hover:text-[var(--error)] border border-[var(--border-subtle)] text-[var(--text-secondary)] px-3 py-1.5 rounded-[var(--radius-md)] transition-colors flex items-center gap-1 text-xs font-medium" title="Demote to User">
                                  <ShieldOff size={14} /> Demote
                                </button>
                              )}
                              {!user.is_admin && user.id !== userId && (
                                <button onClick={() => { setResetUser(user); setResetLink(null); setResetLinkCopied(false); setAdminPassword(''); setShowAdminPassword(false); setResetError(''); }} className="bg-[var(--bg-primary)] hover:bg-[rgba(234,166,85,0.1)] hover:text-[var(--accent)] border border-[var(--border-subtle)] text-[var(--text-secondary)] px-3 py-1.5 rounded-[var(--radius-md)] transition-colors flex items-center gap-1 text-xs font-medium" title="Reset password">
                                  <KeyRound size={14} /> Reset
                                </button>
                              )}
                              <button onClick={() => deactivateUser(user.id)} className="bg-[var(--bg-primary)] hover:bg-[rgba(250,82,82,0.1)] hover:text-[var(--error)] border border-[var(--border-subtle)] text-[var(--text-secondary)] px-3 py-1.5 rounded-[var(--radius-md)] transition-colors flex items-center gap-1 text-xs font-medium" title="Deactivate user">
                                <UserX size={14} /> Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Temporary Logins */}
            {activeUserTab === 'temporary' && (
            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] overflow-hidden">
              <div className="bg-[var(--bg-surface-hover)] px-6 py-4 border-b border-[var(--border-subtle)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Temporary Logins</h3>
                  <span className="text-sm font-medium text-[var(--text-secondary)]">{temporaryActiveUsers.length} total generated</span>
                </div>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Username</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Expires At</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {isLoadingUsers ? (
                      <tr><td colSpan={4} className="px-6 py-4 text-center text-[var(--text-muted)] animate-pulse">Loading temporary users...</td></tr>
                    ) : temporaryActiveUsers.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-[var(--text-muted)] italic">No temporary logins generated.</td></tr>
                    ) : filteredTemporaryUsers.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-[var(--text-muted)] italic">No temporary logins match &quot;{activeUserSearch}&quot;.</td></tr>
                    ) : (
                      filteredTemporaryUsers.map((user: AdminUser) => (
                        <tr key={user.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                          <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{user.username}</td>
                          <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{user.expires_at ? new Date(user.expires_at).toLocaleString() : 'Never'}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { const mins = window.prompt('Enter minutes to extend:', '60'); if (mins && !isNaN(Number(mins))) extendUserExpiry({ userId: user.id, durationMinutes: Number(mins) }); }} className="bg-[var(--bg-primary)] hover:bg-[rgba(34,197,94,0.1)] hover:text-green-500 border border-[var(--border-subtle)] text-[var(--text-secondary)] px-3 py-1.5 rounded-[var(--radius-md)] transition-colors inline-flex items-center gap-1 text-xs font-medium" title="Extend expiry">
                                Extend
                              </button>
                              <button onClick={() => deactivateUser(user.id)} className="bg-[var(--bg-primary)] hover:bg-[rgba(250,82,82,0.1)] hover:text-[var(--error)] border border-[var(--border-subtle)] text-[var(--text-secondary)] px-3 py-1.5 rounded-[var(--radius-md)] transition-colors inline-flex items-center gap-1 text-xs font-medium" title="Revoke access">
                                <UserX size={14} /> Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Password Resets */}
            {activeUserTab === 'resets' && (
            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] overflow-hidden">
              <div className="bg-[var(--bg-surface-hover)] px-6 py-4 border-b border-[var(--border-subtle)]">
                <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  Password Reset Requests
                  {resetRequests.length > 0 && <span className="bg-[var(--accent)] text-white text-xs px-2 py-0.5 rounded-full">{resetRequests.length}</span>}
                </h3>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Username</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Requested At</th>
                      <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {isLoadingUsers ? (
                      <tr><td colSpan={3} className="px-6 py-4 text-center text-[var(--text-muted)] animate-pulse">Loading requests...</td></tr>
                    ) : resetRequests.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-[var(--text-muted)] italic">No password reset requests.</td></tr>
                    ) : (
                      resetRequests.map((req: any) => (
                        <tr key={req.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                          <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{req.username}</td>
                          <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{req.reset_requested_at ? new Date(req.reset_requested_at).toLocaleString() : 'N/A'}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setResetUser(req); setResetLink(null); setResetLinkCopied(false); setAdminPassword(''); setShowAdminPassword(false); setResetError(''); }} className="bg-[rgba(59,130,246,0.1)] hover:bg-[rgba(59,130,246,0.2)] text-blue-500 p-2 rounded-[var(--radius-md)] transition-colors" title="Issue Reset Token">
                                <KeyRound size={16} />
                              </button>
                              <button onClick={() => resolveResetRequest(req.id)} className="bg-[rgba(34,197,94,0.1)] hover:bg-[rgba(34,197,94,0.2)] text-green-500 p-2 rounded-[var(--radius-md)] transition-colors" title="Mark Resolved">
                                <Check size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        )}

        {activeTab === 'bots' && <CustomBotsPage />}

        {activeTab === 'security' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] overflow-hidden">
              <div className="bg-[var(--bg-surface-hover)] px-6 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
                <Shield size={20} className="text-[var(--error)]" />
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Admin Account Recovery</h3>
              </div>
              <div className="p-6">
                <p className="text-[var(--text-secondary)] mb-4">
                  If you forget your admin password, you can use the following Recovery Key to reset it from the login screen. 
                  <strong className="text-[var(--error)] ml-1">Do not share this key with anyone.</strong>
                </p>
                
                <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Your Recovery Key:</p>
                    {recoveryKey ? (
                      <code className="text-lg font-mono text-[var(--text-primary)] tracking-wider break-all">
                        {recoveryKey}
                      </code>
                    ) : (
                      <div className="flex items-center gap-2 text-[var(--text-muted)]">
                        <Loader2 size={16} className="animate-spin" /> Fetching key...
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      if (recoveryKey) {
                        copyText(recoveryKey);
                      }
                    }}
                    disabled={!recoveryKey}
                    className="flex-shrink-0 bg-[var(--bg-surface-hover)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors border border-[var(--border-subtle)] px-4 py-2 rounded-[var(--radius-md)] flex items-center gap-2 disabled:opacity-50"
                  >
                    <Copy size={16} />
                    Copy Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

          </>
        )}

        {resetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResetUser(null)}>
            <div role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
              <h2 className="text-lg font-semibold">Reset password for {resetUser.username}</h2>
              {resetError && <p className="mt-3 text-sm text-[var(--error)]">{resetError}</p>}
              {!resetLink ? (
                <>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">Enter your current administrator password, not the target user&apos;s password. The link can be used once and expires in 30 minutes.</p>
                  <div className="relative mt-4">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      placeholder="Your administrator password"
                      autoComplete="current-password"
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 pr-12 text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword((visible) => !visible)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      title={showAdminPassword ? 'Hide administrator password' : 'Show administrator password'}
                      aria-label={showAdminPassword ? 'Hide administrator password' : 'Show administrator password'}
                    >
                      {showAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button type="button" onClick={issueReset} disabled={!adminPassword || isIssuingResetToken} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] p-3 text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {isIssuingResetToken && <Loader2 size={16} className="animate-spin" />}
                    {isIssuingResetToken ? 'Issuing link...' : 'Issue one-time link'}
                  </button>
                </>
              ) : (
                <>
                  <p data-testid="reset-link" className="mt-4 break-all rounded-[var(--radius-md)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">{window.location.origin}/reset-password#token={resetLink.token}</p>
                  <button type="button" onClick={copyResetLink} aria-label={resetLinkCopied ? 'Link copied' : 'Copy link'} className={`mt-3 inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm transition-all active:scale-95 ${resetLinkCopied ? 'border-[rgba(76,175,80,0.45)] bg-[rgba(76,175,80,0.1)] text-[var(--success)]' : 'border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]'}`}><Check size={14} />{resetLinkCopied ? 'Copied' : 'Copy link'}</button>
                  <p className="mt-3 text-xs text-[var(--text-muted)]">Expires {new Date(resetLink.expires_at).toLocaleString()}. This link is shown once.</p>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function UserProfileView({ user, onBack, range, setRange }: { user: AdminUser, onBack: () => void, range: string, setRange: (r: any) => void }) {
  const { data: analytics, isLoading: isAnalyticsLoading } = useAdminAnalytics(range, user.id);
  const { data: convData, isLoading: isConvLoading } = useUserConversations(user.id);
  const [openedConversationId, setOpenedConversationId] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState('');

  const summary = analytics?.summary || { total_conversations: 0, total_messages: 0 };
  const volume = analytics?.volume || [];

  const conversations = convData?.conversations || [];

  const openConversation = async (conversationId: string) => {
    setOpenedConversationId(conversationId);
    setConversationLoading(true);
    setConversationError('');

    try {
      const response = await fetch(`/auth/admin/conversations/${conversationId}/messages`, {
        credentials: 'include',
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to load conversation');
      }

      setConversationMessages(data.messages || []);
    } catch (error) {
      setConversationError(error instanceof Error ? error.message : 'Unable to load conversation');
      setConversationMessages([]);
    } finally {
      setConversationLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <button onClick={onBack} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-full hover:bg-[var(--bg-surface-hover)]">
              <ArrowLeft size={20} />
            </button>
            User Profile: <span className="text-[var(--accent)]">@{user.username}</span>
          </h1>
          <p className="text-[var(--text-secondary)] mt-1 ml-9">Joined: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={<Database size={18} className="text-[var(--accent)]" />} title="Total Conversations" value={summary.total_conversations} />
        <StatCard icon={<MessageSquare size={18} className="text-[var(--accent)]" />} title="Total Messages" value={summary.total_messages} />
        <StatCard icon={<Activity size={18} className="text-[var(--accent)]" />} title="Last Active" value={(user.last_login || user.last_active || user.created_at) ? new Date(user.last_login || user.last_active || user.created_at!).toLocaleDateString() : 'Never'} />
      </div>

      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Personal Engagement</h3>
            <p className="text-[var(--text-secondary)] text-sm">Volume of messages sent by {user.username}</p>
          </div>
          <div className="flex bg-[var(--bg-primary)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-1">
            {(['hourly', 'daily', 'monthly', 'yearly'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-medium rounded-sm capitalize transition-colors ${range === r ? 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        
        <div className="h-[250px] w-full">
          {isAnalyticsLoading ? (
            <div className="w-full h-full animate-pulse bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)]" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMessagesPersonal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--text-secondary)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => {
                    if (range === 'hourly') return val.split(' ')[1] || val; 
                    if (range === 'yearly') return val;
                    const d = new Date(val);
                    return isNaN(d.getTime()) ? val : `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="messages" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorMessagesPersonal)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] overflow-hidden">
        <div className="bg-[var(--bg-surface-hover)] px-6 py-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Recent Conversations</h3>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Conversation Title</th>
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Messages</th>
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Started</th>
                <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {isConvLoading ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center text-[var(--text-muted)] animate-pulse">Loading...</td></tr>
              ) : conversations.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-[var(--text-muted)] italic">No conversations found.</td></tr>
              ) : (
                conversations.map((c: any) => (
                  <tr key={c.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                    <td className="px-6 py-4 font-medium text-[var(--text-primary)] max-w-xs truncate">{c.title || 'Untitled Conversation'}</td>
                    <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{c.message_count || 0}</td>
                    <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{c.created_at ? new Date(c.created_at).toLocaleString() : 'N/A'}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => openConversation(c.id)}
                        className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-1.5 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-hover)]"
                      >
                        <Eye size={14} />
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openedConversationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpenedConversationId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Conversation preview"
            className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Conversation Preview</p>
                <h4 className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                  {conversations.find((conversation: any) => conversation.id === openedConversationId)?.title || 'Untitled Conversation'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setOpenedConversationId(null)}
                className="rounded-full p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
                aria-label="Close conversation preview"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              {conversationLoading ? (
                <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Loading conversation...
                </div>
              ) : conversationError ? (
                <div className="rounded-[var(--radius-md)] border border-[rgba(250,82,82,0.3)] bg-[rgba(250,82,82,0.08)] p-4 text-[var(--error)]">{conversationError}</div>
              ) : conversationMessages.length === 0 ? (
                <div className="text-center text-[var(--text-muted)] py-8">No messages found in this conversation.</div>
              ) : (
                <div className="space-y-4">
                  {conversationMessages.map((message: any) => (
                    <div
                      key={message.id}
                      className={`rounded-[var(--radius-lg)] border p-3 ${message.role === 'user' ? 'ml-8 border-[var(--border-subtle)] bg-[var(--bg-primary)]' : 'mr-8 border-[var(--accent)] bg-[rgba(19,132,255,0.04)]'}`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3 text-[0.7rem] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        <span>{message.role === 'user' ? 'User' : 'Assistant'}</span>
                        {message.created_at && <span>{new Date(message.created_at).toLocaleString()}</span>}
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-primary)]">{message.content || 'Empty message'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, title, value }: { icon: React.ReactNode, title: string, value: string | number }) {
  return (
    <div className="bg-[var(--bg-surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] transition-all flex flex-col justify-between">
      <div className="flex items-center gap-3 text-[var(--text-secondary)] mb-2">
        {icon}
        <h3 className="font-medium text-[0.8rem] uppercase tracking-[0.05em]">{title}</h3>
      </div>
      <div className="text-3xl font-bold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
