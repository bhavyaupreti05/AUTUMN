import { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';
import { Send, Paperclip, Loader2, Mic, Square } from 'lucide-react';

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

export function ChatInput({ 
  onSendMessage, 
  disabled, 
  onUploadFile, 
  isUploading, 
  isGenerating, 
  onStop, 
  botName = 'Autumn' 
}: ChatInputProps) {
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  return (
    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 bg-gradient-to-t from-black via-black/85 to-transparent flex flex-col items-center pointer-events-none z-30">
      
      {/* SECTION G: Chat Composer Container */}
      <div className="w-full max-w-[880px] flex items-end gap-2.5 bg-[#09090D] border border-[#8B2BFF]/35 rounded-[24px] py-2.5 px-4 shadow-[0_0_25px_rgba(139,43,255,0.18)] focus-within:border-[#8B2BFF] focus-within:shadow-[0_0_35px_rgba(139,43,255,0.32)] transition-all pointer-events-auto">
        
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
          className="text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-40 transition-colors shrink-0 mb-1 rounded-full w-9 h-9 flex items-center justify-center border-none bg-transparent cursor-pointer"
        >
          {isUploading ? (
            <Loader2 size={18} className="animate-spin text-[#8B2BFF]" />
          ) : (
            <Paperclip size={18} className="rotate-45 hover:text-[#8B2BFF] transition-colors" />
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
          className="flex-1 max-h-[160px] bg-transparent text-white placeholder:text-zinc-500 py-2 px-1 outline-none resize-none overflow-y-auto leading-relaxed border-none text-[0.94rem] font-normal"
          rows={1}
        />

        {/* Action Buttons: Stop / Voice / Purple Circular Send */}
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
              className={`w-9 h-9 rounded-full ${isRecording ? 'text-white bg-red-600 animate-pulse' : 'text-zinc-400 hover:text-white hover:bg-white/5'} transition-all flex items-center justify-center disabled:opacity-40 border-none bg-transparent cursor-pointer`}
              title={isRecording ? "Stop recording" : "Voice Input"}
              aria-label="Voice Input"
            >
              <Mic size={18} className={isRecording ? "text-white" : "hover:text-[#8B2BFF]"} />
            </button>

            {/* Purple Circular Send Button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || disabled}
              className="w-10 h-10 text-white bg-gradient-to-tr from-[#8B2BFF] via-[#7B1FFF] to-[#581C87] hover:brightness-110 active:scale-95 rounded-full disabled:opacity-35 disabled:cursor-not-allowed transition-all flex items-center justify-center border border-[#A75BFF]/30 cursor-pointer shadow-[0_0_18px_rgba(139,43,255,0.45)]"
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
        <p className="text-center text-[0.68rem] text-zinc-500 tracking-wide font-medium">
          <span className="text-[#8B2BFF] font-semibold">Autumn AI</span> • Enterprise Grade Local & Cloud Intelligence • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
