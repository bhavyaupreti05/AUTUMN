import { useEffect, useState, useRef } from 'react';
import { ChatArea } from '../components/chat/ChatArea';
import { ChatInput } from '../components/chat/ChatInput';
import { Sidebar } from '../components/chat/Sidebar';
import { useChat } from '../hooks/useChat';
import { useDocuments } from '../hooks/useDocuments';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Sun, 
  Moon, 
  HelpCircle, 
  Menu, 
  Maximize, 
  Minimize, 
  Zap, 
  FileText, 
  X,
  Download
} from 'lucide-react';

export function ChatPage() {
  const { userId, username } = useAuth();
  const conversationStorageKey = userId
    ? `autumn.currentConversationId.${userId}`
    : 'autumn.currentConversationId.pending';
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<'auto' | 'dev' | 'researcher' | 'strategist' | 'data'>('auto');
  const [isWebSearch, setIsWebSearch] = useState(false);

  const { messages, isGenerating, sendMessage, stopGeneration, regenerateMessage, currentConversationId } = useChat(selectedConvId, '/api/chat', conversationStorageKey);
  const { documents, uploadDocument, isUploading, uploadError, detachDocument } = useDocuments(currentConversationId);
  const { theme, toggleTheme } = useTheme();

  const fileInputTriggerRef = useRef<HTMLInputElement>(null);

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

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  const triggerUploadDialog = () => {
    fileInputTriggerRef.current?.click();
  };

  return (
    <div className="flex h-screen bg-black overflow-hidden w-full relative">
      
      {/* Hidden file input for global attachment triggers from cards/quick actions */}
      <input
        type="file"
        ref={fileInputTriggerRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadDocument(file);
          if (fileInputTriggerRef.current) fileInputTriggerRef.current.value = '';
        }}
        className="hidden"
        accept=".pdf,.docx,.xlsx,.csv"
      />

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SECTION A: Left Sidebar (Fixed 285px) */}
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
        onOpenUpload={triggerUploadDialog}
        documents={documents}
        onDetachDoc={detachDocument}
        onQuickPrompt={sendMessage}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col h-full relative bg-black overflow-hidden">
        
        {/* SECTION B: Top Navigation */}
        <header className="min-h-[58px] px-4 md:px-6 py-2 border-b border-[#1F1A2C] flex items-center justify-between gap-4 shrink-0 bg-[#060608]/90 backdrop-blur-md z-20">
          
          {/* Left top controls */}
          <div className="flex min-w-0 items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors border-none bg-transparent cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            {/* Autumn v2.0 & Status */}
            <div className="flex items-center gap-2.5">
              <span className="text-[0.88rem] font-bold text-white tracking-tight flex items-center gap-1.5">
                Autumn <span className="text-[0.68rem] text-[#8B2BFF] font-semibold bg-[#8B2BFF]/15 px-1.5 py-0.5 rounded-sm border border-[#8B2BFF]/30">v2.0</span>
              </span>

              {/* Online indicator */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.68rem] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </div>

              {/* Powered by AI badge */}
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.68rem] font-medium bg-[#8B2BFF]/10 text-[#A75BFF] border border-[#8B2BFF]/25 shadow-xs">
                <Zap size={11} className="text-[#8B2BFF]" />
                Powered by Groq Cloud AI
              </div>
            </div>

            {/* Attached Documents in Header */}
            {currentConversationId && documents.length > 0 && (
              <div className="hidden md:flex min-w-0 gap-1.5 items-center overflow-x-auto ml-2 pl-3 border-l border-white/10">
                {documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[0.7rem] max-w-[160px]
                      ${doc.status === 'FAILED' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-[#0D0D14] border-white/10 text-zinc-300'}
                    `}
                  >
                    <FileText size={12} className="text-[#8B2BFF] shrink-0" />
                    <span className="truncate flex-1 font-medium" title={doc.filename}>{doc.filename}</span>
                    <button 
                      onClick={() => detachDocument(doc.id)}
                      className="text-zinc-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer border-none bg-transparent p-0"
                      title="Remove document"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadError && (
              <div className="text-red-400 text-[0.72rem] flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
                {uploadError}
              </div>
            )}
          </div>
          
          {/* Right top controls */}
          <div className="flex shrink-0 gap-1.5 items-center">
            {messages.length > 0 && (
              <div className="flex items-center gap-1.5 mr-1 pr-2 border-r border-white/10">
                <button 
                  onClick={() => handleExport('md')} 
                  className="px-2 py-1 flex items-center gap-1 rounded-lg text-[0.7rem] font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors border border-white/10 bg-[#0D0D14] cursor-pointer" 
                  title="Export conversation as Markdown"
                >
                  <Download size={12} />
                  <span>MD</span>
                </button>
                <button 
                  onClick={() => handleExport('json')} 
                  className="px-2 py-1 flex items-center gap-1 rounded-lg text-[0.7rem] font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors border border-white/10 bg-[#0D0D14] cursor-pointer" 
                  title="Export conversation as JSON"
                >
                  <span>JSON</span>
                </button>
              </div>
            )}

            {/* Fullscreen control */}
            <button 
              onClick={toggleFullscreen} 
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer" 
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"} 
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>

            {/* Theme toggle */}
            <button 
              id="theme-toggle-btn" 
              onClick={toggleTheme} 
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer" 
              title="Toggle theme" 
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Help dialog */}
            <button 
              onClick={() => setIsHelpOpen(true)} 
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer" 
              title="Autumn AI Help & Shortcuts" 
              aria-label="Open help"
            >
              <HelpCircle size={16} />
            </button>
          </div>
        </header>

        {/* Help Dialog Modal */}
        {isHelpOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setIsHelpOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="help-title"
              className="w-full max-w-md rounded-2xl border border-[#8B2BFF]/30 bg-[#0A0A0F] p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#8B2BFF]/20 text-[#8B2BFF]">
                    <HelpCircle size={18} />
                  </div>
                  <h2 id="help-title" className="text-base font-bold text-white">Autumn AI Operating Guide</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  className="text-zinc-400 hover:text-white p-1"
                  aria-label="Close help"
                >
                  <X size={18} />
                </button>
              </div>

              <ul className="mt-4 space-y-3 text-xs text-zinc-300 list-none p-0">
                <li className="flex items-start gap-2.5 p-2 rounded-xl bg-[#0D0D14] border border-white/5">
                  <span className="font-bold text-[#8B2BFF] shrink-0">⏎ Enter</span>
                  <span>Press <strong className="text-white">Enter</strong> to send your prompt. Press <strong className="text-white">Shift+Enter</strong> for a new line.</span>
                </li>
                <li className="flex items-start gap-2.5 p-2 rounded-xl bg-[#0D0D14] border border-white/5">
                  <span className="font-bold text-[#8B2BFF] shrink-0">📎 RAG</span>
                  <span>Attach PDFs, CSVs, DOCX files via the paperclip button to query documents with exact citations.</span>
                </li>
                <li className="flex items-start gap-2.5 p-2 rounded-xl bg-[#0D0D14] border border-white/5">
                  <span className="font-bold text-[#8B2BFF] shrink-0">🧠 Memory</span>
                  <span>Open the <strong className="text-white">Memory</strong> tab in the sidebar to add persistent rules and train Autumn's personality.</span>
                </li>
                <li className="flex items-start gap-2.5 p-2 rounded-xl bg-[#0D0D14] border border-white/5">
                  <span className="font-bold text-[#8B2BFF] shrink-0">⚡ Cloud</span>
                  <span>Groq Cloud ultra-fast inference (<span className="text-emerald-400 font-semibold">&lt; 200ms TTFT</span>) with fallback to local Qwen LLM.</span>
                </li>
              </ul>

              <div className="flex justify-end pt-4 mt-2 border-t border-white/5">
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-[#8B2BFF] hover:bg-[#9D4BFF] text-xs font-semibold text-white transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION C, D, E, F: Chat & Dashboard Area */}
        <ChatArea
          messages={messages}
          isGenerating={isGenerating}
          botName="Autumn"
          username={username}
          onRetry={handleRetry}
          onEdit={regenerateMessage}
          documentsCount={documents.length}
          onSuggestedPrompt={(prompt, agentMode) => {
            const targetAgent = (agentMode as any) || selectedAgent;
            if (agentMode) setSelectedAgent(agentMode as any);
            sendMessage(prompt, targetAgent, isWebSearch);
          }}
          onOpenFileUpload={triggerUploadDialog}
        />
        
        {/* SECTION G: Chat Composer */}
        <div className="bg-black flex flex-col shrink-0 pb-4 relative">
          <ChatInput 
            onSendMessage={(text, agent, webSearch) => sendMessage(text, agent || selectedAgent, webSearch ?? isWebSearch)} 
            disabled={isGenerating} 
            onUploadFile={uploadDocument}
            isUploading={isUploading}
            isGenerating={isGenerating}
            onStop={stopGeneration}
            isNewChat={messages.length === 0}
            botName="Autumn"
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
            isWebSearchEnabled={isWebSearch}
            onToggleWebSearch={() => setIsWebSearch(!isWebSearch)}
          />
        </div>
      </div>
    </div>
  );
}
