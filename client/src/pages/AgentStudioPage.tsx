import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, 
  Crown, 
  Hammer, 
  Search, 
  Zap, 
  CheckCircle2, 
  ArrowLeft, 
  Plus, 
  Play, 
  Loader2, 
  Trash2, 
  Bell, 
  X, 
  Copy, 
  Check, 
  GitBranch, 
  Activity, 
  Sparkles, 
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAgentStudio } from '../hooks/useAgentStudio';

export function AgentStudioPage() {
  const navigate = useNavigate();
  const {
    agents,
    tasks,
    pipelines,
    notifications,
    loading,
    createAgent,
    deleteAgent,
    dispatchTask,
    createPipeline,
    markNotificationsRead
  } = useAgentStudio();

  const [activeTab, setActiveTab] = useState<'agents' | 'tasks' | 'pipelines'>('agents');
  
  // Modals & Forms
  const [isNewAgentOpen, setIsNewAgentOpen] = useState(false);
  const [selectedAgentForTask, setSelectedAgentForTask] = useState<string>('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPrompt, setTaskPrompt] = useState('');
  
  // Pipeline form
  const [pipelineTitle, setPipelineTitle] = useState('');
  const [pipelineGoal, setPipelineGoal] = useState('');
  
  // New Agent Form
  const [agentName, setAgentName] = useState('');
  const [agentRole, setAgentRole] = useState<'manager' | 'builder' | 'researcher' | 'tester' | 'reviewer' | 'custom'>('builder');
  const [agentTitle, setAgentTitle] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentTools, setAgentTools] = useState<string[]>(['web_search', 'python_sandbox']);

  // Notifications dropdown
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'manager': return <Crown size={15} className="text-amber-400" />;
      case 'builder': return <Hammer size={15} className="text-blue-400" />;
      case 'researcher': return <Search size={15} className="text-emerald-400" />;
      case 'tester': return <Zap size={15} className="text-purple-400" />;
      case 'reviewer': return <CheckCircle2 size={15} className="text-rose-400" />;
      default: return <Bot size={15} className="text-[var(--text-primary)]" />;
    }
  };

  const rolePresets = {
    manager: {
      name: 'Autumn Manager',
      title: 'Project Lead & Coordinator',
      prompt: 'Break down goals into milestones, coordinate worker agents, and deliver comprehensive executive deliverables.',
      tools: ['web_search', 'python_sandbox']
    },
    builder: {
      name: 'Dev Architect',
      title: 'Principal Software Engineer & Maker',
      prompt: 'Write clean, robust, production-ready code in Python, TypeScript, SQL, and design scalable architectures.',
      tools: ['python_sandbox', 'web_search']
    },
    researcher: {
      name: 'DocSynth Researcher',
      title: 'Lead Intelligence & Data Scout',
      prompt: 'Search the live web and docs, extract verified evidence, benchmark data, and formatted citations.',
      tools: ['web_search']
    },
    tester: {
      name: 'Sandbox Tester',
      title: 'QA & Runtime Execution Runner',
      prompt: 'Execute code in Python Sandbox, inspect stdout/stderr, verify exit codes, and isolate reproducible bugs.',
      tools: ['python_sandbox']
    },
    reviewer: {
      name: 'Code Reviewer',
      title: 'Senior Auditor & Quality Critic',
      prompt: 'Evaluate outputs against high engineering rubrics, audit readability, check edge cases, and polish deliverables.',
      tools: ['web_search']
    },
    custom: {
      name: 'Domain Specialist',
      title: 'Autonomous Expert',
      prompt: 'Execute specialized workflows with full domain focus.',
      tools: ['web_search', 'python_sandbox']
    }
  };

  const handleRoleSelect = (role: any) => {
    setAgentRole(role);
    const preset = rolePresets[role as keyof typeof rolePresets];
    if (preset) {
      setAgentName(preset.name);
      setAgentTitle(preset.title);
      setAgentPrompt(preset.prompt);
      setAgentTools(preset.tools);
    }
  };

  const handleCreateAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim()) return;
    await createAgent({
      name: agentName.trim(),
      role: agentRole,
      title: agentTitle.trim() || undefined,
      system_prompt: agentPrompt.trim() || undefined,
      tools: agentTools
    });
    setIsNewAgentOpen(false);
  };

  const handleDispatchTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAgentId = selectedAgentForTask || agents[0]?.id;
    if (!targetAgentId || !taskTitle.trim() || !taskPrompt.trim()) return;
    await dispatchTask(targetAgentId, taskTitle.trim(), taskPrompt.trim());
    setTaskTitle('');
    setTaskPrompt('');
    setActiveTab('tasks');
  };

  const handlePipelineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipelineTitle.trim() || !pipelineGoal.trim()) return;
    await createPipeline(pipelineTitle.trim(), pipelineGoal.trim());
    setPipelineTitle('');
    setPipelineGoal('');
    setActiveTab('pipelines');
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const runningTasksCount = tasks.filter(t => t.status === 'running' || t.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col">
      
      {/* Top Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 sm:px-8 py-4 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface-hover)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Back to Chat</span>
            </button>

            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)] truncate">
                  Autonomous Agent Studio
                </h1>
                <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-mono uppercase tracking-wider hidden md:inline">
                  Multi-Level Orchestration
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate hidden sm:block">
                Design specialized agents, dispatch background tasks, and chain multi-phase pipelines.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotifOpen(!isNotifOpen);
                  if (notifications.length > 0) markNotificationsRead();
                }}
                className="relative p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title="Task Notifications"
              >
                <Bell size={16} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black ring-2 ring-black">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-2xl z-50 animate-fade-in text-left">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                    <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Mission Notifications
                    </span>
                    <button onClick={() => setIsNotifOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] py-4 text-center">No unread task alerts.</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={12} /> {n.agent_name || 'Agent'} finished
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">{n.completed_at?.split(' ')[1]}</span>
                          </div>
                          <p className="text-[var(--text-primary)] mt-1 font-medium truncate">{n.title}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Deploy New Agent Button */}
            <button
              onClick={() => {
                handleRoleSelect('builder');
                setIsNewAgentOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent)] hover:opacity-90 text-xs font-semibold text-[var(--primary-foreground)] shadow-md transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Deploy Agent</span>
            </button>
          </div>

        </div>

        {/* Tab Switcher */}
        <div className="max-w-7xl mx-auto flex items-center gap-2 mt-4 pt-3 border-t border-[var(--border-subtle)] overflow-x-auto scrollbar-none">
          {[
            { id: 'agents', label: 'Agent Hub', icon: Bot, count: agents.length },
            { id: 'tasks', label: 'Missions / Tasks', icon: Activity, count: runningTasksCount > 0 ? `${runningTasksCount} Active` : `${tasks.length}` },
            { id: 'pipelines', label: 'Multi-Phase Pipelines', icon: GitBranch, count: pipelines.length },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--primary-foreground)] shadow-sm'
                    : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                <span className={`text-[0.65rem] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-black/20 text-white' : 'bg-[var(--bg-surface-hover)] text-[var(--text-muted)]'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
        
        {/* ========================================================= */}
        {/* TAB 1: AGENTS HUB */}
        {/* ========================================================= */}
        {activeTab === 'agents' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">Autonomous Agents Team</h2>
                <p className="text-xs text-[var(--text-secondary)]">Specialized workers ready for standalone tasks or chained multi-phase pipelines.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] transition-all flex flex-col justify-between shadow-sm group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                          {getRoleIcon(agent.role)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[var(--text-primary)] truncate max-w-[180px]">{agent.name}</h3>
                          <span className="text-[0.65rem] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                            {agent.role}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteAgent(agent.id)}
                        className="text-[var(--text-muted)] hover:text-red-400 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Agent"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5">{agent.title}</p>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-3 leading-relaxed mb-4">
                      {agent.system_prompt}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {agent.tools.map((t, idx) => (
                        <span key={idx} className="text-[0.65rem] px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-mono">
                          {t === 'web_search' ? '🔍 Live Web Search' : t === 'python_sandbox' ? '⚡ Python Sandbox' : t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedAgentForTask(agent.id);
                      setTaskTitle(`Mission for ${agent.name}`);
                      setActiveTab('tasks');
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--bg-surface-hover)] hover:bg-[var(--border-strong)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Play size={12} className="fill-current" />
                    <span>Assign Mission</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: TASKS & MISSIONS RUNNER */}
        {/* ========================================================= */}
        {activeTab === 'tasks' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            
            {/* Left 5 Cols: Dispatch New Mission */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <Play size={16} className="text-[var(--text-primary)] fill-current" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
                    Dispatch Background Mission
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  Assign a specific objective. The agent will run independently in the background and notify you when finished.
                </p>

                <form onSubmit={handleDispatchTaskSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Target Agent</label>
                    <select
                      value={selectedAgentForTask || (agents[0]?.id || '')}
                      onChange={e => setSelectedAgentForTask(e.target.value)}
                      className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)]"
                    >
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.role.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Mission Title</label>
                    <input
                      type="text"
                      placeholder="E.g., Implement Async Redis Cache Module"
                      value={taskTitle}
                      onChange={e => setTaskTitle(e.target.value)}
                      className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Mission Objective & Instructions</label>
                    <textarea
                      rows={5}
                      placeholder="Write exact requirements, inputs, expected tools (Python Sandbox or Live Search), and expected deliverables..."
                      value={taskPrompt}
                      onChange={e => setTaskPrompt(e.target.value)}
                      className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)] resize-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !taskTitle.trim() || !taskPrompt.trim()}
                    className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-xs font-semibold text-[var(--primary-foreground)] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} className="fill-current" />}
                    <span>Dispatch to Background</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Right 7 Cols: Missions Stream & Artifacts */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Missions Log ({tasks.length})
                </span>
                <span className="text-[0.72rem] text-[var(--text-muted)]">Auto-syncing active tasks</span>
              </div>

              {tasks.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
                  No background missions dispatched yet. Assign an objective on the left.
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => {
                    const isExpanded = expandedTaskId === task.id;
                    const isCompleted = task.status === 'completed';
                    const isRunning = task.status === 'running' || task.status === 'pending';

                    return (
                      <div
                        key={task.id}
                        className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] overflow-hidden transition-all shadow-xs"
                      >
                        <div
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                              {getRoleIcon(task.agent_role || 'builder')}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{task.title}</h4>
                              <p className="text-[0.68rem] text-[var(--text-muted)] mt-0.5 truncate">
                                {task.agent_name || 'Agent'} • {task.created_at}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[0.68rem] px-2.5 py-0.5 rounded-full font-semibold border ${
                                isCompleted
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : isRunning
                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                                  : 'bg-red-500/10 border-red-500/30 text-red-400'
                              }`}
                            >
                              {isRunning ? 'Running ⚡' : isCompleted ? 'Completed ✅' : 'Failed ❌'}
                            </span>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>

                        {/* Expanded Deliverable & Sandbox console */}
                        {isExpanded && (
                          <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                  Deliverable Output
                                </span>
                                {task.result && (
                                  <button
                                    onClick={() => handleCopyText(task.id, task.result!)}
                                    className="flex items-center gap-1 text-[0.68rem] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                  >
                                    {copiedId === task.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                    <span>{copiedId === task.id ? 'Copied' : 'Copy'}</span>
                                  </button>
                                )}
                              </div>
                              <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-mono">
                                {task.result || task.error_message || (isRunning ? 'Agent is actively synthesizing response in background...' : 'No deliverable')}
                              </div>
                            </div>

                            {/* Python Sandbox Artifact Output */}
                            {task.artifacts?.sandbox_execution && (
                              <div className="p-3 rounded-xl bg-black border border-white/10 font-mono text-xs">
                                <div className="flex items-center justify-between text-[0.68rem] text-zinc-400 mb-1 border-b border-white/5 pb-1">
                                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                                    <Zap size={11} /> Python Sandbox Execution ({task.artifacts.sandbox_execution.execution_time_ms}ms)
                                  </span>
                                  <span>Exit Code: {task.artifacts.sandbox_execution.exit_code}</span>
                                </div>
                                {task.artifacts.sandbox_execution.stdout && (
                                  <pre className="text-zinc-200 whitespace-pre-wrap m-0 mt-1">{task.artifacts.sandbox_execution.stdout}</pre>
                                )}
                                {task.artifacts.sandbox_execution.stderr && (
                                  <pre className="text-red-400 whitespace-pre-wrap m-0 mt-1">{task.artifacts.sandbox_execution.stderr}</pre>
                                )}
                              </div>
                            )}

                            {/* Live Search Citations */}
                            {task.artifacts?.search_citations && task.artifacts.search_citations.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">Verified Web Citations</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {task.artifacts.search_citations.map((c, i) => (
                                    <a
                                      key={i}
                                      href={c.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[0.68rem] text-[var(--text-secondary)] hover:text-[var(--text-primary)] truncate flex items-center gap-1.5 transition-colors"
                                    >
                                      <ExternalLink size={11} className="shrink-0" />
                                      <span className="truncate">{c.title}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: MULTI-AGENT WORKFLOW PIPELINES */}
        {/* ========================================================= */}
        {activeTab === 'pipelines' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Pipeline Launcher */}
            <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <GitBranch size={16} className="text-[var(--text-primary)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
                  Deploy Interconnected Multi-Phase Pipeline
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-5 max-w-3xl">
                Agents collaborate in sequential phases: Phase 1 (Research) passes its findings into Phase 2 (Builder), which feeds into Phase 3 (Sandbox QA), concluding with Phase 4 (Senior Audit).
              </p>

              <form onSubmit={handlePipelineSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                <div className="md:col-span-4">
                  <input
                    type="text"
                    placeholder="Pipeline Project Title (e.g. Algorithmic Volatility Scanner)"
                    value={pipelineTitle}
                    onChange={e => setPipelineTitle(e.target.value)}
                    className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)]"
                    required
                  />
                </div>
                <div className="md:col-span-6">
                  <input
                    type="text"
                    placeholder="Specify the full project goal for the multi-agent team..."
                    value={pipelineGoal}
                    onChange={e => setPipelineGoal(e.target.value)}
                    className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)]"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={loading || !pipelineTitle.trim() || !pipelineGoal.trim()}
                    className="w-full h-full min-h-[38px] rounded-xl bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-xs font-semibold text-[var(--primary-foreground)] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <Sparkles size={14} />
                    <span>Launch Team</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Pipelines List */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Active & Completed Workflows ({pipelines.length})
              </h3>

              {pipelines.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
                  No multi-agent pipelines initiated yet. Launch your first collaborative workflow above.
                </div>
              ) : (
                pipelines.map(pipe => (
                  <div key={pipe.id} className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">{pipe.title}</h4>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{pipe.goal}</p>
                      </div>
                      <span className={`text-[0.68rem] px-2.5 py-0.5 rounded-full font-semibold border self-start sm:self-center ${
                        pipe.status === 'completed'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : pipe.status === 'running'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                          : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
                      }`}>
                        {pipe.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Stepper Visualization */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                      {pipe.stages.map((stage, idx) => {
                        const isDone = pipe.current_stage > idx || pipe.status === 'completed';
                        const isCurrent = pipe.current_stage === idx && pipe.status === 'running';

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                              isDone
                                ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-300'
                                : isCurrent
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 animate-pulse'
                                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[0.65rem] font-bold uppercase tracking-wider">Phase {idx + 1}</span>
                              {isDone ? <Check size={12} className="text-emerald-400" /> : isCurrent ? <Loader2 size={12} className="animate-spin text-amber-400" /> : null}
                            </div>
                            <span className="font-semibold text-[var(--text-primary)] text-[0.74rem] truncate">{stage.title}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Final Output Deliverable */}
                    {pipe.final_output && (
                      <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                        <span className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">
                          Final Synthesized Deliverable
                        </span>
                        <div className="text-xs text-[var(--text-primary)] font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                          {pipe.final_output}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>
        )}

      </main>

      {/* ========================================================= */}
      {/* DEPLOY AGENT MODAL */}
      {/* ========================================================= */}
      {isNewAgentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsNewAgentOpen(false)}>
          <div
            className="w-full max-w-xl rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl text-[var(--text-primary)] space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Bot size={18} />
                <h3 className="text-base font-bold">Deploy Specialized Agent</h3>
              </div>
              <button onClick={() => setIsNewAgentOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateAgentSubmit} className="space-y-4">
              {/* Role Presets Cards */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                  Select Architectural Role
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['manager', 'builder', 'researcher', 'tester', 'reviewer', 'custom'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleSelect(r)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        agentRole === r
                          ? 'border-[var(--accent)] bg-[var(--bg-surface-hover)] shadow-xs'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {getRoleIcon(r)}
                      <span className="text-xs font-bold uppercase tracking-wider">{r}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Agent Name</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={e => setAgentName(e.target.value)}
                    className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Title / Designation</label>
                  <input
                    type="text"
                    value={agentTitle}
                    onChange={e => setAgentTitle(e.target.value)}
                    className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Persona & System Instructions</label>
                <textarea
                  rows={4}
                  value={agentPrompt}
                  onChange={e => setAgentPrompt(e.target.value)}
                  className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)] resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Enabled Capabilities & Tools</label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agentTools.includes('web_search')}
                      onChange={e => {
                        if (e.target.checked) setAgentTools([...agentTools, 'web_search']);
                        else setAgentTools(agentTools.filter(t => t !== 'web_search'));
                      }}
                      className="rounded accent-[var(--accent)]"
                    />
                    <span>Live DuckDuckGo Web Search</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agentTools.includes('python_sandbox')}
                      onChange={e => {
                        if (e.target.checked) setAgentTools([...agentTools, 'python_sandbox']);
                        else setAgentTools(agentTools.filter(t => t !== 'python_sandbox'));
                      }}
                      className="rounded accent-[var(--accent)]"
                    />
                    <span>Python Sandbox Execution</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsNewAgentOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !agentName.trim()}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--primary-foreground)] text-xs font-semibold hover:opacity-90 shadow-md transition-opacity"
                >
                  Deploy Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
