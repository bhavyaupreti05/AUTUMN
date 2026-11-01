import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, AlertTriangle, ExternalLink, Bot, Check } from 'lucide-react';
import type { AgentNotification } from '../../hooks/useAgentStudio';

interface NotificationBellProps {
  notifications: AgentNotification[];
  onMarkAllRead: () => void;
}

export function NotificationBell({ notifications, onMarkAllRead }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors border-none bg-transparent cursor-pointer"
        title="Agent Mission Notifications"
        aria-label="Agent notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-emerald-500 text-black text-[0.62rem] font-bold rounded-full flex items-center justify-center shadow-xs animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#09090b] border border-white/10 shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Bot size={15} className="text-white" />
              <span className="text-[0.82rem] font-bold text-white tracking-tight">Mission Alerts</span>
              {unreadCount > 0 && (
                <span className="text-[0.65rem] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={() => {
                  onMarkAllRead();
                }}
                className="text-[0.72rem] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none p-1"
              >
                <Check size={12} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5 p-1">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <Bot size={28} className="mx-auto text-zinc-600 mb-2 opacity-50" />
                <p className="text-[0.8rem] text-zinc-400 font-medium">All caught up!</p>
                <p className="text-[0.7rem] text-zinc-600 mt-0.5">No pending agent mission notifications.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/agents');
                  }}
                  className="p-3 hover:bg-white/[0.04] transition-all cursor-pointer rounded-xl flex items-start gap-3 group"
                >
                  <div className="shrink-0 mt-0.5">
                    {item.status === 'completed' ? (
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 size={13} />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                        <AlertTriangle size={13} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[0.7rem] font-semibold text-zinc-400 uppercase tracking-wider">
                        {item.agent_name || 'Autonomous Agent'}
                      </span>
                      <span className="text-[0.65rem] text-zinc-500 font-mono">
                        {item.completed_at ? new Date(item.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <p className="text-[0.8rem] text-white font-medium truncate mt-0.5 group-hover:text-emerald-400 transition-colors">
                      {item.title}
                    </p>

                    <p className="text-[0.68rem] text-zinc-500 mt-0.5">
                      {item.status === 'completed' ? 'Mission successfully completed.' : 'Mission finished with errors.'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Navigation */}
          <div className="p-2.5 border-t border-white/10 bg-white/[0.01] text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/agents');
              }}
              className="w-full py-1.5 px-3 rounded-lg text-[0.76rem] font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all flex items-center justify-center gap-1.5 bg-transparent border-none cursor-pointer"
            >
              <span>Launch Agent Studio</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
