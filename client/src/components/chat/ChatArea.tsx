import { lazy, Suspense, useRef, useState } from 'react';
import { ArrowDown, FileText, Sparkles, PenTool, Lightbulb } from 'lucide-react';
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
}

export function canShowSuggestedPrompts(messages: Message[], index: number, isGenerating: boolean, message: Message): boolean {
  return !isGenerating && index === messages.length - 1 && message.role === 'assistant' && message.status !== 'error';
}



export function getDisplayName(username: string | null | undefined): string {
  const localPart = username?.split('@')[0].trim();
  if (!localPart) return 'there';

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

  // Return no suggestions for custom bots with documents
  if (documentsCount > 0) {
    return [];
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
    return ['Highlight the biggest differences', 'Identify possible conflicts'];
  }

  if (/policy|rule|require|allow|approval|exception|compliance/.test(normalizedUserMessage)) {
    return ['Show exceptions or limitations', 'List the required next steps'];
  }

  if (/date|deadline|when|timeline|schedule|time/.test(normalizedUserMessage)) {
    return ['Find all related dates', 'Show the source sections'];
  }

  if (/how do|how can|steps|help me|guide|learn/.test(normalizedUserMessage)) {
    return ['Break it into steps', 'Explain the common mistakes'];
  }

  if (/should i|which|recommend|best|decide|choice|option/.test(normalizedUserMessage)) {
    return ['Explain the trade-offs', 'Recommend a next step'];
  }

  if (/why|explain|meaning|what does|how does/.test(normalizedUserMessage)) {
    return ['Explain it more simply', 'Go deeper on this'];
  }

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(normalizedUserMessage)) {
    return ['What topic should we explore next?', 'What should we clarify first?'];
  }

  const context = topic || 'the last answer';
  return [`Can you explain "${context}" in more detail?`, `What is the practical next step for "${context}"?`];
}

export function ChatArea({ messages, isGenerating, botName = 'Autumn', onRetry, onEdit, documentsCount = 0, onSuggestedPrompt, username, starterQuestions }: ChatAreaProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hiddenStarters, setHiddenStarters] = useState<Set<string>>(new Set());
  const displayName = getDisplayName(username);

  const activeStarters = (starterQuestions || []).filter(q => !hiddenStarters.has(q));

  const defaultStarters = [
    { icon: FileText, title: 'Analyze Documents', prompt: 'Summarize the attached documents and highlight the main takeaways.', desc: 'Extract key points and actionable summaries' },
    { icon: Sparkles, title: 'Brainstorm Ideas', prompt: 'Help me brainstorm creative strategies for my upcoming project.', desc: 'Explore workflows, concepts, and approaches' },
    { icon: PenTool, title: 'Draft & Write', prompt: 'Help me draft a concise, high-impact update for my team.', desc: 'Compose emails, project plans, or memos' },
    { icon: Lightbulb, title: 'Explain Concepts', prompt: 'Explain the core principles simply with a real-world example.', desc: 'Break down complex topics into clear steps' }
  ];

  const ChatIntro = () => {
    if (messages.length > 0) return null;

    return (
      <div className="flex w-full flex-col items-center justify-center pt-8 sm:pt-14 pb-12 px-4 sm:px-6">
        <div className="w-full max-w-[780px] flex flex-col items-center text-center">
          {/* Logo with Ambient Aura */}
          <div className="relative mb-5 group">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-[var(--accent)] to-[#FFA770] opacity-40 blur-lg group-hover:opacity-75 transition-opacity duration-500" />
            <div className="relative w-16 h-16 rounded-2xl bg-[var(--bg-surface)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] shadow-lg flex items-center justify-center overflow-hidden p-1.5">
              <img src="/logo.png" alt="Autumn" className="w-full h-full rounded-xl object-cover" />
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2">
            Welcome to <span className="bg-gradient-to-r from-[var(--accent)] via-[#FFA770] to-[var(--accent-hover)] bg-clip-text text-transparent">Autumn</span>, {displayName}
          </h2>
          <p className="text-sm sm:text-[0.95rem] text-[var(--text-secondary)] max-w-[520px] mb-8 leading-relaxed">
            Your private, local AI assistant. Query documents, brainstorm ideas, or draft content with complete data sovereignty.
          </p>

          {/* Prompt Starter Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-4">
            {defaultStarters.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => onSuggestedPrompt?.(item.prompt)}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-all duration-200 text-left cursor-pointer group shadow-xs hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="p-2 rounded-lg bg-[var(--accent-muted)] text-[var(--accent)] group-hover:scale-105 transition-transform shrink-0 mt-0.5">
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.88rem] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                      {item.title}
                    </div>
                    <div className="text-[0.76rem] text-[var(--text-muted)] mt-0.5 leading-snug line-clamp-2">
                      {item.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Additional Dynamic Starters if provided */}
          {activeStarters.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2 pt-2">
              {activeStarters.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const newHidden = new Set(hiddenStarters);
                    newHidden.add(q);
                    setHiddenStarters(newHidden);
                    onSuggestedPrompt?.(q);
                  }}
                  className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all hover:border-[var(--accent)] text-left shadow-xs hover:bg-[var(--bg-surface-hover)]"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full h-full relative min-h-0">
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
            // If there are still starter questions left, show them. 
            // Otherwise fallback to dynamically generated suggestions.
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
          Header: () => <ChatIntro />,
          Footer: () => (
            <div className="flex flex-col items-center w-full px-4 sm:px-6 lg:px-8 pb-[160px]">
              {isGenerating && (
                <div className="flex w-full max-w-[800px] flex-row items-start gap-4 animate-[fadeIn_0.3s_ease-out]">
                  <img src="/logo.png" className="w-[32px] h-[32px] rounded-full border-2 border-[var(--accent)] shrink-0 object-cover mt-1 animate-[avatar-glow_1.5s_infinite_alternate] shadow-[0_0_12px_var(--accent)]" />
                  <div className="text-[var(--text-muted)] text-sm animate-pulse mt-2">
                    Thinking...
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
          className="absolute bottom-5 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-lg transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
        >
          <ArrowDown size={18} />
        </button>
      )}
    </div>
  );
}
