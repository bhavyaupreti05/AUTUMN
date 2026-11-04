import { lazy, Suspense, useRef, useState } from 'react';
import { 
  ArrowDown, 
  Zap, 
  Code2, 
  Layers, 
  Box, 
  ArrowUpRight, 
  Cpu, 
  Database, 
  Wrench, 
  Activity, 
  Quote, 
  Sparkles 
} from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

const MessageBubble = lazy(() => import('./MessageBubble').then(module => ({ default: module.MessageBubble })));

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'sending' | 'complete' | 'aborted' | 'error' | 'timeout';
  agent?: {
    id: string;
    name: string;
    title: string;
    color: string;
    icon: string;
  };
  thoughts?: string[];
  isThinking?: boolean;
}

interface ChatAreaProps {
  messages: Message[];
  isGenerating: boolean;
  botName?: string;
  onRetry?: (message: Message) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  documentsCount?: number;
  onSuggestedPrompt?: (prompt: string, agentMode?: string) => void;
  username?: string | null;
  starterQuestions?: string[];
  onOpenFileUpload?: () => void;
}

export function canShowSuggestedPrompts(messages: Message[], index: number, isGenerating: boolean, message: Message): boolean {
  return !isGenerating && index === messages.length - 1 && message.role === 'assistant' && message.status !== 'error';
}

export function getDisplayName(username: string | null | undefined): string {
  const localPart = username?.split('@')[0].trim();
  if (!localPart) return 'Bhavya';

  return localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getSuggestedPrompts(messages: Message[], assistantIndex: number, documentsCount: number): string[] {
  const assistantContent = messages[assistantIndex]?.content.toLowerCase() || '';
  if (/could you (please )?(specify|clarify)|what (context|field|would you like)|please provide more context/.test(assistantContent)) {
    return [];
  }

  if (documentsCount > 0) {
    return ['Summarize the key findings', 'Show citations & sources', 'Extract action items'];
  }

  const previousUserMessage = [...messages.slice(0, assistantIndex)]
    .reverse()
    .find((message) => message.role === 'user' && !/what is the next useful question|what related question should i ask|what is the practical next step/i.test(message.content))?.content || '';
  const normalizedUserMessage = previousUserMessage.toLowerCase();
  const topic = previousUserMessage.replace(/\s+/g, ' ').trim().replace(/[?.!]+$/, '').slice(0, 90);

  if (/summar|overview|main points|key points/.test(normalizedUserMessage)) {
    return ['Extract action items', 'Show the supporting sections'];
  }

  if (/compar|difference|versus| vs\.? |similar|different/.test(normalizedUserMessage)) {
    return ['Highlight the biggest differences', 'Identify possible trade-offs'];
  }

  if (/code|python|bug|error|function|script|typescript|react/.test(normalizedUserMessage)) {
    return ['Write unit tests for this', 'Optimize time & memory complexity', 'Explain how this works step-by-step'];
  }

  if (/how do|how can|steps|help me|guide|learn/.test(normalizedUserMessage)) {
    return ['Break it into structured steps', 'What are common pitfalls to avoid?'];
  }

  const context = topic || 'this topic';
  return [`Can you explain "${context}" in more detail?`, `What is the practical next step for "${context}"?`];
}

export function ChatArea({ 
  messages, 
  isGenerating, 
  botName = 'Autumn', 
  onRetry, 
  onEdit, 
  documentsCount = 0, 
  onSuggestedPrompt, 
  username, 
  starterQuestions,
  onOpenFileUpload
}: ChatAreaProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hiddenStarters, setHiddenStarters] = useState<Set<string>>(new Set());
  const displayName = getDisplayName(username);

  const activeStarters = (starterQuestions || []).filter(q => !hiddenStarters.has(q));

  // 4 Main Feature Cards
  const featureCards = [
    {
      id: 'ask-anything',
      title: 'Ask Anything',
      subtitle: 'Get instant answers.',
      icon: Zap,
      action: () => onSuggestedPrompt?.("Give me a concise briefing on what you can do for me as my personal AI operating system.", "auto")
    },
    {
      id: 'build-code',
      title: 'Build & Code',
      subtitle: 'Generate, debug, deploy.',
      icon: Code2,
      action: () => onSuggestedPrompt?.("Write a clean, production-ready async Python FastAPI service with error handling and typing.", "dev")
    },
    {
      id: 'analyze-files',
      title: 'Analyze Files',
      subtitle: 'Summarize & explore.',
      icon: Layers,
      action: () => {
        if (documentsCount > 0) {
          onSuggestedPrompt?.("Synthesize the key insights and data from my attached documents with exact source citations.", "researcher");
        } else if (onOpenFileUpload) {
          onOpenFileUpload();
        } else {
          onSuggestedPrompt?.("How do I upload and ask questions about my PDFs or documents?", "researcher");
        }
      }
    },
    {
      id: 'create-something',
      title: 'Create Something',
      subtitle: 'Ideas to execution.',
      icon: Box,
      action: () => onSuggestedPrompt?.("Pitch 3 innovative full-stack AI project architectures that stand out to tech recruiters.", "strategist")
    }
  ];

  // AI Workspace Quick Action Pills
  const quickActions = [
    {
      label: 'Summarize this PDF',
      action: () => {
        if (documentsCount > 0) {
          onSuggestedPrompt?.("Summarize the attached documents and highlight the core findings with bullet points.", "researcher");
        } else if (onOpenFileUpload) {
          onOpenFileUpload();
        } else {
          onSuggestedPrompt?.("Please summarize the attached PDF document.", "researcher");
        }
      }
    },
    {
      label: 'Plan my study schedule',
      action: () => onSuggestedPrompt?.("Design a high-yield 14-day study schedule for mastering system design and algorithms.", "strategist")
    },
    {
      label: 'Explain this code',
      action: () => onSuggestedPrompt?.("Explain this algorithm step-by-step with time/space complexity and a real-world analogy:", "dev")
    },
    {
      label: 'Suggest a project idea',
      action: () => onSuggestedPrompt?.("Suggest an ambitious, high-impact AI engineer project that solves a real business problem.", "strategist")
    },
    {
      label: 'Check my resume',
      action: () => onSuggestedPrompt?.("Review my resume points and provide actionable bullet rewrites using Google's X-Y-Z formula.", "strategist")
    }
  ];

  const DashboardHero = () => {
    if (messages.length > 0) return null;

    return (
      <div className="flex w-full flex-col items-center pt-6 sm:pt-10 pb-44 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto animate-fade-in">
        
        {/* SECTION C: Welcome Hero */}
        <div className="w-full text-left mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            Autonomous AI Operating System
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--text-primary)] leading-tight">
            Welcome back,{' '}
            <span className="text-[var(--text-primary)] relative inline-block">
              {displayName}
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[var(--text-secondary)] mt-2.5 font-normal tracking-wide max-w-2xl">
            Your personal AI companion, always one step ahead.
          </p>

          {/* Subtle stealth underline */}
          <div className="w-28 h-1 bg-[var(--accent)] rounded-full opacity-60 mt-4" />
        </div>

        {/* SECTION D: Four Main Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mb-10">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={card.action}
                className="group relative p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] transition-all duration-300 cursor-pointer shadow-md hover:-translate-y-1 flex flex-col justify-between min-h-[140px]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] group-hover:scale-110 group-hover:bg-[var(--accent)] group-hover:text-[var(--primary-foreground)] transition-all duration-300">
                    <Icon size={20} />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--text-primary)] group-hover:border-[var(--border-hover)] transition-all duration-300">
                    <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">
                    {card.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* SECTION E & F: Main Content Grid (AI Workspace + Right Information Panel) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          
          {/* LEFT 7-COL: Your AI Workspace */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-md flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-[var(--text-primary)]" />
                  <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Your AI Workspace</h2>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-6">
                  Select a workflow or quick action to jump straight into deep work. All tasks run with full context retention and document citations.
                </p>

                {/* Quick Action Pills */}
                <div className="flex flex-wrap gap-2.5">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={action.action}
                      className="px-4 py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-xs active:scale-95 text-left"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Workspace footer status */}
              <div className="mt-8 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-[0.72rem] text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  RAG Document Engine Active
                </span>
                <span>Autumn Cloud • Zero Latency</span>
              </div>
            </div>
          </div>

          {/* RIGHT 5-COL: Three Compact Widgets (System Status, Today's Vibe, Autumn Quote) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Widget 1: System Status */}
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <Activity size={15} className="text-[var(--text-primary)]" />
                  <span className="text-xs font-bold text-[var(--text-primary)] tracking-wide uppercase">System Status</span>
                </div>
                <span className="text-[0.65rem] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Optimal
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-1 text-[0.68rem] text-[var(--text-muted)] font-medium">
                    <Cpu size={12} className="text-[var(--text-primary)]" />
                    <span>Intelligence</span>
                  </div>
                  <div className="text-[0.76rem] font-bold text-[var(--text-primary)] mt-1 truncate">
                    Autumn Neural Core
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-1 text-[0.68rem] text-[var(--text-muted)] font-medium">
                    <Database size={12} className="text-[var(--text-primary)]" />
                    <span>Memory</span>
                  </div>
                  <div className="text-[0.76rem] font-bold text-[var(--text-primary)] mt-1">
                    Active & Adaptive
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-1 text-[0.68rem] text-[var(--text-muted)] font-medium">
                    <Wrench size={12} className="text-[var(--text-primary)]" />
                    <span>Architecture</span>
                  </div>
                  <div className="text-[0.76rem] font-bold text-[var(--text-primary)] mt-1">
                    Multi-Agent OS
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-1 text-[0.68rem] text-emerald-500 font-medium">
                    <Zap size={12} className="text-emerald-500" />
                    <span>Performance</span>
                  </div>
                  <div className="text-[0.76rem] font-bold text-emerald-500 mt-1">
                    Real-Time
                  </div>
                </div>
              </div>
            </div>

            {/* Widget 2: Today's Vibe */}
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-end gap-0.5 h-3.5">
                    <span className="w-0.5 h-3 bg-[var(--text-primary)] animate-pulse rounded-full" />
                    <span className="w-0.5 h-4 bg-[var(--text-secondary)] animate-pulse rounded-full delay-75" />
                    <span className="w-0.5 h-2 bg-[var(--text-primary)] animate-pulse rounded-full delay-150" />
                    <span className="w-0.5 h-3.5 bg-[var(--text-secondary)] animate-pulse rounded-full delay-100" />
                  </div>
                  <span className="text-xs font-bold text-[var(--text-primary)] tracking-wide uppercase">Today's Vibe</span>
                </div>
                <span className="text-[0.68rem] font-medium text-[var(--text-secondary)]">Deep Work</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-medium mt-1">
                Peak cognitive energy. Autumn is calibrated for high-speed technical problem solving.
              </p>
            </div>

            {/* Widget 3: Autumn Quote */}
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm relative overflow-hidden">
              <Quote size={32} className="absolute -bottom-2 -right-2 text-[var(--text-muted)] opacity-20 pointer-events-none" />
              <div className="text-[0.82rem] font-bold text-[var(--text-primary)] italic tracking-wide">
                "Dream bigger. Build better."
              </div>
              <div className="text-[0.7rem] text-[var(--text-secondary)] font-semibold mt-1.5 flex items-center gap-1">
                <span>— Autumn</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  };

  return (
    <div className="flex-1 w-full h-full relative min-h-0 bg-[var(--bg-primary)]">
      <Virtuoso
        className="w-full h-full"
        data={messages}
        ref={virtuosoRef}
        followOutput={(isAtBottom) => isAtBottom ? 'smooth' : false}
        atBottomStateChange={setIsAtBottom}
        initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
        itemContent={(index, msg) => {
          const isLatestAndReady = canShowSuggestedPrompts(messages, index, isGenerating, msg);
          let promptsToShow: string[] | undefined = undefined;
          
          if (isLatestAndReady) {
            if (activeStarters.length > 0) {
              promptsToShow = activeStarters;
            } else {
              promptsToShow = getSuggestedPrompts(messages, index, documentsCount);
            }
          }

          return (
            <div className="flex flex-col items-center w-full px-4 sm:px-6 lg:px-8 pb-8 overflow-x-hidden">
              <Suspense fallback={<div className="w-full text-[var(--text-primary)] whitespace-pre-wrap">{msg.content}</div>}>
                <MessageBubble
                  message={msg}
                  botName={botName}
                  onRetry={onRetry && msg.status === 'error' ? () => onRetry(msg) : undefined}
                  isGenerating={isGenerating}
                  onEdit={onEdit}
                  suggestedPrompts={promptsToShow}
                  onSuggestedPrompt={(q) => {
                    if (activeStarters.includes(q)) {
                      setHiddenStarters(prev => new Set(prev).add(q));
                    }
                    onSuggestedPrompt?.(q);
                  }}
                />
              </Suspense>
            </div>
          );
        }}
        components={{
          Header: () => <DashboardHero />,
          Footer: () => (
            <div className="flex flex-col items-center w-full px-4 sm:px-6 lg:px-8 pb-[220px]">
              {isGenerating && (
                <div className="flex w-full max-w-[960px] flex-row items-center gap-3 animate-fade-in p-3 rounded-xl bg-[var(--bg-surface)]/90 border border-[var(--border-subtle)] backdrop-blur-sm shadow-md">
                  <div className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-strong)] flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping" />
                  </div>
                  <div className="text-[var(--text-secondary)] text-xs font-medium flex items-center gap-2">
                    <span>Autumn is thinking and synthesizing response...</span>
                  </div>
                </div>
              )}
            </div>
          )
        }}
      />
      {!isAtBottom && (
        <button
          type="button"
          aria-label="Jump to latest"
          title="Jump to latest"
          onClick={() => virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' })}
          className="absolute bottom-36 sm:bottom-40 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-lg transition-all hover:bg-[var(--accent)] hover:text-[var(--primary-foreground)]"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}
