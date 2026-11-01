import { useConversations } from '../../hooks/useConversations';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, 
  MessageSquare, 
  Edit2, 
  Trash2, 
  Pin, 
  PinOff, 
  Settings, 
  Search, 
  Lock, 
  Lightbulb, 
  Send,
  Home,
  Compass,
  Layers,
  Brain,
  Plus,
  X,
  FileText,
  Upload,
  CheckCircle2,
  Sparkles,
  Bot
} from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';

interface SidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenUpload?: () => void;
  documents?: Array<{ id: string; filename: string; status: string }>;
  onDetachDoc?: (id: string) => void;
  onQuickPrompt?: (prompt: string) => void;
}

export function Sidebar({ 
  currentConversationId, 
  onSelectConversation, 
  onNewConversation, 
  isOpen, 
  onClose,
  onOpenUpload,
  documents = [],
  onDetachDoc,
  onQuickPrompt
}: SidebarProps) {
  const { conversations, isLoading, isError, refetch, deleteConversation, renameConversation, togglePin } = useConversations();
  const { logout, isAdmin, username } = useAuth();
  const navigate = useNavigate();

  // Navigation tab states
  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'projects' | 'memory' | 'settings'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  // Feedback & Memory
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('AI Training Rule');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const displayName = username ? (username.charAt(0).toUpperCase() + username.slice(1)) : 'Bhavya';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (passwords.next !== passwords.confirm) { 
      setPasswordError('New passwords do not match'); 
      return; 
    }
    const response = await fetch('/auth/change-password', { 
      method: 'POST', 
      credentials: 'include', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ current_password: passwords.current, new_password: passwords.next }) 
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { 
      setPasswordError(data.detail || 'Unable to change password'); 
      return; 
    }
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
    if (!response.ok) { 
      setFeedbackError(data.detail || 'Unable to send suggestion'); 
      return; 
    }
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
    <>
      <aside className={clsx(
        "w-[285px] bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] text-[var(--text-primary)] flex flex-col h-full shrink-0 transition-all duration-200 z-40 select-none",
        "fixed inset-y-0 left-0 md:relative md:translate-x-0 shadow-2xl",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Top Branding */}
        <div className="p-4 pt-5 pb-3 flex flex-col gap-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div 
              onClick={() => {
                setActiveTab('home');
                onNewConversation();
              }}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="relative w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] p-1 flex items-center justify-center shadow-sm group-hover:border-[var(--border-hover)] transition-all">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow-xs animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[1.05rem] font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-1.5">
                  Autumn
                  <span className="text-[0.62rem] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    AI
                  </span>
                </span>
                <span className="text-[0.68rem] text-[var(--text-muted)] tracking-wider font-medium">
                  Think. Build. Execute.
                </span>
              </div>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="md:hidden p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-hover)] border-none bg-transparent cursor-pointer"
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Quick Primary Navigation */}
          <nav className="flex flex-col gap-1 pt-2">
            <button
              onClick={() => {
                setActiveTab('home');
                onNewConversation();
              }}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.84rem] font-medium transition-all text-left cursor-pointer border border-transparent",
                activeTab === 'home' && !currentConversationId
                  ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border-[var(--border-strong)] shadow-xs font-semibold"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
              )}
            >
              <Home size={16} className={activeTab === 'home' && !currentConversationId ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"} />
              <span>Home</span>
            </button>

            <button
              onClick={() => {
                navigate('/agents');
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.84rem] font-medium transition-all text-left cursor-pointer border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] group"
            >
              <Bot size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-[var(--text-primary)]">Agent Studio</span>
              <span className="ml-auto text-[0.6rem] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Studio
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('explore');
                setIsExploreOpen(true);
              }}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.84rem] font-medium transition-all text-left cursor-pointer border border-transparent",
                activeTab === 'explore'
                  ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border-[var(--border-strong)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
              )}
            >
              <Compass size={16} className={activeTab === 'explore' ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"} />
              <span>Explore</span>
              <span className="ml-auto text-[0.62rem] uppercase font-semibold text-[var(--text-muted)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">Hub</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('projects');
                setIsProjectsOpen(true);
              }}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.84rem] font-medium transition-all text-left cursor-pointer border border-transparent",
                activeTab === 'projects'
                  ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border-[var(--border-strong)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
              )}
            >
              <Layers size={16} className={activeTab === 'projects' ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"} />
              <span>Projects</span>
              {documents.length > 0 && (
                <span className="ml-auto text-[0.65rem] font-bold text-[var(--text-primary)] bg-[var(--bg-surface-hover)] px-1.5 py-0.2 rounded-full border border-[var(--border-subtle)]">
                  {documents.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('memory');
                setIsMemoryOpen(true);
              }}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.84rem] font-medium transition-all text-left cursor-pointer border border-transparent",
                activeTab === 'memory'
                  ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border-[var(--border-strong)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
              )}
            >
              <Brain size={16} className={activeTab === 'memory' ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"} />
              <span>Memory</span>
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            </button>

            <button
              onClick={() => {
                setActiveTab('settings');
                setIsProfileOpen(true);
              }}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.84rem] font-medium transition-all text-left cursor-pointer border border-transparent",
                activeTab === 'settings'
                  ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border-[var(--border-strong)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
              )}
            >
              <Settings size={16} className={activeTab === 'settings' ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"} />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Action: New Chat Button */}
        <div className="px-3.5 pt-3 pb-2">
          <button
            onClick={() => {
              setActiveTab('home');
              onNewConversation();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent)] text-[var(--primary-foreground)] hover:opacity-90 font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer border border-[var(--border-strong)] active:scale-[0.98] text-[0.86rem]"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search Chats Input */}
        <div className="px-3.5 pb-2">
          <div className="relative flex items-center w-full">
            <Search size={14} className="absolute left-3 text-[var(--text-muted)] pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search chats..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-lg py-1.5 pl-8 pr-3 text-[0.8rem] focus:outline-none focus:border-[var(--border-strong)] focus:ring-1 focus:ring-[var(--border-strong)] transition-all"
            />
          </div>
        </div>

        {/* Recent Chats Section */}
        <div className="text-[0.68rem] uppercase tracking-wider text-[var(--text-muted)] px-4 pt-2 pb-1 font-semibold flex items-center justify-between">
          <span>Recent Chats</span>
          {sortedConversations.length > 0 && (
            <span className="text-[0.68rem] text-[var(--text-muted)] font-normal">{sortedConversations.length}</span>
          )}
        </div>
        
        {/* Conversations Scroll Container */}
        <div className="flex-1 overflow-y-auto px-2.5 flex flex-col gap-1 pb-4">
          {isLoading ? (
            <div className="text-[var(--text-muted)] text-xs p-4 text-center animate-pulse">Loading conversations...</div>
          ) : isError ? (
            <div className="text-red-400 text-xs p-3 text-center flex flex-col items-center gap-1">
              <span>Failed to load conversations</span>
              <button onClick={() => refetch()} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer border-none bg-transparent p-0 text-xs">Retry</button>
            </div>
          ) : sortedConversations.length === 0 ? (
            <div className="text-[var(--text-muted)] text-xs p-6 text-center leading-relaxed">
              No conversations yet.<br/>Start with <span className="text-[var(--text-primary)] font-medium">New Chat</span>.
            </div>
          ) : (
            sortedConversations.map((conv) => {
              const isActive = currentConversationId === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveTab('home');
                    onSelectConversation(conv.id);
                  }}
                  className={clsx(
                    "group flex items-center py-2 px-3 rounded-lg cursor-pointer transition-all relative border gap-2.5",
                    isActive
                      ? "bg-[var(--bg-surface-hover)] border-[var(--border-strong)] text-[var(--text-primary)] shadow-xs font-medium"
                      : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]",
                    conv.is_pinned && !isActive && "bg-[var(--bg-surface)] border-[var(--border-subtle)]"
                  )}
                >
                  <div className={clsx(
                    "w-4 h-4 flex items-center justify-center shrink-0 transition-colors",
                    isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                  )}>
                    {conv.is_pinned ? <Pin size={13} className="text-[var(--text-primary)]" /> : <MessageSquare size={13} />}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="text-[0.82rem] font-medium truncate" title={conv.title}>
                      {conv.title}
                    </div>
                    <div className={clsx("text-[0.68rem]", isActive ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]")}>
                      {new Date(conv.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>

                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 shadow-xs" />
                  )}

                  <div className="hidden group-hover:flex items-center gap-0.5 absolute right-2 bg-[var(--bg-surface)] pl-2 rounded-r-lg">
                    <button 
                      onClick={(e) => handleTogglePin(e, conv.id, conv.is_pinned)} 
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors" 
                      title={conv.is_pinned ? "Unpin" : "Pin"}
                    >
                      {conv.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                    <button 
                      onClick={(e) => handleRename(e, conv.id, conv.title)} 
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors" 
                      title="Rename"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(e, conv.id)} 
                      className="p-1 text-[var(--text-muted)] hover:text-red-400 rounded transition-colors" 
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Profile Section */}
        <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-sidebar)]">
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-left transition-all hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-strong)] cursor-pointer shadow-xs group"
          >
            {/* User Avatar */}
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-xs font-bold text-[var(--text-primary)] border border-[var(--border-strong)] shrink-0">
              {displayName.charAt(0)}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--bg-primary)]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.82rem] font-semibold text-[var(--text-primary)] transition-colors">
                {displayName}
              </div>
              <div className="flex items-center gap-1.5 text-[0.68rem] text-[var(--text-muted)]">
                <span className="text-[var(--text-secondary)] font-medium">{isAdmin ? 'Admin' : 'Personal AI'}</span>
                <span className="opacity-40">•</span>
                <span>Online</span>
              </div>
            </div>

            <Settings size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0 transition-colors" />
          </button>
        </div>
      </aside>

      {/* EXPLORE MODAL */}
      {isExploreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsExploreOpen(false)}>
          <div 
            className="w-full max-w-2xl rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl text-[var(--text-primary)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                  <Compass size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Explore Autumn AI</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Discover capabilities, workflows, and instant prompt templates</p>
                </div>
              </div>
              <button onClick={() => setIsExploreOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-5">
              {[
                { title: 'Fullstack & Python Architect', desc: 'Debug async logic, architect FastAPI routes, write PyTorch or React components.', prompt: 'Review this Python architecture and optimize for high throughput and low memory usage.' },
                { title: 'Document RAG Deep Dive', desc: 'Ask complex multi-turn questions against PDF reports, financial sheets, and research papers.', prompt: 'Summarize the attached documents with key insights, action items, and data tables.' },
                { title: 'Strategic Brainstorming', desc: 'Formulate executable product roadmaps, study schedules, or competitive analysis.', prompt: 'Act as a principal tech lead and design a 30-day roadmap for a modern SaaS product.' },
                { title: 'Code Refactoring & Testing', desc: 'Generate high-coverage unit tests, clean code refactoring, and benchmark analysis.', prompt: 'Write comprehensive pytest unit tests with mock fixtures for this function.' },
              ].map((item, idx) => (
                <div 
                  key={idx}
                  onClick={() => {
                    setIsExploreOpen(false);
                    onQuickPrompt?.(item.prompt);
                  }}
                  className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] transition-all cursor-pointer group"
                >
                  <h4 className="text-[0.88rem] font-semibold text-[var(--text-primary)] transition-colors">{item.title}</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{item.desc}</p>
                  <span className="inline-block mt-3 text-[0.72rem] text-[var(--text-secondary)] font-medium group-hover:text-[var(--text-primary)] group-hover:underline">Use prompt →</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
              <button 
                onClick={() => setIsExploreOpen(false)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-surface-hover)] hover:bg-[var(--border-strong)] text-xs font-semibold text-[var(--text-primary)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROJECTS & KNOWLEDGE MODAL */}
      {isProjectsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsProjectsOpen(false)}>
          <div 
            className="w-full max-w-xl rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl text-[var(--text-primary)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Knowledge & Documents</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Manage attached files, RAG embeddings, and active context</p>
                </div>
              </div>
              <button onClick={() => setIsProjectsOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1">
                <X size={18} />
              </button>
            </div>

            <div className="my-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Active Files ({documents.length})
                </span>
                <button
                  onClick={() => {
                    setIsProjectsOpen(false);
                    onOpenUpload?.();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:opacity-90 text-xs font-semibold text-[var(--primary-foreground)] transition-colors"
                >
                  <Upload size={13} />
                  <span>Attach File</span>
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                  <FileText size={28} className="mx-auto text-[var(--text-muted)] mb-2" />
                  <p className="text-sm text-[var(--text-secondary)]">No documents attached to current conversation.</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Upload a PDF, DOCX, CSV or Excel file to enable RAG citations.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto">
                  {documents.map((doc) => (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={16} className="text-[var(--text-primary)] shrink-0" />
                        <span className="text-xs font-medium text-[var(--text-primary)] truncate" title={doc.filename}>{doc.filename}</span>
                        <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {doc.status}
                        </span>
                      </div>
                      {onDetachDoc && (
                        <button
                          onClick={() => onDetachDoc(doc.id)}
                          className="text-[var(--text-muted)] hover:text-red-400 p-1 text-xs transition-colors"
                          title="Remove file"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
              <button 
                onClick={() => setIsProjectsOpen(false)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-surface-hover)] hover:bg-[var(--border-strong)] text-xs font-semibold text-[var(--text-primary)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI MEMORY & RULES MODAL */}
      {isMemoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsMemoryOpen(false)}>
          <div 
            className="w-full max-w-lg rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl text-[var(--text-primary)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                  <Brain size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Autonomous AI Memory</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Train Autumn with custom instructions and memory rules</p>
                </div>
              </div>
              <button onClick={() => setIsMemoryOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitSuggestion} className="my-5 flex flex-col gap-4">
              {feedbackSent ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Memory rule trained! Autumn will incorporate this into future generations.</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Autumn remembers your context across sessions. Add persistent rules or behavioral preferences below:
                  </p>

                  <textarea
                    rows={4}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="E.g., 'Always provide clean TypeScript examples without unnecessary boilerplate.', 'Summarize long answers first.', 'Address me as Bhavya.'"
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)] focus:ring-1 focus:ring-[var(--border-strong)] resize-none"
                    required
                  />

                  {feedbackError && (
                    <div className="text-xs text-red-400">{feedbackError}</div>
                  )}

                  <button
                    type="submit"
                    disabled={!feedbackText.trim()}
                    className="py-2.5 px-4 rounded-xl bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 text-xs font-semibold text-[var(--primary-foreground)] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <Sparkles size={14} />
                    <span>Save Instruction to AI Memory</span>
                  </button>
                </>
              )}
            </form>

            <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
              <button 
                onClick={() => {
                  setIsMemoryOpen(false);
                  setFeedbackSent(false);
                }}
                className="px-4 py-2 rounded-lg bg-[var(--bg-surface-hover)] hover:bg-[var(--border-strong)] text-xs font-semibold text-[var(--text-primary)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER PROFILE & SETTINGS MODAL */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsProfileOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="User settings"
            className="w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 shadow-2xl text-[var(--text-primary)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)] text-base font-bold text-[var(--text-primary)] shadow-sm">
                  {displayName.charAt(0)}
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-black" />
                </div>
                <div>
                  <div className="text-base font-bold text-[var(--text-primary)]">{displayName}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[0.72rem] text-[var(--text-secondary)]">
                    <span className="text-[var(--text-primary)] font-semibold">{isAdmin ? 'Administrator' : 'Verified User'}</span>
                    <span>•</span>
                    <span>Autumn OS v2.0</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                aria-label="Close profile"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  setFeedbackSent(false);
                  setFeedbackError('');
                  setIsFeedbackOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 text-left text-[var(--text-primary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)]"
              >
                <Lightbulb size={16} className="text-[var(--text-primary)]" />
                <span className="text-[0.84rem] font-medium">Share feedback & ideas</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/admin');
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 text-left text-[var(--text-primary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)]"
                >
                  <Settings size={16} className="text-[var(--text-primary)]" />
                  <span className="text-[0.84rem] font-medium">Admin Monitoring Dashboard</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  setIsChangePasswordOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 text-left text-[var(--text-primary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)]"
              >
                <Lock size={16} className="text-[var(--text-primary)]" />
                <span className="text-[0.84rem] font-medium">Change account password</span>
              </button>

              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  handleLogout();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-left text-red-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
              >
                <LogOut size={16} />
                <span className="text-[0.84rem] font-medium">Log out of Autumn</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsFeedbackOpen(false)}>
          <form role="dialog" aria-modal="true" aria-label="Share feedback" onSubmit={submitSuggestion} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 shadow-2xl text-[var(--text-primary)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">Help improve Autumn</h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Share an idea or report something that could work better.</p>
              </div>
              <button type="button" onClick={() => setIsFeedbackOpen(false)} aria-label="Close feedback" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1">
                <X size={18} />
              </button>
            </div>
            {feedbackSent ? (
              <div className="mt-6 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-xs text-emerald-400">
                Thanks! Your suggestion was saved.
              </div>
            ) : (
              <>
                {feedbackError && <div className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs text-red-400">{feedbackError}</div>}
                <label className="mt-4 block text-xs font-medium text-[var(--text-secondary)]">Category
                  <select value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5 text-xs text-[var(--text-primary)]">
                    <option value="AI Training Rule">Train the AI (Global Memory Rule)</option>
                    <option value="App Bug / Feature">App Feedback (Bugs / Features)</option>
                  </select>
                </label>
                <label className="mt-3 block text-xs font-medium text-[var(--text-secondary)]">Your suggestion
                  <textarea required maxLength={2000} value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} rows={4} placeholder={feedbackCategory === 'AI Training Rule' ? "E.g. Always write code with explanations..." : "E.g. Add dark theme option..."} className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]" />
                  <span className="mt-1 block text-right text-[0.68rem] font-normal text-[var(--text-muted)]">{feedbackText.length}/2000</span>
                </label>
                <button type="submit" disabled={!feedbackText.trim()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity">
                  <Send size={14} />
                  <span>Send suggestion</span>
                </button>
              </>
            )}
          </form>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsChangePasswordOpen(false)}>
          <form onSubmit={changePassword} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 text-[var(--text-primary)] shadow-2xl">
            <h2 className="text-base font-bold">Change password</h2>
            {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
            {passwordMessage && <p className="text-xs text-emerald-400">{passwordMessage}</p>}
            {(['current','next','confirm'] as const).map((key) => (
              <input 
                key={key} 
                type="password" 
                value={passwords[key]} 
                onChange={(event) => setPasswords({ ...passwords, [key]: event.target.value })} 
                placeholder={key === 'current' ? 'Current password' : key === 'next' ? 'New password' : 'Confirm new password'} 
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]" 
                required 
              />
            ))}
            <p className="text-[0.68rem] text-[var(--text-muted)]">Must be 10+ characters, at most 72 UTF-8 bytes, not your username.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsChangePasswordOpen(false)} className="rounded-xl px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
              <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">Update</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
