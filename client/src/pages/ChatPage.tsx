import { useEffect, useState } from 'react';
import { ChatArea } from '../components/chat/ChatArea';
import { ChatInput } from '../components/chat/ChatInput';
import { Sidebar } from '../components/chat/Sidebar';
import { useChat } from '../hooks/useChat';
import { useDocuments } from '../hooks/useDocuments';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, HelpCircle, Menu } from 'lucide-react';

export function ChatPage() {
  const { userId, username } = useAuth();
  const conversationStorageKey = userId
    ? `autumn.currentConversationId.${userId}`
    : 'autumn.currentConversationId.pending';
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { messages, isGenerating, sendMessage, stopGeneration, regenerateMessage, currentConversationId } = useChat(selectedConvId, '/api/chat', conversationStorageKey);
  const { documents, uploadDocument, isUploading, uploadError, detachDocument } = useDocuments(currentConversationId);

  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!userId) {
      setSelectedConvId(null);
      return;
    }
    const saved = localStorage.getItem(`autumn.currentConversationId.${userId}`) 
      || localStorage.getItem(`trpwbot.currentConversationId.${userId}`);
    setSelectedConvId(saved);
  }, [conversationStorageKey, userId]);

  useEffect(() => {
    if (!isHelpOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsHelpOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHelpOpen]);

  const handleRetry = (msg: any) => {
    const idx = messages.findIndex(m => m.id === msg.id);
    if (idx > 0) {
      const prev = messages[idx - 1];
      if (prev.role === 'user') {
         sendMessage(prev.content);
      }
    }
  };

  const handleExport = (format: 'json' | 'md') => {
    if (!messages.length) return;
    
    let content = '';
    let filename = `autumn_conversation_${currentConversationId || 'export'}`;
    let type = '';

    if (format === 'json') {
      content = JSON.stringify(messages, null, 2);
      filename += '.json';
      type = 'application/json';
    } else {
      content = messages.map(m => `**${m.role.toUpperCase()}**\n\n${m.content}`).join('\n\n---\n\n');
      filename += '.md';
      type = 'text/markdown';
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] overflow-hidden w-full relative">
      
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar 
        currentConversationId={currentConversationId}
        onSelectConversation={(id) => {
          setSelectedConvId(id);
          setIsSidebarOpen(false);
        }}
        onNewConversation={() => {
          setSelectedConvId(null);
          localStorage.removeItem(conversationStorageKey);
          localStorage.removeItem(`trpwbot.currentConversationId.${userId}`);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full relative bg-[var(--bg-primary)] overflow-hidden">
        <header className="min-h-[58px] px-4 md:px-6 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 shrink-0 bg-[var(--bg-primary)]/90 backdrop-blur-md z-10">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors border-none bg-transparent cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <h3 className="text-[0.95rem] font-semibold text-[var(--text-primary)] tracking-tight">
                {currentConversationId ? 'Conversation' : 'New Chat'}
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.7rem] font-medium bg-[var(--accent-muted)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                Autumn AI
              </span>
            </div>
            
            {/* Attached Docs */}
            {currentConversationId && (
              <div className="flex min-w-0 gap-2 items-center overflow-x-auto">
                {documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] border text-[0.75rem] max-w-[200px] shadow-xs
                      ${doc.status === 'FAILED' ? 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.3)] text-[var(--error)]' : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'}
                    `}
                  >
                    <span className="truncate flex-1 font-medium" title={doc.filename}>{doc.filename}</span>
                    <button 
                      onClick={() => detachDocument(doc.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors shrink-0 cursor-pointer border-none bg-transparent"
                      title="Remove document"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {uploadError && (
                  <div className="text-[var(--error)] text-[0.75rem] flex items-center gap-1 bg-[rgba(239,68,68,0.1)] px-2.5 py-1 rounded-[var(--radius-sm)]">
                    {uploadError}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex shrink-0 gap-2 items-center">
            {messages.length > 0 && (
              <div className="flex items-center gap-1.5 mr-1 border-r border-[var(--border-subtle)] pr-3">
                <span className="text-[0.68rem] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Export</span>
                <button onClick={() => handleExport('md')} className="px-2.5 py-1 flex items-center justify-center rounded-[var(--radius-sm)] text-[0.72rem] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors border border-[var(--border-subtle)] bg-[var(--bg-surface)] cursor-pointer" title="Export as Markdown">
                  MD
                </button>
                <button onClick={() => handleExport('json')} className="px-2.5 py-1 flex items-center justify-center rounded-[var(--radius-sm)] text-[0.72rem] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors border border-[var(--border-subtle)] bg-[var(--bg-surface)] cursor-pointer" title="Export as JSON">
                  JSON
                </button>
              </div>
            )}
            <button id="theme-toggle-btn" onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors border-none bg-transparent cursor-pointer" title="Toggle theme" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setIsHelpOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors border-none bg-transparent cursor-pointer" title="Help" aria-label="Open help">
              <HelpCircle size={18} />
            </button>
          </div>
        </header>

        {isHelpOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setIsHelpOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="help-title"
              className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-[var(--text-primary)] shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="help-title" className="text-lg font-semibold text-[var(--text-primary)]">Using Autumn</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  aria-label="Close help"
                >
                  ×
                </button>
              </div>
              <ul className="mt-5 space-y-3 text-sm text-[var(--text-secondary)] list-disc pl-5 marker:text-[var(--text-muted)]">
                <li><strong className="text-[var(--text-primary)] font-medium">Ask questions</strong>, attach supported documents, and continue conversations from the sidebar.</li>
                <li><strong className="text-[var(--text-primary)] font-medium">Press Enter</strong> to send a message. Use <strong className="text-[var(--text-primary)] font-medium">Shift+Enter</strong> for a new line.</li>
                <li><strong className="text-[var(--text-primary)] font-medium">Attach documents</strong> using the paperclip button.</li>
                <li><strong className="text-[var(--text-primary)] font-medium">Manage conversations</strong> from the sidebar (switch, rename, pin, or delete).</li>
              </ul>
            </div>
          </div>
        )}

        <ChatArea
          messages={messages}
          isGenerating={isGenerating}
          username={username}
          onRetry={handleRetry}
          onEdit={regenerateMessage}
          documentsCount={documents.length}
          onSuggestedPrompt={sendMessage}
          starterQuestions={["Hello!"]}
        />
        
        {/* Input & Docs Area */}
        <div className="bg-[var(--bg-primary)] flex flex-col shrink-0 pb-4 relative">
          <ChatInput 
            onSendMessage={sendMessage} 
            disabled={isGenerating} 
            onUploadFile={uploadDocument}
            isUploading={isUploading}
            isGenerating={isGenerating}
            onStop={stopGeneration}
            isNewChat={messages.length === 0}
            botName="Autumn"
          />
        </div>
      </div>
    </div>
  );
}
