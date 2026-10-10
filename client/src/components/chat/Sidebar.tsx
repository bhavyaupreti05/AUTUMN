import { useConversations } from '../../hooks/useConversations';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, MessageSquare, Edit2, Trash2, Pin, PinOff, Settings, Search, Lock, Lightbulb, Send } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';

interface SidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ currentConversationId, onSelectConversation, onNewConversation, isOpen }: SidebarProps) {
  const { conversations, isLoading, isError, refetch, deleteConversation, renameConversation, togglePin } = useConversations();
  const { logout, isAdmin, userId, username } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('AI Training Rule');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (passwords.next !== passwords.confirm) { setPasswordError('New passwords do not match'); return; }
    const response = await fetch('/auth/change-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: passwords.current, new_password: passwords.next }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setPasswordError(data.detail || 'Unable to change password'); return; }
    setPasswordMessage('Password changed successfully');
    setPasswords({ current: '', next: '', confirm: '' });
  };

  const submitSuggestion = async (event: FormEvent) => {
    event.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackError('');
    const response = await fetch('/auth/feedback/suggestions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: feedbackCategory, message: feedbackText.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setFeedbackError(data.detail || 'Unable to send suggestion'); return; }
    setFeedbackText('');
    setFeedbackSent(true);
  };

  const handleRename = (e: MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    const newTitle = prompt("Enter new conversation title:", currentTitle);
    if (newTitle && newTitle.trim() !== "" && newTitle !== currentTitle) {
      renameConversation({ id, title: newTitle.trim() });
    }
  };

  const handleDelete = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this conversation?")) {
      deleteConversation(id);
      if (currentConversationId === id) {
        onNewConversation();
      }
    }
  };

  const handleTogglePin = (e: MouseEvent, id: string, isPinned: boolean) => {
    e.stopPropagation();
    togglePin({ id, isPinned });
  };

  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  }).filter(conv => conv.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className={clsx(
      "w-[280px] bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] flex flex-col h-full shrink-0 transition-transform duration-300 z-50",
      "fixed inset-y-0 left-0 md:relative md:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="p-4 pt-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-muted)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] p-1 flex items-center justify-center shadow-xs">
              <img src="/logo.png" alt="Logo" className="w-full h-full rounded-lg object-cover" />
            </div>
            <div>
              <h2 className="text-[1.05rem] font-bold tracking-tight bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-secondary)] bg-clip-text text-transparent">
                Autumn
              </h2>
            </div>
          </div>
          <span className="text-[0.68rem] font-medium text-[var(--accent)] px-2 py-0.5 rounded-full bg-[var(--accent-muted)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)]">
            v2.0
          </span>
        </div>

        <button
          onClick={onNewConversation}
          className="bg-[var(--energy-gradient)] hover:brightness-110 hover:shadow-[var(--energy-glow)] hover:-translate-y-0.5 active:translate-y-0 text-white py-2.5 px-4 rounded-xl text-[0.88rem] font-semibold transition-all flex items-center justify-center gap-2 w-full cursor-pointer border-none shadow-sm"
        >
          <MessageSquare size={16} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="px-4 pb-2">
        <div className="relative flex items-center w-full">
          <Search size={14} className="absolute left-3 text-[var(--text-muted)] pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search chats..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-xl py-2 pl-9 pr-3 text-[0.82rem] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
          />
        </div>
      </div>

      <div className="text-[0.7rem] uppercase tracking-[0.06em] text-[var(--text-muted)] px-4 pt-2 pb-1 font-semibold flex items-center justify-between">
        <span>Recent Chats</span>
        {sortedConversations.length > 0 && (
          <span className="text-[0.68rem] lowercase text-[var(--text-muted)] font-normal">{sortedConversations.length}</span>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto px-2.5 flex flex-col gap-1 pb-4">
        {isLoading ? (
          <div className="text-[var(--text-muted)] text-xs p-4 text-center animate-pulse">Loading chats...</div>
        ) : isError ? (
          <div className="text-[var(--error)] text-xs p-3 text-center flex flex-col items-center gap-1">
            <span>Failed to load conversations</span>
            <button onClick={() => refetch()} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer border-none bg-transparent p-0 text-xs">Retry</button>
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="text-[var(--text-muted)] text-xs p-6 text-center leading-relaxed">
            No conversations found.<br/>Click <span className="text-[var(--accent)] font-medium">New Chat</span> to start.
          </div>
        ) : (
          sortedConversations.map((conv) => {
            const isActive = currentConversationId === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={clsx(
                  "group flex items-center py-2 px-3 rounded-xl cursor-pointer transition-all relative border gap-2.5",
                  isActive
                    ? "bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg-surface))] border-[color-mix(in_srgb,var(--accent)_35%,transparent)] text-[var(--text-primary)] shadow-xs"
                    : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]",
                  conv.is_pinned && !isActive && "bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] border-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
                )}
              >
                <div className={clsx(
                  "w-4 h-4 flex items-center justify-center shrink-0 transition-colors",
                  isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                )}>
                  {conv.is_pinned ? <Pin size={14} className="text-[var(--accent)]" /> : <MessageSquare size={14} />}
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="text-[0.84rem] font-medium truncate" title={conv.title}>
                    {conv.title}
                  </div>
                  <div className={clsx("text-[0.7rem]", isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}>
                    {new Date(conv.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </div>

                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 shadow-[0_0_6px_var(--accent)]" />
                )}

                <div className="hidden group-hover:flex items-center gap-0.5 absolute right-2 bg-gradient-to-l from-[var(--bg-surface-hover)] via-[var(--bg-surface-hover)] pl-2">
                  <button onClick={(e) => handleTogglePin(e, conv.id, conv.is_pinned)} className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-muted)] rounded-md transition-colors" title={conv.is_pinned ? "Unpin" : "Pin"}>
                    {conv.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
                  </button>
                  <button onClick={(e) => handleRename(e, conv.id, conv.title)} className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-muted)] rounded-md transition-colors" title="Rename">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={(e) => handleDelete(e, conv.id)} className="p-1 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[rgba(239,68,68,0.1)] rounded-md transition-colors" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => setIsProfileOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-left shadow-xs transition-all hover:bg-[var(--bg-surface-hover)] hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] cursor-pointer"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[var(--accent)] to-[#FFA770] text-sm font-bold text-white shadow-xs shrink-0">
            {username ? username.charAt(0).toUpperCase() : userId ? userId.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.84rem] font-semibold text-[var(--text-primary)]">{username || (userId ? `User ${userId.slice(0, 8)}` : 'Profile')}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-[var(--text-secondary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              <span className="font-medium text-[var(--accent)]">{isAdmin ? 'Admin' : 'Member'}</span>
              <span className="opacity-40">•</span>
              <span>Settings</span>
            </div>
          </div>
          <Settings size={15} className="text-[var(--text-muted)] shrink-0 transition-colors" />
        </button>
      </div>

      {isProfileOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setIsProfileOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="User profile"
            className="w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_26px_60px_rgba(0,0,0,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-base font-semibold text-[var(--text-primary)]">
                  {username ? username.charAt(0).toUpperCase() : userId ? userId.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="text-lg font-semibold text-[var(--text-primary)]">{username || (userId ? `User ${userId.slice(0, 8)}` : 'Profile')}</div>
                  <div className="mt-1 flex items-center gap-2 text-[0.75rem] text-[var(--text-secondary)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                    {isAdmin ? 'Admin' : 'User'} • Active
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
                aria-label="Close profile"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  setFeedbackSent(false);
                  setFeedbackError('');
                  setIsFeedbackOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-left text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
              >
                <Lightbulb size={16} />
                <span className="text-[0.9rem] font-medium">Share feedback</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/admin');
                  }}
                  className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-left text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                >
                  <Settings size={16} />
                  <span className="text-[0.9rem] font-medium">Admin Dashboard</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  setIsChangePasswordOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-left text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
              >
                <Lock size={16} />
                <span className="text-[0.9rem] font-medium">Change password</span>
              </button>

              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  handleLogout();
                }}
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-left text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
              >
                <LogOut size={16} />
                <span className="text-[0.9rem] font-medium">Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isFeedbackOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4" onClick={() => setIsFeedbackOpen(false)}>
          <form role="dialog" aria-modal="true" aria-label="Share feedback" onSubmit={submitSuggestion} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_26px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-[var(--text-primary)]">Help improve Autumn</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Share an idea or report something that could work better.</p></div><button type="button" onClick={() => setIsFeedbackOpen(false)} aria-label="Close feedback" className="p-1 text-xl text-[var(--text-secondary)]">×</button></div>
            {feedbackSent ? <div className="mt-6 rounded-[var(--radius-md)] border border-[rgba(76,175,80,0.35)] bg-[rgba(76,175,80,0.1)] p-4 text-sm text-[var(--success)]">Thanks. Your suggestion was sent for review.</div> : <>
              {feedbackError && <div className="mt-4 rounded-[var(--radius-md)] border border-[rgba(250,82,82,0.35)] bg-[rgba(250,82,82,0.1)] p-3 text-sm text-[var(--error)]">{feedbackError}</div>}
              <label className="mt-5 block text-sm font-medium text-[var(--text-primary)]">Who is this feedback for?
                <select value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value)} className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-primary)]">
                  <option value="AI Training Rule">Train the AI (Global Memory Rule)</option>
                  <option value="App Bug / Feature">Admin Support (Bugs / New App Features)</option>
                </select>
              </label>
              <label className="mt-4 block text-sm font-medium text-[var(--text-primary)]">Your suggestion<textarea required maxLength={2000} value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} rows={5} placeholder={feedbackCategory === 'AI Training Rule' ? "E.g. Always answer in Hindi, Never mention pricing..." : "E.g. App is slow, can we add Excel support..."} className="mt-2 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /><span className="mt-1 block text-right text-xs font-normal text-[var(--text-muted)]">{feedbackText.length}/2000</span></label>
              <button type="submit" disabled={!feedbackText.trim()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"><Send size={15} />Send suggestion</button>
            </>}
          </form>
        </div>
      )}
      {isChangePasswordOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsChangePasswordOpen(false)}><form onSubmit={changePassword} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6"><h2 className="text-lg font-semibold">Change password</h2>{passwordError && <p className="text-sm text-[var(--error)]">{passwordError}</p>}{passwordMessage && <p className="text-sm text-[var(--accent)]">{passwordMessage}</p>}{(['current','next','confirm'] as const).map((key) => <input key={key} type="password" value={passwords[key]} onChange={(event) => setPasswords({ ...passwords, [key]: event.target.value })} placeholder={key === 'current' ? 'Current password' : key === 'next' ? 'New password' : 'Confirm new password'} className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)]" required />)}<p className="text-xs text-[var(--text-muted)]">Password: 10+ characters, at most 72 UTF-8 bytes, not your username, and not a common password.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setIsChangePasswordOpen(false)} className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)]">Cancel</button><button type="submit" className="rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-2 text-sm text-white">Change password</button></div></form></div>}
    </div>
  );
}
