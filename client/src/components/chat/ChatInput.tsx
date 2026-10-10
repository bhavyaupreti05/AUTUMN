import { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { Send, Paperclip, Loader2, Mic } from 'lucide-react';
import type { ChangeEvent } from 'react';

// SpeechRecognition Types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  onUploadFile?: (file: File) => void;
  isUploading?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
  isNewChat?: boolean;
  botName?: string;
}

export function ChatInput({ onSendMessage, disabled, onUploadFile, isUploading, isGenerating, onStop, isNewChat: _isNewChat, botName = 'Autumn' }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

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
      setInput(''); // Clear input on new recording
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
      onSendMessage(input.trim());
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-[var(--bg-primary)] from-75% via-[var(--bg-primary)]/70 to-transparent flex flex-col items-center pointer-events-none z-20">
      <div className="w-full max-w-[880px] flex items-end gap-2 bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-subtle)] rounded-2xl py-2 px-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition-all pointer-events-auto">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.docx,.xlsx,.csv"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || disabled}
          title="Attach Document"
          aria-label="Attach Document"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 transition-colors shrink-0 mb-1 rounded-full w-9 h-9 flex items-center justify-center border-none bg-transparent cursor-pointer"
        >
          {isUploading ? <Loader2 size={18} className="animate-spin text-[var(--accent)]" /> : <Paperclip size={18} className="rotate-45" />}
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isUploading}
          placeholder={(disabled || isUploading || isGenerating) ? `${botName} is thinking...` : `Ask ${botName} anything...`}
          className="flex-1 max-h-[160px] bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] py-2.5 px-1 outline-none resize-none overflow-y-auto leading-relaxed border-none text-[0.95rem]"
          rows={1}
        />
        {isGenerating ? (
          <button
            onClick={onStop}
            className="w-9 h-9 shrink-0 mb-1 text-[var(--error)] bg-[color-mix(in_srgb,var(--error)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--error)_22%,transparent)] rounded-full transition-all flex items-center justify-center border border-[color-mix(in_srgb,var(--error)_30%,transparent)] shadow-xs"
            title="Stop generating"
            aria-label="Stop generating"
          >
            <div className="w-3 h-3 bg-current rounded-xs" />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0 mb-1">
            <button
              onClick={toggleRecording}
              disabled={disabled || isUploading}
              className={`w-9 h-9 rounded-full ${isRecording ? 'text-white bg-[var(--error)] animate-pulse' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'} transition-all flex items-center justify-center disabled:opacity-40 border-none bg-transparent cursor-pointer`}
              title={isRecording ? "Stop recording" : "Voice Input"}
              aria-label="Voice Input"
            >
              <Mic size={17} />
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || disabled}
              className="w-9 h-9 text-white bg-[var(--energy-gradient)] hover:shadow-[var(--energy-glow)] hover:brightness-110 active:scale-95 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center border-none cursor-pointer shadow-xs"
              title="Send message"
              aria-label="Send message"
            >
              <Send size={15} className={input.trim() ? "translate-x-[-0.5px]" : ""} />
            </button>
          </div>
        )}
      </div>
      
      <div className="w-full max-w-[880px] mt-2 pt-1 pointer-events-auto">
        <p className="text-center text-[0.68rem] text-[var(--text-muted)] tracking-wide">
          <span className="font-medium text-[var(--text-secondary)]">Autumn AI</span> • Private & Local • Information should be independently verified.
        </p>
      </div>
    </div>
  );
}
