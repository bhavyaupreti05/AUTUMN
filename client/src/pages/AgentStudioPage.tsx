import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  ChevronUp,
  FileText,
  Upload,
  Link2,
  Download,
  Bookmark,
  Layers
} from 'lucide-react';
import { useAgentStudio, type PipelineStage } from '../hooks/useAgentStudio';

export function AgentStudioPage() {
  const navigate = useNavigate();
  const {
    agents,
    tasks,
    pipelines,
    notifications,
    templates,
    presets,
    loading,
    createAgent,
    deleteAgent,
    dispatchTask,
    createPipeline,
    saveTemplate,
    deleteTemplate,
    markNotificationsRead
  } = useAgentStudio();

  const [activeTab, setActiveTab] = useState<'agents' | 'tasks' | 'pipelines'>('agents');
  
  // Modals & Forms
  const [isNewAgentOpen, setIsNewAgentOpen] = useState(false);
  const [selectedAgentForTask, setSelectedAgentForTask] = useState<string>('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPrompt, setTaskPrompt] = useState('');
  
  // Context & Document Attachments for Missions
  const [availableDocs, setAvailableDocs] = useState<Array<{ id: string; filename: string; status?: string }>>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [contextLinks, setContextLinks] = useState<string[]>([]);
  const [newLinkInput, setNewLinkInput] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  
  // Pipeline Flow Builder state
  const defaultStages: PipelineStage[] = [
    {
      title: 'Phase 1: Research & Discovery',
      role: 'researcher',
      instruction: 'Analyze requirements, scout existing architecture, gather relevant docs, and establish specifications.'
    },
    {
      title: 'Phase 2: Architecture & Implementation',
      role: 'builder',
      instruction: 'Design core architecture and implement production-ready, clean, modular code based on Phase 1 research.'
    },
    {
      title: 'Phase 3: Sandbox Verification & QA',
      role: 'tester',
      instruction: 'Inspect code in Python Sandbox, verify exit codes, run edge cases, and isolate bugs.'
    },
    {
      title: 'Phase 4: Senior Audit & Executive Synthesis',
      role: 'reviewer',
      instruction: 'Review code quality, performance, and security, and assemble the executive deliverable.'
    }
  ];

  const [pipelineTitle, setPipelineTitle] = useState('');
  const [pipelineGoal, setPipelineGoal] = useState('');
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(defaultStages);
  const [pipelineDocIds, setPipelineDocIds] = useState<string[]>([]);
  const [pipelineContextLinks, setPipelineContextLinks] = useState<string[]>([]);
  const [pipelineNewLink, setPipelineNewLink] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset-fullstack');
  const [pipelineActiveTabs, setPipelineActiveTabs] = useState<Record<string, number | 'final'>>({});
  const [copiedPipelineId, setCopiedPipelineId] = useState<string | null>(null);
  const pipelineDocInputRef = useRef<HTMLInputElement>(null);
  
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

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAvailableDocs(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDirectDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingDoc(true);
    setDocUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documents', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }
      const data = await res.json();
      const newDoc = data.document;
      if (newDoc && newDoc.id) {
        setAvailableDocs(prev => [newDoc, ...prev.filter(d => d.id !== newDoc.id)]);
        setSelectedDocIds(prev => [...prev, newDoc.id]);
      }
    } catch (err: any) {
      setDocUploadError(err.message || 'Failed to upload document');
    } finally {
      setIsUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleAddContextLink = () => {
    const trimmed = newLinkInput.trim();
    if (!trimmed) return;
    if (!contextLinks.includes(trimmed)) {
      setContextLinks(prev => [...prev, trimmed]);
    }
    setNewLinkInput('');
  };

  const handleRemoveContextLink = (linkToRemove: string) => {
    setContextLinks(prev => prev.filter(l => l !== linkToRemove));
  };

  const handleDispatchTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAgentId = selectedAgentForTask || safeAgents[0]?.id;
    if (!targetAgentId || !taskTitle.trim() || !taskPrompt.trim()) return;
    await dispatchTask(
      targetAgentId,
      taskTitle.trim(),
      taskPrompt.trim(),
      contextLinks.length > 0 ? contextLinks : undefined,
      selectedDocIds.length > 0 ? selectedDocIds : undefined
    );
    setTaskTitle('');
    setTaskPrompt('');
    setSelectedDocIds([]);
    setContextLinks([]);
    setActiveTab('tasks');
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === 'custom') return;
    
    // Check in presets
    const foundPreset = (presets || []).find(p => p.id === presetId);
    if (foundPreset && foundPreset.stages) {
      setPipelineStages(foundPreset.stages.map(s => ({
        title: s.title,
        role: s.role || 'builder',
        agent_id: s.agent_id,
        instruction: s.instruction
      })));
      return;
    }

    // Check in templates
    const foundTemplate = (templates || []).find(t => t.id === presetId);
    if (foundTemplate && foundTemplate.stages) {
      setPipelineStages(foundTemplate.stages.map(s => ({
        title: s.title,
        role: s.role || 'builder',
        agent_id: s.agent_id,
        instruction: s.instruction
      })));
    }
  };

  const handleAddPipelineStage = () => {
    const nextIdx = pipelineStages.length + 1;
    setPipelineStages(prev => [
      ...prev,
      {
        title: `Phase ${nextIdx}: Custom Milestone`,
        role: 'builder',
        instruction: 'Specify exact phase objective and expected technical deliverables...'
      }
    ]);
  };

  const handleRemovePipelineStage = (idxToRemove: number) => {
    if (pipelineStages.length <= 1) return;
    setPipelineStages(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleUpdatePipelineStage = (idx: number, field: keyof PipelineStage, val: any) => {
    setPipelineStages(prev => prev.map((stage, i) => {
      if (i === idx) {
        return { ...stage, [field]: val };
      }
      return stage;
    }));
  };

  const togglePipelineDoc = (docId: string) => {
    setPipelineDocIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleDirectPipelineDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingDoc(true);
    setDocUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documents', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }
      const data = await res.json();
      const newDoc = data.document;
      if (newDoc && newDoc.id) {
        setAvailableDocs(prev => [newDoc, ...prev.filter(d => d.id !== newDoc.id)]);
        setPipelineDocIds(prev => [...prev, newDoc.id]);
      }
    } catch (err: any) {
      setDocUploadError(err.message || 'Failed to upload document');
    } finally {
      setIsUploadingDoc(false);
      if (pipelineDocInputRef.current) pipelineDocInputRef.current.value = '';
    }
  };

  const handleAddPipelineLink = () => {
    const trimmed = pipelineNewLink.trim();
    if (!trimmed) return;
    if (!pipelineContextLinks.includes(trimmed)) {
      setPipelineContextLinks(prev => [...prev, trimmed]);
    }
    setPipelineNewLink('');
  };

  const handleRemovePipelineLink = (linkToRemove: string) => {
    setPipelineContextLinks(prev => prev.filter(l => l !== linkToRemove));
  };

  const handleDownloadDeliverable = (title: string, markdown: string) => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_deliverable.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyPipelineDeliverable = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPipelineId(id);
    setTimeout(() => setCopiedPipelineId(null), 2000);
  };

  const handlePipelineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipelineTitle.trim() || !pipelineGoal.trim() || pipelineStages.length === 0) return;
    await createPipeline(
      pipelineTitle.trim(),
      pipelineGoal.trim(),
      pipelineStages,
      pipelineDocIds,
      pipelineContextLinks,
      saveAsTemplate,
      templateName.trim() || undefined,
      templateDescription.trim() || undefined
    );
    setPipelineTitle('');
    setPipelineGoal('');
    setPipelineDocIds([]);
    setPipelineContextLinks([]);
    setSaveAsTemplate(false);
    setTemplateName('');
    setTemplateDescription('');
    setActiveTab('pipelines');
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const safeAgents = Array.isArray(agents) ? agents : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safePipelines = Array.isArray(pipelines) ? pipelines : [];
  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  const runningTasksCount = safeTasks.filter(t => t.status === 'running' || t.status === 'pending').length;

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
                    {safeNotifications.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] py-4 text-center">No unread task alerts.</p>
                    ) : (
                      safeNotifications.map(n => (
                        <div key={n.id} className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={12} /> {n.agent_name || 'Agent'} finished
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">{n.completed_at ? n.completed_at.slice(11, 16) : ''}</span>
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
            { id: 'agents', label: 'Agent Hub', icon: Bot, count: safeAgents.length },
            { id: 'tasks', label: 'Missions / Tasks', icon: Activity, count: runningTasksCount > 0 ? `${runningTasksCount} Active` : `${safeTasks.length}` },
            { id: 'pipelines', label: 'Multi-Phase Pipelines', icon: GitBranch, count: safePipelines.length },
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
              {safeAgents.map(agent => (
                <div
                  key={agent.id}
                  className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] transition-all flex flex-col justify-between shadow-sm group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                          {getRoleIcon(agent.role || 'builder')}
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
                      {(Array.isArray(agent.tools) ? agent.tools : []).map((t, idx) => (
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
                      value={selectedAgentForTask || (safeAgents[0]?.id || '')}
                      onChange={e => setSelectedAgentForTask(e.target.value)}
                      className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)]"
                    >
                      {safeAgents.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.role ? a.role.toUpperCase() : 'AGENT'})
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
                      rows={4}
                      placeholder="Write exact requirements, inputs, expected tools (Python Sandbox or Live Search), and expected deliverables..."
                      value={taskPrompt}
                      onChange={e => setTaskPrompt(e.target.value)}
                      className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)] resize-none"
                      required
                    />
                  </div>

                  {/* Knowledge Base & Document Attachments */}
                  <div className="pt-1 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between mb-1.5 pt-2">
                      <label className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                        <FileText size={13} className="text-amber-400" />
                        <span>Ground with Documents & PDFs ({selectedDocIds.length})</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => docInputRef.current?.click()}
                        disabled={isUploadingDoc}
                        className="text-[0.68rem] text-[var(--text-primary)] hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {isUploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        <span>Upload File</span>
                      </button>
                      <input
                        ref={docInputRef}
                        type="file"
                        accept=".pdf,.docx,.txt,.csv,.xlsx,.md"
                        className="hidden"
                        onChange={handleDirectDocUpload}
                      />
                    </div>

                    {docUploadError && (
                      <p className="text-[0.68rem] text-red-400 mb-2">{docUploadError}</p>
                    )}

                    {availableDocs.length > 0 ? (
                      <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 border border-[var(--border-subtle)] rounded-xl p-2 bg-[var(--bg-card)]">
                        {availableDocs.map(doc => {
                          const isSelected = selectedDocIds.includes(doc.id);
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => toggleDocSelection(doc.id)}
                              className={`w-full text-left p-1.5 rounded-lg text-[0.68rem] flex items-center justify-between transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-medium'
                                  : 'bg-[var(--bg-surface)] border-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate mr-2">
                                <FileText size={12} className={isSelected ? 'text-amber-400' : 'text-[var(--text-muted)]'} />
                                <span className="truncate">{doc.filename}</span>
                              </div>
                              <span className="shrink-0 text-[0.62rem] opacity-75">
                                {isSelected ? 'Attached ✓' : '+ Attach'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[0.68rem] text-[var(--text-muted)] italic py-1">
                        No documents uploaded yet. Click Upload File above to add PDFs or datasets.
                      </p>
                    )}
                  </div>

                  {/* External Context & MCP Connection Links */}
                  <div className="pt-1 border-t border-[var(--border-subtle)]">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 pt-2 flex items-center gap-1.5">
                      <Link2 size={13} className="text-cyan-400" />
                      <span>External Context & MCP Endpoints ({contextLinks.length})</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="mcp://... or https://api.docs or schema URL"
                        value={newLinkInput}
                        onChange={e => setNewLinkInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddContextLink();
                          }
                        }}
                        className="flex-1 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2 text-xs focus:outline-none focus:border-[var(--border-strong)]"
                      />
                      <button
                        type="button"
                        onClick={handleAddContextLink}
                        className="px-3 py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    {contextLinks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {contextLinks.map(link => (
                          <span
                            key={link}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[0.68rem] text-cyan-300 max-w-[260px] truncate"
                          >
                            <span className="truncate">{link}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveContextLink(link)}
                              className="text-cyan-400 hover:text-white cursor-pointer ml-0.5"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
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
                  Missions Log ({safeTasks.length})
                </span>
                <span className="text-[0.72rem] text-[var(--text-muted)]">Auto-syncing active tasks</span>
              </div>

              {safeTasks.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
                  No background missions dispatched yet. Assign an objective on the left.
                </div>
              ) : (
                <div className="space-y-3">
                  {safeTasks.map(task => {
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
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[0.68rem] text-[var(--text-muted)] truncate">
                                  {task.agent_name || 'Agent'} • {task.created_at}
                                </span>
                                {task.document_ids && task.document_ids.length > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-amber-400 text-[0.62rem] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                                    <FileText size={9} /> {task.document_ids.length} doc{task.document_ids.length > 1 ? 's' : ''}
                                  </span>
                                )}
                                {task.context_links && task.context_links.length > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-cyan-400 text-[0.62rem] bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30">
                                    <Link2 size={9} /> {task.context_links.length} link{task.context_links.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
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

                            {/* Grounded Knowledge Documents Artifact */}
                            {task.artifacts?.grounded_documents && task.artifacts.grounded_documents.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[0.68rem] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                                  <FileText size={11} /> Grounded Documents & PDFs
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {task.artifacts.grounded_documents.map((doc, i) => (
                                    <div
                                      key={i}
                                      className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[0.68rem] text-[var(--text-secondary)] flex items-center justify-between gap-1.5"
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <FileText size={11} className="text-amber-400 shrink-0" />
                                        <span className="truncate font-medium text-[var(--text-primary)]">{doc.filename}</span>
                                      </div>
                                      <span className="text-[0.62rem] text-[var(--text-muted)] shrink-0">
                                        {doc.chunks_used ? `${doc.chunks_used} chunks` : 'Attached'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* External Context & MCP Resources */}
                            {((task.context_links && task.context_links.length > 0) || (task.artifacts?.context_links && task.artifacts.context_links.length > 0)) && (
                              <div className="space-y-1.5">
                                <span className="text-[0.68rem] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                                  <Link2 size={11} /> Attached Context & MCP Connections
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {(task.context_links || task.artifacts?.context_links || []).map((link, i) => (
                                    <a
                                      key={i}
                                      href={link.startsWith('http') ? link : undefined}
                                      target={link.startsWith('http') ? '_blank' : undefined}
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[0.68rem] text-cyan-300 hover:border-cyan-500/40 transition-colors"
                                    >
                                      <Link2 size={11} className="shrink-0" />
                                      <span className="truncate max-w-[280px]">{link}</span>
                                      {link.startsWith('http') && <ExternalLink size={10} className="shrink-0 opacity-60" />}
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
        {/* TAB 3: MULTI-AGENT WORKFLOW PIPELINES & CUSTOM FLOW BUILDER */}
        {/* ========================================================= */}
        {activeTab === 'pipelines' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Custom Flow Builder & Pipeline Launcher */}
            <div className="p-5 sm:p-7 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-md space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <GitBranch size={18} className="text-[var(--text-primary)]" />
                    <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
                      Multi-Phase Flow Builder & Orchestrator
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-3xl">
                    Build custom multi-agent workflows with sequential handovers, ground each phase with uploaded documents and external links, and save reusable flow templates for future missions.
                  </p>
                </div>

                {/* Preset & Template Selector */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                    <Bookmark size={11} /> Flow Template:
                  </span>
                  <select
                    value={selectedPresetId}
                    onChange={e => handleSelectPreset(e.target.value)}
                    className="bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl py-1.5 px-3 text-xs focus:outline-none focus:border-[var(--border-strong)] font-medium cursor-pointer"
                  >
                    <optgroup label="Quick Built-in Presets">
                      {(presets && presets.length > 0 ? presets : [
                        { id: 'preset-fullstack', name: '⚡ Full-Stack Team (4-Phase)' },
                        { id: 'preset-research', name: '🔍 Deep Research & Whitepaper (3-Phase)' },
                        { id: 'preset-bugfix', name: '🛠️ Bug Root Cause & Patch (3-Phase)' }
                      ]).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                    {templates && templates.length > 0 && (
                      <optgroup label="Your Saved Flow Templates">
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>⭐ {t.name} ({t.stages?.length || 0} phases)</option>
                        ))}
                      </optgroup>
                    )}
                    <option value="custom">✏️ Custom Flow...</option>
                  </select>

                  {templates?.some(t => t.id === selectedPresetId) && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteTemplate(selectedPresetId);
                        setSelectedPresetId('preset-fullstack');
                      }}
                      className="p-1.5 rounded-xl border border-[var(--border-subtle)] text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete this saved template"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={handlePipelineSubmit} className="space-y-5">
                
                {/* Row 1: Title & Main Goal */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Pipeline Project Title
                    </label>
                    <input
                      type="text"
                      placeholder="E.g., Microservice Event Bus & Chaos Validation"
                      value={pipelineTitle}
                      onChange={e => setPipelineTitle(e.target.value)}
                      className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)]"
                      required
                    />
                  </div>

                  <div className="md:col-span-7">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Comprehensive Project Goal & Instructions
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Specify exact objective, technical constraints, expected architecture, deliverables, and guidelines..."
                      value={pipelineGoal}
                      onChange={e => setPipelineGoal(e.target.value)}
                      className="w-full bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs focus:outline-none focus:border-[var(--border-strong)] resize-none"
                      required
                    />
                  </div>
                </div>

                {/* Row 2: Grounding with Documents & MCP Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                  
                  {/* Documents & PDFs attachment */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                        <FileText size={13} className="text-amber-400" />
                        <span>Ground Workflow in Documents ({pipelineDocIds.length})</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => pipelineDocInputRef.current?.click()}
                        disabled={isUploadingDoc}
                        className="text-[0.68rem] text-[var(--text-primary)] hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {isUploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        <span>Upload File</span>
                      </button>
                      <input
                        ref={pipelineDocInputRef}
                        type="file"
                        accept=".pdf,.docx,.txt,.csv,.xlsx,.md"
                        className="hidden"
                        onChange={handleDirectPipelineDocUpload}
                      />
                    </div>

                    {availableDocs.length > 0 ? (
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1 border border-[var(--border-subtle)] rounded-xl p-1.5 bg-[var(--bg-surface)]">
                        {availableDocs.map(doc => {
                          const isSelected = pipelineDocIds.includes(doc.id);
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => togglePipelineDoc(doc.id)}
                              className={`w-full text-left p-1 rounded-lg text-[0.66rem] flex items-center justify-between transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-medium'
                                  : 'bg-transparent border-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate mr-2">
                                <FileText size={11} className={isSelected ? 'text-amber-400' : 'text-[var(--text-muted)]'} />
                                <span className="truncate">{doc.filename}</span>
                              </div>
                              <span className="shrink-0 text-[0.6rem] opacity-75">
                                {isSelected ? 'Attached ✓' : '+ Attach'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[0.66rem] text-[var(--text-muted)] italic py-1">
                        No documents uploaded yet. Click Upload File to add PDFs or datasets.
                      </p>
                    )}
                  </div>

                  {/* External Context & MCP Links */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 flex items-center gap-1.5">
                      <Link2 size={13} className="text-cyan-400" />
                      <span>External Context & MCP Endpoints ({pipelineContextLinks.length})</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="mcp://... or https://api.docs or schema URL"
                        value={pipelineNewLink}
                        onChange={e => setPipelineNewLink(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddPipelineLink();
                          }
                        }}
                        className="flex-1 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl p-2 text-xs focus:outline-none focus:border-[var(--border-strong)]"
                      />
                      <button
                        type="button"
                        onClick={handleAddPipelineLink}
                        className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    {pipelineContextLinks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {pipelineContextLinks.map(link => (
                          <span
                            key={link}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[0.66rem] text-cyan-300 max-w-[240px] truncate"
                          >
                            <span className="truncate">{link}</span>
                            <button
                              type="button"
                              onClick={() => handleRemovePipelineLink(link)}
                              className="text-cyan-400 hover:text-white cursor-pointer ml-0.5"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Row 3: Interactive Stage-by-Stage Flow Editor */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers size={15} className="text-[var(--text-primary)]" />
                      <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Configured Flow Stages ({pipelineStages.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddPipelineStage}
                      className="px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Plus size={13} />
                      <span>Add Custom Phase</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {pipelineStages.map((stage, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-2.5 transition-all shadow-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="shrink-0 px-2 py-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[0.66rem] font-bold text-[var(--text-secondary)]">
                              Phase {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={stage.title}
                              onChange={e => handleUpdatePipelineStage(idx, 'title', e.target.value)}
                              placeholder={`Phase ${idx + 1} Title`}
                              className="flex-1 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-[var(--border-strong)] min-w-[160px]"
                              required
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={stage.agent_id || ''}
                              onChange={e => {
                                const agId = e.target.value;
                                const selectedAg = safeAgents.find(a => a.id === agId);
                                handleUpdatePipelineStage(idx, 'agent_id', agId);
                                if (selectedAg) {
                                  handleUpdatePipelineStage(idx, 'role', selectedAg.role || 'builder');
                                }
                              }}
                              className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[var(--border-strong)] cursor-pointer"
                            >
                              {safeAgents.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.name} ({a.role?.toUpperCase()})
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemovePipelineStage(idx)}
                              disabled={pipelineStages.length <= 1}
                              title="Delete this phase"
                              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                        </div>

                        <div>
                          <textarea
                            rows={2}
                            value={stage.instruction}
                            onChange={e => handleUpdatePipelineStage(idx, 'instruction', e.target.value)}
                            placeholder="Phase objective: what should this agent research, build, test, or review?"
                            className="w-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg p-2 text-xs focus:outline-none focus:border-[var(--border-strong)] resize-none"
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 4: Save As Reusable Template & Launch */}
                <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)] select-none">
                      <input
                        type="checkbox"
                        checked={saveAsTemplate}
                        onChange={e => {
                          setSaveAsTemplate(e.target.checked);
                          if (e.target.checked && !templateName) {
                            setTemplateName(pipelineTitle || 'Custom Flow');
                          }
                        }}
                        className="rounded border-[var(--border-subtle)] accent-[var(--accent)] cursor-pointer"
                      />
                      <span className="font-medium text-[var(--text-primary)]">Save this flow as reusable template</span>
                    </label>

                    {saveAsTemplate && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Template Name (e.g. Code Audit Flow)"
                          value={templateName}
                          onChange={e => setTemplateName(e.target.value)}
                          className="bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[var(--border-strong)]"
                          required={saveAsTemplate}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!templateName.trim()) return;
                            await saveTemplate(templateName.trim(), templateDescription || '', pipelineStages);
                            setSaveAsTemplate(false);
                            setTemplateName('');
                          }}
                          className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[0.68rem] text-[var(--text-primary)] cursor-pointer"
                        >
                          Save Only
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !pipelineTitle.trim() || !pipelineGoal.trim() || pipelineStages.length === 0}
                    className="py-2.5 px-6 rounded-xl bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-xs font-semibold text-[var(--primary-foreground)] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md self-end sm:self-auto"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>Deploy Multi-Agent Workflow</span>
                  </button>

                </div>

              </form>
            </div>

            {/* Existing Pipelines List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Active & Completed Workflows ({safePipelines.length})
                </span>
                <span className="text-[0.72rem] text-[var(--text-muted)]">Live multi-phase telemetry</span>
              </div>

              {safePipelines.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
                  No multi-agent pipelines initiated yet. Launch your first collaborative workflow above.
                </div>
              ) : (
                safePipelines.map(pipe => {
                  const isCompleted = pipe.status === 'completed';
                  const isRunning = pipe.status === 'running' || pipe.status === 'pending';
                  const activeTabForPipe = pipelineActiveTabs[pipe.id] ?? 'final';
                  const stagesList = Array.isArray(pipe.stages) ? pipe.stages : [];

                  return (
                    <div
                      key={pipe.id}
                      className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-4 shadow-xs transition-all"
                    >
                      {/* Workflow Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">{pipe.title}</h4>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{pipe.goal}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[0.68rem] text-[var(--text-muted)]">
                              Started: {pipe.created_at}
                            </span>
                            {pipe.document_ids && pipe.document_ids.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-amber-400 text-[0.62rem] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                                <FileText size={9} /> {pipe.document_ids.length} docs attached
                              </span>
                            )}
                            {pipe.context_links && pipe.context_links.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-cyan-400 text-[0.62rem] bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30">
                                <Link2 size={9} /> {pipe.context_links.length} external links
                              </span>
                            )}
                          </div>
                        </div>

                        <span className={`text-[0.68rem] px-2.5 py-0.5 rounded-full font-semibold border self-start shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : isRunning
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                            : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
                        }`}>
                          {pipe.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Interactive Stepper Navigation (Clickable Tabs) */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                        
                        {/* Final Synthesis Tab */}
                        <button
                          type="button"
                          onClick={() => setPipelineActiveTabs(prev => ({ ...prev, [pipe.id]: 'final' }))}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border ${
                            activeTabForPipe === 'final'
                              ? 'bg-[var(--accent)] text-[var(--primary-foreground)] border-transparent shadow-sm'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <Sparkles size={13} />
                          <span>Final Deliverable</span>
                        </button>

                        {/* Each Phase Tab */}
                        {stagesList.map((stage, idx) => {
                          const isDone = pipe.current_stage > idx || isCompleted;
                          const isCurrent = pipe.current_stage === idx && isRunning;
                          const isSelected = activeTabForPipe === idx;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setPipelineActiveTabs(prev => ({ ...prev, [pipe.id]: idx }))}
                              className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 shrink-0 transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-[var(--accent)] text-[var(--primary-foreground)] font-semibold border-transparent shadow-sm'
                                  : isDone
                                  ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-300 hover:border-emerald-500/40'
                                  : isCurrent
                                  ? 'bg-amber-500/10 border-amber-500/35 text-amber-300 animate-pulse'
                                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                              }`}
                            >
                              <span>Phase {idx + 1}: {stage.title ? stage.title.replace(/^Phase \d+:\s*/, '') : `Stage ${idx + 1}`}</span>
                              {isDone ? (
                                <Check size={12} className={isSelected ? 'text-[var(--primary-foreground)]' : 'text-emerald-400'} />
                              ) : isCurrent ? (
                                <Loader2 size={12} className="animate-spin text-amber-400" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                      {/* Structured Deliverable View Panel */}
                      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
                        
                        {/* CASE 1: FINAL DELIVERABLE TAB */}
                        {activeTabForPipe === 'final' && (
                          <div className="p-4 sm:p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                                <Sparkles size={13} className="text-amber-400" />
                                <span>Executive Synthesis & Full Deliverable</span>
                              </span>

                              {pipe.final_output && (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPipelineDeliverable(pipe.id, pipe.final_output!)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[0.68rem] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                  >
                                    {copiedPipelineId === pipe.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                    <span>{copiedPipelineId === pipe.id ? 'Copied' : 'Copy'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDownloadDeliverable(pipe.title, pipe.final_output!)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[0.68rem] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                  >
                                    <Download size={11} />
                                    <span>Download .md</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {pipe.final_output ? (
                              <div className="prose prose-invert prose-xs max-w-none text-xs text-[var(--text-primary)] leading-relaxed max-h-96 overflow-y-auto pr-2">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {pipe.final_output}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <div className="py-8 text-center text-xs text-[var(--text-muted)] italic">
                                {isRunning ? 'Workflow in progress. Full executive deliverable will synthesize upon completion of all phases...' : 'No final output generated.'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* CASE 2: INDIVIDUAL PHASE TAB */}
                        {typeof activeTabForPipe === 'number' && stagesList[activeTabForPipe] && (() => {
                          const phaseData = stagesList[activeTabForPipe];
                          const isPhaseDone = phaseData.status === 'completed' || (pipe.current_stage > activeTabForPipe);
                          const isPhaseRunning = pipe.current_stage === activeTabForPipe && isRunning;

                          return (
                            <div className="p-4 sm:p-5 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-[var(--text-primary)]">
                                      Phase {activeTabForPipe + 1}: {phaseData.title}
                                    </span>
                                    <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-mono">
                                      Role: {phaseData.role ? phaseData.role.toUpperCase() : 'BUILDER'}
                                    </span>
                                  </div>
                                  <p className="text-[0.72rem] text-[var(--text-muted)] mt-1">
                                    Objective: {phaseData.instruction}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-semibold border ${
                                    isPhaseDone
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                      : isPhaseRunning
                                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                                      : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
                                  }`}>
                                    {isPhaseDone ? 'Completed ✅' : isPhaseRunning ? 'Running ⚡' : 'Queued ⏳'}
                                  </span>

                                  {phaseData.result && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyPipelineDeliverable(`${pipe.id}-phase-${activeTabForPipe}`, phaseData.result!)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[0.68rem] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                    >
                                      {copiedPipelineId === `${pipe.id}-phase-${activeTabForPipe}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                      <span>{copiedPipelineId === `${pipe.id}-phase-${activeTabForPipe}` ? 'Copied' : 'Copy'}</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Phase Deliverable Output */}
                              {phaseData.result ? (
                                <div className="prose prose-invert prose-xs max-w-none text-xs text-[var(--text-primary)] leading-relaxed max-h-80 overflow-y-auto pr-2">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {phaseData.result}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <div className="py-6 text-center text-xs text-[var(--text-muted)] italic">
                                  {isPhaseRunning ? 'Agent is actively synthesizing phase output in background...' : 'Waiting for preceding phase handover...'}
                                </div>
                              )}

                              {/* Python Sandbox Artifact Output for this stage */}
                              {phaseData.artifacts?.sandbox_execution && (
                                <div className="p-3 rounded-xl bg-black border border-white/10 font-mono text-xs">
                                  <div className="flex items-center justify-between text-[0.68rem] text-zinc-400 mb-1 border-b border-white/5 pb-1">
                                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                                      <Zap size={11} /> Python Sandbox Execution ({phaseData.artifacts.sandbox_execution.execution_time_ms}ms)
                                    </span>
                                    <span>Exit Code: {phaseData.artifacts.sandbox_execution.exit_code}</span>
                                  </div>
                                  {phaseData.artifacts.sandbox_execution.stdout && (
                                    <pre className="text-zinc-200 whitespace-pre-wrap m-0 mt-1">{phaseData.artifacts.sandbox_execution.stdout}</pre>
                                  )}
                                  {phaseData.artifacts.sandbox_execution.stderr && (
                                    <pre className="text-red-400 whitespace-pre-wrap m-0 mt-1">{phaseData.artifacts.sandbox_execution.stderr}</pre>
                                  )}
                                </div>
                              )}

                              {/* Live Search Citations for this stage */}
                              {phaseData.artifacts?.search_citations && phaseData.artifacts.search_citations.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <span className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">Verified Web Citations</span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {phaseData.artifacts.search_citations.map((c, i) => (
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
                          );
                        })()}

                      </div>
                    </div>
                  );
                })
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
