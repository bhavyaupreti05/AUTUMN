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
import { ThumbsDown, ThumbsUp, Volume2, VolumeX, Copy, Check, Send } from 'lucide-react';

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

SyntaxHighlighter.alias('markup', ['html', 'xml']);

const CodeBlock = ({ language, value, theme }: { language: string, value: string, theme: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-md border border-[var(--border-subtle)] my-4 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--bg-surface-hover)] border-b border-[var(--border-subtle)] text-[0.75rem] text-[var(--text-muted)] font-mono uppercase tracking-wider">
        {language}
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-[var(--success)]" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={(theme === 'dark' ? vscDarkPlus : oneLight) as any}
        language={language}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: 0 }}
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

export function MessageBubble({ message, botName = 'Autumn', onRetry, isGenerating = false, onEdit, suggestedPrompts, onSuggestedPrompt }: MessageBubbleProps) {
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
      window.speechSynthesis.cancel(); // Cancel any existing speech
      
      // Clean up markdown before speaking
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
      // Feedback is optional and must never disrupt the conversation.
    }
  };

  return (
    <div className={clsx("flex w-full mb-5 group max-w-[960px] mx-auto", isUser ? "justify-end" : "justify-start gap-3.5")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] shrink-0 p-0.5 shadow-xs mt-1">
          <img src="/logo.png" alt="AI Avatar" className="w-full h-full rounded-lg object-cover" />
        </div>
      )}
      
      <div className={clsx("flex flex-col gap-1 min-w-0", isUser ? "items-end max-w-[80%]" : "items-start flex-1")}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-[0.92rem] font-bold text-[var(--accent)]">{botName}</span>
            <span className="text-[var(--text-muted)] text-[0.68rem]">Just now</span>
          </div>
        )}
        
        <div className={clsx(
          "leading-relaxed break-words overflow-hidden relative group/bubble text-[0.93rem]",
          isUser 
            ? "bg-[var(--msg-user-bg)] border border-[var(--msg-user-border)] text-[var(--text-primary)] shadow-xs py-2.5 px-4 rounded-2xl rounded-tr-xs" 
            : isError
              ? "bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[var(--error)] py-3 px-4 rounded-2xl w-full"
              : "bg-transparent text-[var(--text-primary)] w-full"
        )}>
          {isUser && !isEditing && onEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="absolute top-2 right-2 p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] opacity-0 group-hover/bubble:opacity-100 transition-opacity"
              title="Edit Message"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          )}

          {isError ? (
            <div className="font-medium">{message.content || "Couldn't generate a response"}</div>
          ) : isEditing ? (
            <div className="flex flex-col gap-2 min-w-[250px]">
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-md p-2 text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
                rows={1}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setIsEditing(false); setEditValue(message.content); }} className="px-3 py-1 text-sm rounded-md bg-[var(--bg-surface-hover)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} className="px-3 py-1 text-sm rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors">
                  Save & Send
                </button>
              </div>
            </div>
          ) : (
            <div className={clsx("prose max-w-none w-full", theme === 'dark' && "prose-invert", status === 'sending' && "typing-cursor")}>
              {parsedCharts && parsedCharts.map((chart: any, idx: number) => (
                <div key={idx} className="w-full h-[300px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-4 my-4 shadow-sm">
                  <h4 className="text-sm font-semibold mb-2 text-center text-[var(--text-secondary)]">Data Visualization</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart!.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey={chart!.xAxisKey} stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--accent)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }}/>
                      {chart!.dataKeys.map((key: string, i: number) => (
                        <Bar key={key} dataKey={key} fill={i === 0 ? 'var(--accent)' : i === 1 ? 'var(--success)' : 'var(--error)'} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table({ children, ...props }: any) {
                return (
                  <div className="overflow-x-auto my-4 w-full border border-[var(--border-subtle)] rounded-lg">
                    <table className="w-full text-left border-collapse text-sm" {...props}>
                      {children}
                    </table>
                  </div>
                );
              },
              thead({ children, ...props }: any) {
                return <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-subtle)]" {...props}>{children}</thead>;
              },
              th({ children, ...props }: any) {
                return <th className="px-4 py-2 font-semibold text-[var(--text-primary)]" {...props}>{children}</th>;
              },
              td({ children, ...props }: any) {
                return <td className="px-4 py-2 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]" {...props}>{children}</td>;
              },
              code({ className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const codeStr = String(children).replace(/\n$/, '');
                return match ? (
                  <CodeBlock language={match[1]} value={codeStr} theme={theme} />
                ) : (
                  <code className="bg-[var(--bg-surface-hover)] text-[var(--accent)] px-1.5 py-0.5 rounded-[var(--radius-sm)] font-mono text-sm" {...props}>
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
          <div className="mt-2 text-[0.8rem] text-[var(--text-muted)]">Response was cut off</div>
        )}
        {isError && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isGenerating}
            className="mt-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors underline cursor-pointer border-none bg-transparent p-0"
          >
            Retry
          </button>
        )}
        {!isUser && !isError && status === 'complete' && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[var(--text-muted)]" aria-label="Rate this answer">
              <button type="button" onClick={() => { setShowSuggestionInput(false); submitFeedback('positive'); }} aria-label="Helpful answer" aria-pressed={feedback === 'positive'} title="Helpful" className={clsx('rounded p-1 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--success)]', feedback === 'positive' && 'text-[var(--success)]')}><ThumbsUp size={14} /></button>
              <button type="button" onClick={() => {
                setFeedbackSaved(false);
                if (showSuggestionInput) {
                  setShowSuggestionInput(false);
                  submitFeedback('negative');
                } else {
                  setShowSuggestionInput(true);
                }
              }} aria-label="Unhelpful answer" aria-pressed={feedback === 'negative'} title="Not helpful" className={clsx('rounded p-1 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--error)]', feedback === 'negative' && 'text-[var(--error)]')}><ThumbsDown size={14} /></button>
              <button type="button" onClick={toggleSpeech} aria-label={isPlaying ? "Stop reading" : "Read aloud"} title={isPlaying ? "Stop reading" : "Read aloud"} className={clsx('rounded p-1 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--legacy-accent)]', isPlaying && 'text-[var(--legacy-accent)] animate-pulse')}>
                {isPlaying ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              {feedbackSaved && <span className="text-xs text-[var(--text-muted)]">Thanks for your feedback</span>}
            </div>
            {showSuggestionInput && (
              <div className="flex flex-col w-full max-w-md mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center gap-2 bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] rounded-full px-4 py-2 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition-all shadow-sm">
                  <input 
                    value={suggestion}
                    onChange={(e) => setSuggestion(e.target.value)}
                    placeholder="Provide a correction to train the bot..."
                    className="flex-1 bg-transparent text-[var(--text-primary)] text-xs focus:outline-none placeholder-[var(--text-muted)]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && suggestion.trim()) {
                        e.preventDefault();
                        submitFeedback('negative', suggestion);
                      }
                    }}
                    autoFocus
                  />
                  {suggestion.trim() ? (
                    <button type="button" onClick={() => submitFeedback('negative', suggestion)} className="text-[var(--accent)] hover:opacity-80 transition-opacity" title="Save correction">
                      <Send size={14} />
                    </button>
                  ) : (
                    <button type="button" onClick={() => { setShowSuggestionInput(false); submitFeedback('negative'); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-[10px] uppercase font-bold tracking-wider px-1">
                      Skip
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {!isUser && !isError && suggestedPrompts?.length && onSuggestedPrompt && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested document actions">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onSuggestedPrompt(prompt)}
                className="rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,var(--border-subtle))] bg-[var(--bg-surface)] px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
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
