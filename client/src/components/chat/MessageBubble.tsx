import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { parseMarkdownTable } from '../../utils/tableParser';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import { useTheme } from '../../contexts/ThemeContext';
import { ThumbsDown, ThumbsUp, Volume2, VolumeX, Copy, Check, Send, RotateCw } from 'lucide-react';

SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('markup', markup);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.alias('javascript', ['js', 'jsx']);
SyntaxHighlighter.alias('typescript', ['ts', 'tsx']);
SyntaxHighlighter.alias('python', ['py']);
SyntaxHighlighter.alias('bash', ['sh', 'shell']);
SyntaxHighlighter.alias('markup', ['html', 'xml']);

const CodeBlock = ({ language, value, theme }: { language: string, value: string, theme: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-xl border border-white/10 my-4 overflow-hidden shadow-lg bg-[#0A0A0F]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#12121A] border-b border-white/5 text-[0.72rem] text-zinc-400 font-mono uppercase tracking-wider">
        <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
          <span className="w-2 h-2 rounded-full bg-[#8B2BFF]" />
          {language || 'code'}
        </span>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer border-none bg-transparent text-zinc-400"
          title="Copy code"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          <span className="text-[0.68rem]">{copied ? 'Copied!' : 'Copy code'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        style={(theme === 'dark' ? vscDarkPlus : oneLight) as any}
        language={language}
        PreTag="div"
        customStyle={{ margin: 0, padding: '1rem', background: '#07070A', fontSize: '0.86rem', lineHeight: '1.6' }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'sending' | 'complete' | 'aborted' | 'error' | 'timeout';
}

interface MessageBubbleProps {
  message: Message;
  botName?: string;
  onRetry?: () => void;
  isGenerating?: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  suggestedPrompts?: string[];
  onSuggestedPrompt?: (prompt: string) => void;
}

export function MessageBubble({ 
  message, 
  botName = 'Autumn', 
  onRetry, 
  isGenerating = false, 
  onEdit, 
  suggestedPrompts, 
  onSuggestedPrompt 
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const status = message.status ?? 'complete';
  const isError = !isUser && status === 'error';
  const isAborted = !isUser && status === 'aborted';
  const { theme } = useTheme();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [showSuggestionInput, setShowSuggestionInput] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const parsedCharts = useMemo(() => {
    if (isUser || isError) return null;
    return parseMarkdownTable(message.content);
  }, [message.content, isUser, isError]);

  const toggleSpeech = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      window.speechSynthesis.cancel();
      
      const plainText = message.content
        .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
        .replace(/\[Source: Page \d+\]/g, '')
        .replace(/[#*`]/g, '');
        
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    }
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(message.content);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  }, [editValue, isEditing]);

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== message.content && onEdit) {
      onEdit(message.id, editValue);
    }
    setIsEditing(false);
  };

  const submitFeedback = async (rating: 'positive' | 'negative', suggestionText?: string) => {
    try {
      const response = await fetch(`/api/messages/${message.id}/feedback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, suggestion: suggestionText || null }),
      });
      if (response.ok) {
        setFeedback(rating);
        setFeedbackSaved(true);
        setShowSuggestionInput(false);
      }
    } catch {
      // Feedback is optional and must not disrupt the conversation.
    }
  };

  return (
    <div className={clsx("flex w-full mb-6 group max-w-[960px] mx-auto", isUser ? "justify-end" : "justify-start gap-4")}>
      
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="relative w-8 h-8 rounded-xl bg-black border border-[#8B2BFF]/40 p-1 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(139,43,255,0.4)] mt-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#8B2BFF] shadow-[0_0_8px_#8B2BFF]" />
        </div>
      )}
      
      <div className={clsx("flex flex-col gap-1 min-w-0", isUser ? "items-end max-w-[85%]" : "items-start flex-1")}>
        
        {/* Assistant Header */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-[0.88rem] font-bold text-white flex items-center gap-1.5">
              {botName}
              <span className="text-[0.62rem] text-[#8B2BFF] bg-[#8B2BFF]/15 border border-[#8B2BFF]/30 px-1.5 py-0.2 rounded-sm uppercase tracking-wider font-semibold">AI OS</span>
            </span>
            <span className="text-zinc-500 text-[0.68rem]">Just now</span>
          </div>
        )}
        
        {/* Bubble Content */}
        <div className={clsx(
          "leading-relaxed break-words overflow-hidden relative group/bubble text-[0.93rem]",
          isUser 
            ? "bg-[#0E0C16] border border-[#8B2BFF]/35 text-white shadow-[0_0_20px_rgba(139,43,255,0.12)] py-3 px-5 rounded-2xl rounded-tr-xs" 
            : isError
              ? "bg-red-500/10 border border-red-500/30 text-red-300 py-4 px-5 rounded-2xl w-full shadow-sm"
              : "bg-transparent text-zinc-100 w-full"
        )}>
          
          {/* Edit User Message Button */}
          {isUser && !isEditing && onEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="absolute top-2 right-2 p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 opacity-0 group-hover/bubble:opacity-100 transition-opacity"
              title="Edit Message"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          )}

          {isError ? (
            <div className="flex flex-col gap-2">
              <div className="font-semibold text-red-400">Execution Notice</div>
              <div className="text-xs text-red-300 leading-relaxed font-mono bg-red-950/40 p-3 rounded-lg border border-red-500/20">
                {message.content || "Couldn't generate a response"}
              </div>
            </div>
          ) : isEditing ? (
            <div className="flex flex-col gap-2 min-w-[280px]">
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-black text-white border border-[#8B2BFF]/40 rounded-xl p-3 text-sm focus:outline-none focus:border-[#8B2BFF] resize-none"
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setIsEditing(false); setEditValue(message.content); }} className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-zinc-300 hover:text-white transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} className="px-3 py-1.5 text-xs rounded-lg bg-[#8B2BFF] text-white hover:bg-[#9D4BFF] transition-colors font-medium">
                  Save & Resend
                </button>
              </div>
            </div>
          ) : (
            <div className={clsx("prose max-w-none w-full text-zinc-100", theme === 'dark' && "prose-invert", status === 'sending' && "typing-cursor")}>
              
              {/* Optional Recharts Table Visualizer */}
              {parsedCharts && parsedCharts.map((chart: any, idx: number) => (
                <div key={idx} className="w-full h-[300px] bg-[#0A0A0F] border border-white/10 rounded-xl p-4 my-4 shadow-md">
                  <h4 className="text-xs font-semibold mb-2 text-center text-zinc-400 uppercase tracking-wider">Dynamic Data Chart</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart!.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey={chart!.xAxisKey} stroke="#71717A" fontSize={11} />
                      <YAxis stroke="#71717A" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0D0D14', borderColor: 'rgba(139,43,255,0.3)', color: '#FFFFFF', borderRadius: '12px' }}
                        itemStyle={{ color: '#8B2BFF' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }}/>
                      {chart!.dataKeys.map((key: string, i: number) => (
                        <Bar key={key} dataKey={key} fill={i === 0 ? '#8B2BFF' : i === 1 ? '#10B981' : '#EF4444'} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}

              {/* Markdown Content */}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table({ children, ...props }: any) {
                    return (
                      <div className="overflow-x-auto my-4 w-full border border-white/10 rounded-xl bg-[#09090D] shadow-sm">
                        <table className="w-full text-left border-collapse text-xs" {...props}>
                          {children}
                        </table>
                      </div>
                    );
                  },
                  thead({ children, ...props }: any) {
                    return <thead className="bg-[#12121A] border-b border-white/10 text-white" {...props}>{children}</thead>;
                  },
                  th({ children, ...props }: any) {
                    return <th className="px-4 py-2.5 font-bold text-white tracking-wider" {...props}>{children}</th>;
                  },
                  td({ children, ...props }: any) {
                    return <td className="px-4 py-2 border-b border-white/5 text-zinc-300" {...props}>{children}</td>;
                  },
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeStr = String(children).replace(/\n$/, '');
                    return match ? (
                      <CodeBlock language={match[1]} value={codeStr} theme={theme} />
                    ) : (
                      <code className="bg-[#161622] text-[#A75BFF] px-1.5 py-0.5 rounded font-mono text-[0.82rem] border border-[#8B2BFF]/20" {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        
          {isAborted && (
            <div className="mt-2 text-[0.75rem] text-zinc-500 font-medium italic">Response was stopped</div>
          )}

          {isError && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isGenerating}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B2BFF]/20 hover:bg-[#8B2BFF]/30 border border-[#8B2BFF]/40 text-xs text-white font-medium transition-colors cursor-pointer"
            >
              <RotateCw size={12} />
              <span>Retry generation</span>
            </button>
          )}

          {/* Action Bar for Assistant */}
          {!isUser && !isError && status === 'complete' && (
            <div className="mt-3 pt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-zinc-400" aria-label="Message actions">
                
                {/* Thumbs Up */}
                <button 
                  type="button" 
                  onClick={() => { setShowSuggestionInput(false); submitFeedback('positive'); }} 
                  aria-label="Helpful answer" 
                  aria-pressed={feedback === 'positive'} 
                  title="Helpful" 
                  className={clsx('rounded-lg p-1.5 hover:bg-white/5 hover:text-emerald-400 transition-colors', feedback === 'positive' && 'text-emerald-400 bg-emerald-500/10')}
                >
                  <ThumbsUp size={13} />
                </button>

                {/* Thumbs Down */}
                <button 
                  type="button" 
                  onClick={() => {
                    setFeedbackSaved(false);
                    if (showSuggestionInput) {
                      setShowSuggestionInput(false);
                      submitFeedback('negative');
                    } else {
                      setShowSuggestionInput(true);
                    }
                  }} 
                  aria-label="Unhelpful answer" 
                  aria-pressed={feedback === 'negative'} 
                  title="Not helpful" 
                  className={clsx('rounded-lg p-1.5 hover:bg-white/5 hover:text-red-400 transition-colors', feedback === 'negative' && 'text-red-400 bg-red-500/10')}
                >
                  <ThumbsDown size={13} />
                </button>

                {/* Copy Response */}
                <button 
                  type="button" 
                  onClick={handleCopyResponse}
                  aria-label="Copy entire response" 
                  title="Copy response" 
                  className="rounded-lg p-1.5 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-1"
                >
                  {copiedResponse ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>

                {/* Read aloud */}
                <button 
                  type="button" 
                  onClick={toggleSpeech} 
                  aria-label={isPlaying ? "Stop reading" : "Read aloud"} 
                  title={isPlaying ? "Stop reading" : "Read aloud"} 
                  className={clsx('rounded-lg p-1.5 hover:bg-white/5 hover:text-[#8B2BFF] transition-colors', isPlaying && 'text-[#8B2BFF] animate-pulse')}
                >
                  {isPlaying ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>

                {feedbackSaved && (
                  <span className="text-[0.68rem] text-emerald-400 ml-1">Feedback saved</span>
                )}
              </div>

              {/* Memory Training Correction Input */}
              {showSuggestionInput && (
                <div className="flex flex-col w-full max-w-md mt-1 animate-fade-in">
                  <div className="flex items-center gap-2 bg-[#0D0D14] border border-[#8B2BFF]/40 rounded-full px-3.5 py-1.5 shadow-sm">
                    <input 
                      value={suggestion}
                      onChange={(e) => setSuggestion(e.target.value)}
                      placeholder="Add correction to train Autumn's AI memory..."
                      className="flex-1 bg-transparent text-white text-xs focus:outline-none placeholder-zinc-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && suggestion.trim()) {
                          e.preventDefault();
                          submitFeedback('negative', suggestion);
                        }
                      }}
                      autoFocus
                    />
                    {suggestion.trim() ? (
                      <button type="button" onClick={() => submitFeedback('negative', suggestion)} className="text-[#8B2BFF] hover:text-white transition-colors" title="Save correction">
                        <Send size={13} />
                      </button>
                    ) : (
                      <button type="button" onClick={() => { setShowSuggestionInput(false); submitFeedback('negative'); }} className="text-zinc-500 hover:text-white text-[0.65rem] uppercase font-bold tracking-wider px-1">
                        Skip
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Follow-up Suggested Prompts */}
          {!isUser && !isError && suggestedPrompts?.length && onSuggestedPrompt && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested follow-up actions">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSuggestedPrompt(prompt)}
                  className="rounded-full border border-[#8B2BFF]/30 bg-[#0D0D14] hover:bg-[#8B2BFF]/15 px-3 py-1.5 text-left text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-xs cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
