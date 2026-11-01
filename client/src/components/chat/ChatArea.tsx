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
}

interface ChatAreaProps {
  messages: Message[];
  isGenerating: boolean;
  botName?: string;
  onRetry?: (message: Message) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  documentsCount?: number;
  onSuggestedPrompt?: (prompt: string) => void;
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
      action: () => onSuggestedPrompt?.("Give me a concise briefing on what you can do for me as my personal AI operating system.")
    },
    {
      id: 'build-code',
      title: 'Build & Code',
      subtitle: 'Generate, debug, deploy.',
      icon: Code2,
      action: () => onSuggestedPrompt?.("Write a clean, production-ready async Python FastAPI service with error handling and typing.")
    },
    {
      id: 'analyze-files',
      title: 'Analyze Files',
      subtitle: 'Summarize & explore.',
      icon: Layers,
      action: () => {
        if (onOpenFileUpload) {
          onOpenFileUpload();
        } else {
          onSuggestedPrompt?.("How do I upload and ask questions about my PDFs or documents?");
        }
      }
    },
    {
      id: 'create-something',
      title: 'Create Something',
      subtitle: 'Ideas to execution.',
      icon: Box,
      action: () => onSuggestedPrompt?.("Pitch 3 innovative full-stack AI project architectures that stand out to tech recruiters.")
    }
  ];

  // AI Workspace Quick Action Pills
  const quickActions = [
    {
      label: 'Summarize this PDF',
      action: () => {
        if (documentsCount > 0) {
          onSuggestedPrompt?.("Summarize the attached documents and highlight the core findings with bullet points.");
        } else if (onOpenFileUpload) {
          onOpenFileUpload();
        } else {
          onSuggestedPrompt?.("Please summarize the attached PDF document.");
        }
      }
    },
    {
      label: 'Plan my study schedule',
      action: () => onSuggestedPrompt?.("Design a high-yield 14-day study schedule for mastering system design and algorithms.")
    },
    {
      label: 'Explain this code',
      action: () => onSuggestedPrompt?.("Explain this algorithm step-by-step with time/space complexity and a real-world analogy:")
    },
    {
      label: 'Suggest a project idea',
      action: () => onSuggestedPrompt?.("Suggest an ambitious, high-impact AI engineer project that solves a real business problem.")
    },
    {
      label: 'Check my resume',
      action: () => onSuggestedPrompt?.("Review my resume points and provide actionable bullet rewrites using Google's X-Y-Z formula.")
    }
  ];

  const DashboardHero = () => {
    if (messages.length > 0) return null;

    return (
      <div className="flex w-full flex-col items-center pt-6 sm:pt-10 pb-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto animate-fade-in">
        
        {/* SECTION C: Welcome Hero */}
        <div className="w-full text-left mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8B2BFF]/10 border border-[#8B2BFF]/30 text-[#8B2BFF] text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B2BFF] animate-pulse" />
            Autonomous AI Operating System
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Welcome back,{' '}
            <span className="text-[#8B2BFF] relative inline-block drop-shadow-[0_0_25px_rgba(139,43,255,0.45)]">
              {displayName}
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 mt-2.5 font-normal tracking-wide max-w-2xl">
            Your personal AI companion, always one step ahead.
          </p>

          {/* Subtle purple glowing underline */}
          <div className="w-28 h-1 bg-gradient-to-r from-[#8B2BFF] via-[#A75BFF] to-transparent rounded-full shadow-[0_0_12px_#8B2BFF] mt-4" />
        </div>

        {/* SECTION D: Four Main Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mb-10">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={card.action}
                className="group relative p-5 rounded-2xl bg-[#0D0D14] border border-white/5 hover:border-[#8B2BFF]/50 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-[0_10px_30px_-5px_rgba(139,43,255,0.25)] hover:-translate-y-1 flex flex-col justify-between min-h-[140px]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#8B2BFF]/15 border border-[#8B2BFF]/30 flex items-center justify-center text-[#8B2BFF] group-hover:scale-110 group-hover:bg-[#8B2BFF] group-hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(139,43,255,0.2)]">
                    <Icon size={20} />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:border-[#8B2BFF]/50 group-hover:bg-[#8B2BFF]/20 transition-all duration-300">
                    <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-[#A75BFF] transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 font-medium">
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
            <div className="p-6 rounded-2xl bg-[#0B0B10] border border-white/5 shadow-md flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-[#8B2BFF]" />
                  <h2 className="text-lg font-bold text-white tracking-tight">Your AI Workspace</h2>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                  Select a workflow or quick action to jump straight into deep work. All tasks run with full context retention and document citations.
                </p>

                {/* Quick Action Pills */}
                <div className="flex flex-wrap gap-2.5">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={action.action}
                      className="px-4 py-2 rounded-xl bg-[#12121A] hover:bg-[#1A1A26] border border-white/5 hover:border-[#8B2BFF]/40 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer shadow-xs hover:shadow-[0_0_15px_rgba(139,43,255,0.2)] active:scale-95 text-left"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Workspace footer status */}
              <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-[0.72rem] text-zinc-500">
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
            <div className="p-4 rounded-2xl bg-[#0B0B10] border border-white/5 shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Activity size={15} className="text-[#8B2BFF]" />
                  <span className="text-xs font-bold text-white tracking-wide uppercase">System Status</span>
                </div>
                <span className="text-[0.65rem] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Optimal
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-[#12121A] border border-white/5">
                  <div className="flex items-center gap-1 text-[0.68rem] text-zinc-400 font-medium">
                    <Cpu size={12} className="text-[#8B2BFF]" />
                    <span>AI Model</span>
                  </div>
                  <div className="text-[0.76rem] font-bold text-white mt-1 truncate" title="Groq Qwen 2.5 32B / Llama">
                    Qwen 2.5 32B Cloud
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#12121A] border border-white/5">
                  <div className="flex items-center gap-1 text-[0.68rem] text-zinc-400 font-medium">
                    <Database size={12} className="text-[#8B2BFF]" />
                    <span>Memory</span>
                  </div>
                  <div className="text-[0.76rem] font-bold text-white mt-1">
                    SQLite + Vector
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#12121A] border border-white/5">
                  <div className="flex items-center gap-1 text-[0.68rem] text-zinc-400 font-medium">
                    <Wrench size={12} className="text-[#8B2BFF]" />
                    <span>Tools</span>
                  </div>
                  <div className="text-[0.76rem] font-bold text-white mt-1">
                    RAG, Code, Doc
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#12121A] border border-white/5">
                  <div className="flex items-center gap-1 text-[0.68rem] text-zinc-400 font-medium">
                    <Zap size={12} className="text-emerald-400" />
                    <span>Performance</span>
                  </div>
                  <div className="text-[0.76rem] font-bold text-emerald-400 mt-1">
                    &lt; 200ms TTFT
                  </div>
                </div>
              </div>
            </div>

            {/* Widget 2: Today's Vibe */}
            <div className="p-4 rounded-2xl bg-[#0B0B10] border border-white/5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-end gap-0.5 h-3.5">
                    <span className="w-0.5 h-3 bg-[#8B2BFF] animate-pulse rounded-full" />
                    <span className="w-0.5 h-4 bg-[#A75BFF] animate-pulse rounded-full delay-75" />
                    <span className="w-0.5 h-2 bg-[#8B2BFF] animate-pulse rounded-full delay-150" />
                    <span className="w-0.5 h-3.5 bg-[#A75BFF] animate-pulse rounded-full delay-100" />
                  </div>
                  <span className="text-xs font-bold text-white tracking-wide uppercase">Today's Vibe</span>
                </div>
                <span className="text-[0.68rem] font-medium text-purple-300">Deep Work</span>
              </div>
              <p className="text-xs text-zinc-400 font-medium mt-1">
                Peak cognitive energy. Autumn is calibrated for high-speed technical problem solving.
              </p>
            </div>

            {/* Widget 3: Autumn Quote */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0F0A1C] to-[#0A0A0F] border border-[#8B2BFF]/25 shadow-sm relative overflow-hidden">
              <Quote size={32} className="absolute -bottom-2 -right-2 text-[#8B2BFF]/10 pointer-events-none" />
              <div className="text-[0.82rem] font-bold text-white italic tracking-wide">
                "Dream bigger. Build better."
              </div>
              <div className="text-[0.7rem] text-[#A75BFF] font-semibold mt-1.5 flex items-center gap-1">
                <span>— Autumn</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  };

  return (
    <div className="flex-1 w-full h-full relative min-h-0 bg-black">
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
              <Suspense fallback={<div className="w-full text-white whitespace-pre-wrap">{msg.content}</div>}>
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
            <div className="flex flex-col items-center w-full px-4 sm:px-6 lg:px-8 pb-[140px]">
              {isGenerating && (
                <div className="flex w-full max-w-[960px] flex-row items-center gap-3 animate-fade-in p-3 rounded-xl bg-[#0D0D14]/80 border border-[#8B2BFF]/30 backdrop-blur-sm">
                  <div className="w-6 h-6 rounded-full bg-[#8B2BFF]/20 border border-[#8B2BFF] flex items-center justify-center shrink-0 shadow-[0_0_10px_#8B2BFF]">
                    <div className="w-2 h-2 rounded-full bg-[#8B2BFF] animate-ping" />
                  </div>
                  <div className="text-zinc-300 text-xs font-medium flex items-center gap-2">
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
          className="absolute bottom-24 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[#8B2BFF]/40 bg-[#0A0A0F] text-zinc-300 shadow-[0_0_15px_rgba(139,43,255,0.3)] transition-all hover:bg-[#8B2BFF] hover:text-white"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}
