import { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';
import { Send, Paperclip, Loader2, Mic, Square, Globe } from 'lucide-react';
import clsx from 'clsx';

// SpeechRecognition Types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatInputProps {
  onSendMessage: (message: string, agentMode?: string, enableWebSearch?: boolean) => void;
  disabled?: boolean;
  onUploadFile?: (file: File) => void;
  isUploading?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
  isNewChat?: boolean;
  botName?: string;
  selectedAgent?: 'auto' | 'dev' | 'researcher' | 'strategist' | 'data';
  onSelectAgent?: (agent: 'auto' | 'dev' | 'researcher' | 'strategist' | 'data') => void;
  isWebSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
}

export function ChatInput({ 
  onSendMessage, 
  disabled, 
  onUploadFile, 
  isUploading, 
  isGenerating, 
  onStop, 
  botName = 'Autumn',
  selectedAgent: propAgent,
  onSelectAgent: propSetAgent,
  isWebSearchEnabled: propWebSearch,
  onToggleWebSearch: propToggleWebSearch
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [internalAgent, setInternalAgent] = useState<'auto' | 'dev' | 'researcher' | 'strategist' | 'data'>('auto');
  const [internalWebSearch, setInternalWebSearch] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const selectedAgent = propAgent !== undefined ? propAgent : internalAgent;
  const setSelectedAgent = propSetAgent || setInternalAgent;
  const isWebSearch = propWebSearch !== undefined ? propWebSearch : internalWebSearch;
  const toggleWebSearch = propToggleWebSearch || (() => setInternalWebSearch(!internalWebSearch));


  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setInput(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) {
      alert("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setInput('');
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
      }
    }
  }, [isRecording]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) {
      onUploadFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSendMessage(input.trim(), selectedAgent, isWebSearch);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  return (
    <div className="w-full px-3 sm:px-5 pt-2 pb-3 bg-[var(--bg-primary)] flex flex-col items-center z-30 shrink-0">
      
      {/* Level 2 Agent Selector & Live Web Search Bar */}
      <div className="w-full max-w-[880px] mb-2 flex items-center justify-between pointer-events-auto px-1 gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-1">
          <span className="text-[0.65rem] text-[var(--text-muted)] font-bold uppercase tracking-wider mr-1 hidden sm:inline">Worker Agent:</span>
          {[
            { id: 'auto', label: '⚡ Auto-Route', title: 'Autonomous multi-agent router' },
            { id: 'dev', label: '💻 DevArchitect', title: 'Principal Software Engineer' },
            { id: 'researcher', label: '📚 DocSynth', title: 'Lead Document & RAG Researcher' },
            { id: 'strategist', label: '🎯 Strategist', title: 'Career & Execution Coach' },
            { id: 'data', label: '📊 DataMind', title: 'Quantitative Data Analyst' },
          ].map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => setSelectedAgent(agent.id as any)}
              title={agent.title}
              className={clsx(
                "px-2.5 py-0.5 rounded-full text-[0.68rem] font-medium transition-all cursor-pointer border whitespace-nowrap",
                selectedAgent === agent.id
                  ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--primary-foreground)] shadow-sm"
                  : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
              )}
            >
              {agent.label}
            </button>
          ))}
        </div>

        {/* Live Web Search Toggle */}
        <button
          type="button"
          onClick={toggleWebSearch}
          title="Toggle live web search for real-time citations"
          className={clsx(
            "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.68rem] font-medium transition-all cursor-pointer border whitespace-nowrap shrink-0",
            isWebSearch
              ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
              : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-emerald-500/40"
          )}
        >
          <Globe size={11} className={isWebSearch ? "text-emerald-400" : "text-[var(--text-muted)]"} />
          <span>{isWebSearch ? "Live Web: ON" : "Live Web"}</span>
        </button>
      </div>

      {/* SECTION G: Chat Composer Container */}
      <div className="w-full max-w-[880px] flex items-end gap-2.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[24px] py-2.5 px-4 shadow-lg focus-within:border-[var(--text-primary)] transition-all pointer-events-auto">
        
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.docx,.xlsx,.csv"
        />

        {/* Attachment Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || disabled}
          title="Attach Document (PDF, DOCX, CSV, Excel)"
          aria-label="Attach Document"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 transition-colors shrink-0 mb-1 rounded-full w-9 h-9 flex items-center justify-center border-none bg-transparent cursor-pointer"
        >
          {isUploading ? (
            <Loader2 size={18} className="animate-spin text-[var(--text-primary)]" />
          ) : (
            <Paperclip size={18} className="rotate-45 hover:text-[var(--text-primary)] transition-colors" />
          )}
        </button>

        {/* Multiline Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isUploading}
          placeholder={(disabled || isUploading || isGenerating) ? `${botName} is thinking...` : `Ask ${botName} anything...`}
          className="flex-1 max-h-[160px] bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] py-2 px-1 outline-none resize-none overflow-y-auto leading-relaxed border-none text-[0.94rem] font-normal"
          rows={1}
        />

        {/* Action Buttons: Stop / Voice / Monochrome Circular Send */}
        {isGenerating ? (
          <button
            onClick={onStop}
            className="w-10 h-10 shrink-0 mb-0.5 text-white bg-red-600/80 hover:bg-red-600 rounded-full transition-all flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.4)] cursor-pointer border border-red-500/40"
            title="Stop generating"
            aria-label="Stop generating"
          >
            <Square size={14} className="fill-current" />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
            {/* Voice input */}
            <button
              onClick={toggleRecording}
              disabled={disabled || isUploading}
              className={`w-9 h-9 rounded-full ${isRecording ? 'text-white bg-red-600 animate-pulse' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'} transition-all flex items-center justify-center disabled:opacity-40 border-none bg-transparent cursor-pointer`}
              title={isRecording ? "Stop recording" : "Voice Input"}
              aria-label="Voice Input"
            >
              <Mic size={18} className={isRecording ? "text-white" : "hover:text-[var(--text-primary)]"} />
            </button>

            {/* High-contrast Monochrome Circular Send Button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || disabled}
              className="w-10 h-10 text-[var(--primary-foreground)] bg-[var(--accent)] hover:opacity-90 active:scale-95 rounded-full disabled:opacity-35 disabled:cursor-not-allowed transition-all flex items-center justify-center border border-[var(--border-strong)] cursor-pointer shadow-md"
              title="Send message"
              aria-label="Send message"
            >
              <Send size={15} className="translate-x-[1px]" />
            </button>
          </div>
        )}
      </div>
      
      {/* Subtle Bottom Attribution */}
      <div className="w-full max-w-[880px] mt-2 pointer-events-auto">
        <p className="text-center text-[0.68rem] text-[var(--text-muted)] tracking-wide font-medium">
          <span className="text-[var(--text-primary)] font-semibold">Autumn AI</span> • Enterprise Grade Local & Cloud Intelligence • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
