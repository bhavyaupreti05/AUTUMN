import { useEffect, useRef, useState } from 'react';
import { Bot, Check, ChevronDown, Copy, FileText, Globe2, MessageSquare, Pencil, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { useCustomBots, type CustomBot, type CustomBotDocument } from '../hooks/useCustomBots';
import { ChatArea } from '../components/chat/ChatArea';
import { ChatInput } from '../components/chat/ChatInput';
import { useChat } from '../hooks/useChat';

const accentOptions = [
  { label: 'Amber', value: 'var(--accent)', description: 'Warm and balanced' },
  { label: 'Blue', value: '#3b82f6', description: 'Calm and professional' },
  { label: 'Green', value: '#10b981', description: 'Helpful and supportive' },
  { label: 'Violet', value: '#8b5cf6', description: 'Creative and thoughtful' },
  { label: 'Red', value: '#ef4444', description: 'Bold and decisive' },
];

function BotAvatar({ bot, size = 'md' }: { bot: Pick<CustomBot, 'name' | 'accent'>; size?: 'sm' | 'md' }) {
  const dimension = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-12 w-12 text-lg';
  return <div className={`${dimension} flex shrink-0 items-center justify-center rounded-[var(--radius-md)] border-2 border-[var(--bg-surface)] bg-[var(--bg-surface-hover)] font-bold text-white shadow-sm`} style={{ boxShadow: `0 0 0 2px ${bot.accent}` }} aria-label={`${bot.name} avatar`}>{bot.name.charAt(0).toUpperCase()}</div>;
}

function StatusPill({ status, progress }: { status: string; progress?: number }) {
  const ready = status === 'READY' || status === 'PROCESSED_NO_RAG';
  const failed = status === 'FAILED';
  const percent = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
  return <span className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${ready ? 'border-[rgba(76,175,80,0.35)] bg-[rgba(76,175,80,0.1)] text-[var(--success)]' : failed ? 'border-[rgba(250,82,82,0.35)] bg-[rgba(250,82,82,0.1)] text-[var(--error)]' : 'border-[rgba(234,166,85,0.35)] bg-[rgba(234,166,85,0.1)] text-[var(--accent)]'}`}>{ready ? 'Ready' : failed ? 'Error' : `Processing ${percent}%`}</span>;
}

const MAX_CUSTOM_BOT_DOCUMENTS = 3;

function BotModal({ bot, onClose, onSaved }: { bot: CustomBot | null; onClose: () => void; onSaved: (bot: CustomBot) => void }) {
  const [name, setName] = useState(bot?.name || '');
  const [personality, setPersonality] = useState(bot?.personality || '');
  const [starterQuestions, setStarterQuestions] = useState((bot?.starter_questions || []).join('\n'));
  const [accent] = useState(bot?.accent || accentOptions[0].value);
  const [documents, setDocuments] = useState<CustomBotDocument[]>(bot?.documents || []);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [dangerOpen, setDangerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { saveBot, deleteBot, refreshBots } = useCustomBots();

  const uploadFile = async (file: File, targetBot = bot) => {
    if (documents.length >= MAX_CUSTOM_BOT_DOCUMENTS) {
      setError(`This bot can only have ${MAX_CUSTOM_BOT_DOCUMENTS} documents attached at once.`);
      return;
    }
    if (!targetBot) { setPendingFile(file); return; }
    setUploading(true); setError('');
    try {
      const form = new FormData(); form.append('file', file);
      const response = await fetch('/api/documents', { method: 'POST', credentials: 'include', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Upload failed');
      const attached = await fetch(`/api/admin/custom-bots/${targetBot.id}/documents/${data.document.id}`, { method: 'POST', credentials: 'include' });
      if (!attached.ok) {
        const attachmentError = await attached.json().catch(() => ({}));
        throw new Error(attachmentError.detail || 'Could not attach document');
      }
      const attachedBot = await attached.json();
      setDocuments(attachedBot.documents || [...documents, data.document]);
      await refreshBots();
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Upload failed'); }
    finally { setUploading(false); }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const remainingSlots = MAX_CUSTOM_BOT_DOCUMENTS - documents.length;
    if (remainingSlots <= 0) {
      setError(`This bot can only have ${MAX_CUSTOM_BOT_DOCUMENTS} documents attached at once.`);
      return;
    }
    const selectedFiles = fileList.slice(0, remainingSlots);
    if (selectedFiles.length < fileList.length) {
      setError(`Only ${remainingSlots} document slot(s) remain for this bot. The rest were skipped.`);
    }
    for (const file of selectedFiles) {
      await uploadFile(file, bot);
    }
  };

  useEffect(() => {
    if (!bot || !documents.some((document) => document.status === 'PROCESSING')) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/admin/custom-bots/${bot.id}`, { credentials: 'include' });
      if (response.ok) setDocuments((await response.json()).documents || []);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [bot, documents]);

  const save = async () => {
    if (!name.trim() || !personality.trim()) return;
    try {
      const parsedQuestions = starterQuestions.split('\n').map(q => q.trim()).filter(Boolean).slice(0, 10);
      const saved = await saveBot({ id: bot?.id, input: { name: name.trim(), personality: personality.trim(), accent, starter_questions: parsedQuestions } });
      if (pendingFile && !bot) await uploadFile(pendingFile, saved);
      onSaved({ ...saved, documents });
      onClose();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save bot'); }
  };

  const removeBot = async () => {
    if (!bot || !window.confirm(`Delete ${bot.name}? This cannot be undone.`)) return;
    await deleteBot(bot.id); onClose();
  };

  const processingDocuments = documents.filter((document) => document.status === 'PROCESSING');
  const processingPercent = processingDocuments.length > 0
    ? Math.round(processingDocuments.reduce((total, document) => total + Math.max(0, Math.min(100, document.progress ?? 0)), 0) / processingDocuments.length)
    : 100;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-6 flex items-start justify-between"><div><h2 className="text-xl font-bold text-[var(--text-primary)]">{bot ? 'Edit Bot' : 'Create Bot'}</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Give your assistant a focused role and source material.</p></div><button onClick={onClose} aria-label="Close" className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button></div>
      {error && <div className="mb-4 rounded-[var(--radius-md)] border border-[rgba(250,82,82,0.35)] bg-[rgba(250,82,82,0.1)] p-3 text-sm text-[var(--error)]">{error}</div>}
      <label className="block text-sm font-medium text-[var(--text-primary)]">Bot Name <span className="text-[var(--error)]">*</span><input maxLength={40} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" placeholder="HR Helper" /><span className="mt-1 block text-right text-xs text-[var(--text-muted)]">{name.length}/40</span></label>
      <label className="mt-4 block text-sm font-medium text-[var(--text-primary)]">Personality &amp; Role <span className="text-[var(--error)]">*</span><textarea maxLength={1000} value={personality} onChange={(event) => setPersonality(event.target.value)} rows={5} className="mt-2 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" placeholder={'You are HR Helper, a friendly assistant for employee handbook questions...'} /><span className="mt-1 block text-right text-xs text-[var(--text-muted)]">{personality.length}/1000</span></label>
      <label className="mt-4 block text-sm font-medium text-[var(--text-primary)]">Starter Questions (Optional)<span className="ml-2 text-xs font-normal text-[var(--text-muted)]">One per line. Up to 10 questions.</span><textarea value={starterQuestions} onChange={(event) => setStarterQuestions(event.target.value)} rows={6} className="mt-2 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" placeholder={'What are the key policies?\nHow do I request time off?'} /></label>
      <div className="mt-5"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium text-[var(--text-primary)]">Currently Uploaded Documents</span><span className="inline-flex items-center rounded-full bg-[var(--bg-surface-hover)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">{documents.length + (pendingFile ? 1 : 0)} attached</span></div>{documents.length > 0 || pendingFile ? <div className="space-y-2">{documents.map((document) => { const processing = document.status === 'PROCESSING'; const percent = Math.max(0, Math.min(100, Math.round(document.progress ?? 0))); return <div key={document.id} className="flex min-h-[46px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2"><FileText size={16} className="shrink-0 text-[var(--accent)]" /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{document.filename}</span><div className="shrink-0"><StatusPill status={document.status} progress={document.progress} /></div></div>{processing && <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]" role="progressbar" aria-label={`${document.filename} processing progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${percent}%` }} /></div>}</div><button type="button" title="Remove document" onClick={async () => { await fetch(`/api/admin/custom-bots/${bot?.id}/documents/${document.id}`, { method: 'DELETE', credentials: 'include' }); setDocuments((current) => current.filter((item) => item.id !== document.id)); await refreshBots(); }} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--error)]"><Trash2 size={15} /></button></div>; })}{pendingFile && <div key="pending" className="flex min-h-[46px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2"><FileText size={16} className="shrink-0 text-[var(--accent)]" /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{pendingFile.name}</span><div className="shrink-0"><span className="inline-flex items-center rounded-full bg-[rgba(234,166,85,0.15)] px-2 py-0.5 text-[0.65rem] font-medium text-[rgb(234,166,85)]">Pending Save</span></div></div></div><button type="button" title="Remove document" onClick={() => setPendingFile(null)} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--error)]"><Trash2 size={15} /></button></div>}</div> : <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 text-center text-sm text-[var(--text-muted)]">No documents currently uploaded.</div>}</div>
      <div className="mt-5 border-t border-[var(--border-subtle)] pt-5"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium text-[var(--text-primary)]">Upload New Documents</span></div>{processingDocuments.length > 0 && <div className="mb-3 rounded-[var(--radius-md)] border border-[rgba(234,166,85,0.35)] bg-[rgba(234,166,85,0.08)] p-3"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-[var(--text-primary)]">Preparing knowledge for chat</span><span className="font-semibold text-[var(--accent)]">{processingPercent}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${processingPercent}%` }} /></div><p className="mt-1.5 text-xs text-[var(--text-secondary)]">Please wait. The bot will be ready after retrieval indexing finishes.</p></div>}<input ref={inputRef} type="file" accept=".pdf,.docx,.xlsx,.csv" multiple className="hidden" onChange={(event) => { const files = event.target.files; if (files?.length) uploadFiles(files); event.target.value = ''; }} /><button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) uploadFiles(event.dataTransfer.files); }} className={`flex w-full flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed p-6 text-center transition-colors ${dragging ? 'border-[var(--accent)] bg-[var(--bg-surface-hover)]' : 'border-[var(--border-subtle)] bg-[var(--bg-primary)]'} disabled:cursor-not-allowed disabled:opacity-60`}><Upload size={22} className="mb-2 text-[var(--accent)]" /><span className="text-sm font-medium text-[var(--text-primary)]">{uploading ? 'Uploading...' : 'Drop documents here or choose files'}</span><span className="mt-1 text-xs text-[var(--text-muted)]">Supported formats: PDF, DOCX, XLSX, CSV</span></button></div>
      {bot && <div className="mt-6 border-t border-[var(--border-subtle)] pt-4"><button type="button" onClick={() => setDangerOpen((open) => !open)} className="flex items-center gap-2 text-sm font-medium text-[var(--error)]"><ChevronDown size={16} className={dangerOpen ? 'rotate-180' : ''} />Danger Zone</button>{dangerOpen && <div className="mt-3 flex items-center justify-between rounded-[var(--radius-md)] border border-[rgba(250,82,82,0.35)] p-3"><span className="text-sm text-[var(--text-secondary)]">Delete this custom bot and its associations.</span><button type="button" onClick={removeBot} className="rounded-[var(--radius-md)] border border-[var(--error)] px-3 py-2 text-sm font-medium text-[var(--error)] hover:bg-[rgba(250,82,82,0.1)]">Delete Bot</button></div>}</div>}
      <div className="mt-6 flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4"><button type="button" onClick={onClose} className="rounded-[var(--radius-md)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]">Cancel</button><button type="button" onClick={save} disabled={!name.trim() || !personality.trim()} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"><Check size={16} />{bot ? 'Save Changes' : 'Create Bot'}</button></div>
    </div>
  </div>;
}

export function createSuggestedPromptHandler(sendMessage: (message: string) => void) {
  return (prompt: string) => {
    if (!prompt.trim()) return;
    sendMessage(prompt.trim());
  };
}

function BotChatPanel({ bot, onClose }: { bot: CustomBot; onClose: () => void }) {
  const storageKey = `trpwbot.customBotConversation.${bot.id}`;
  const [conversationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(storageKey);
  });
  const { messages, isGenerating, sendMessage, stopGeneration } = useChat(conversationId, `/api/admin/custom-bots/${bot.id}/chat`, storageKey);
  const onSuggestedPrompt = createSuggestedPromptHandler(sendMessage);

  return <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-2xl"><div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-4"><BotAvatar bot={{ ...bot, name: 'Autumn', accent: 'var(--accent)' }} size="sm" /><div className="min-w-0 flex-1"><h2 className="truncate font-semibold text-[var(--accent)]">Autumn</h2><p className="text-xs text-[var(--text-secondary)]">Testing {bot.name}</p></div><button onClick={onClose} aria-label="Close chat" className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button></div><div className="relative min-h-0 flex-1"><ChatArea messages={messages} isGenerating={isGenerating} botName="Autumn" documentsCount={bot.documents?.length ?? 0} onSuggestedPrompt={onSuggestedPrompt} starterQuestions={bot.starter_questions} /></div><div className="relative shrink-0"><ChatInput onSendMessage={sendMessage} disabled={isGenerating} isGenerating={isGenerating} onStop={stopGeneration} isNewChat={messages.length === 0} botName="Autumn" /></div></div>;
}

function IntegrationPanel({ bot, onClose, notify }: { bot: CustomBot; onClose: () => void; notify: (message: string) => void }) {
  const { getIntegration, createIntegration, saveIntegration, rotateIntegration, deleteIntegration } = useCustomBots();
  const [integration, setIntegration] = useState<Awaited<ReturnType<typeof getIntegration>> | null>(null);
  const [origins, setOrigins] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getIntegration(bot.id).then((data) => {
      setIntegration(data);
      setEnabled(data.enabled ?? false);
      setOrigins((data.allowed_origins ?? []).join('\n'));
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load integration settings')).finally(() => setLoading(false));
  }, [bot.id]);

  const originList = () => origins.split('\n').map((origin) => origin.trim()).filter(Boolean);
  const save = async () => {
    setSaving(true); setError('');
    try {
      const input = { enabled, allowed_origins: originList() };
      const data = integration?.configured ? await saveIntegration(bot.id, input) : await createIntegration(bot.id, input);
      setIntegration(data); setSecret(data.secret ?? '');
      notify('Integration settings saved');
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save integration'); }
    finally { setSaving(false); }
  };
  const rotate = async () => {
    setSaving(true); setError('');
    try { const data = await rotateIntegration(bot.id); setSecret(data.secret ?? ''); notify('Secret rotated. Copy it now.'); }
    catch (rotateError) { setError(rotateError instanceof Error ? rotateError.message : 'Could not rotate secret'); }
    finally { setSaving(false); }
  };
  const detach = async () => {
    if (!window.confirm(`Detach ${bot.name} from external access?`)) return;
    await deleteIntegration(bot.id); setIntegration({ configured: false }); setEnabled(false); setSecret(''); notify('External integration detached');
  };
  const copy = async (value: string, message: string) => { await navigator.clipboard.writeText(value); notify(message); };
  const apiOrigin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost:8000';
  const embedCode = integration?.public_key ? `<script src="${apiOrigin}/widget.js" data-bot-key="${integration.public_key}" data-api-base="${apiOrigin}" defer></script>` : '';

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-5 flex items-start justify-between"><div className="flex items-center gap-3"><div className="rounded-[var(--radius-md)] bg-[var(--bg-surface-hover)] p-2 text-[var(--accent)]"><Globe2 size={20} /></div><div><h2 className="text-xl font-bold text-[var(--text-primary)]">External Integration</h2><p className="text-sm text-[var(--text-secondary)]">Attach only {bot.name} to a future website.</p></div></div><button onClick={onClose} aria-label="Close" className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button></div>
      {error && <div className="mb-4 rounded-[var(--radius-md)] border border-[rgba(250,82,82,0.35)] bg-[rgba(250,82,82,0.1)] p-3 text-sm text-[var(--error)]">{error}</div>}
      {loading ? <div className="h-32 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-surface-hover)]" /> : <>
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3"><div><p className="text-sm font-medium text-[var(--text-primary)]">Allow external access</p><p className="text-xs text-[var(--text-secondary)]">Disabled until you turn it on.</p></div><button role="switch" aria-checked={enabled} onClick={() => setEnabled((value) => !value)} className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-surface-hover)]'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'left-6' : 'left-1'}`} /></button></div>
        <label className="mt-4 block text-sm font-medium text-[var(--text-primary)]">Allowed website origins <span className="text-[var(--error)]">*</span> <span className="font-normal text-[var(--text-muted)]">(one per line)</span><textarea required value={origins} onChange={(event) => setOrigins(event.target.value)} rows={3} placeholder="https://example.com" className="mt-2 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" /><span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">Add the exact website origin that will host this bot.</span></label>
        {integration?.configured && <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3"><p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Public key</p><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{integration.public_key}</code><button title="Copy public key" onClick={() => copy(integration.public_key ?? '', 'Public key copied')} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Copy size={15} /></button></div></div>}
        {secret && <div className="mt-3 rounded-[var(--radius-md)] border border-[rgba(234,166,85,0.4)] bg-[rgba(234,166,85,0.08)] p-3"><p className="text-xs font-medium text-[var(--accent)]">Copy this secret now. It will not be shown again.</p><div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs text-[var(--text-primary)]">{secret}</code><button title="Copy secret" onClick={() => copy(secret, 'Secret copied')} className="p-1.5 text-[var(--accent)]"><Copy size={15} /></button></div></div>}
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] pt-4"><button type="button" onClick={onClose} className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]">Cancel</button>{integration?.configured && <><button type="button" disabled={saving} onClick={rotate} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"><RefreshCw size={14} />Rotate secret</button><button type="button" disabled={saving} onClick={detach} className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--error)] hover:bg-[rgba(250,82,82,0.1)]">Detach</button></>}{integration?.configured && embedCode && <button type="button" onClick={() => copy(embedCode, 'Embed setup copied')} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"><Copy size={14} />Copy embed setup</button>}<button type="button" disabled={saving || !originList().length} onClick={save} className="rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : integration?.configured ? 'Save settings' : 'Create integration'}</button></div>
      </>}
    </div>
  </div>;
}

export function CustomBotsPage() {
  const { bots, isLoading, error, toggleBot } = useCustomBots();
  const [modalBot, setModalBot] = useState<CustomBot | null | undefined>(undefined);
  const [chatBot, setChatBot] = useState<CustomBot | null>(null);
  const [integrationBot, setIntegrationBot] = useState<CustomBot | null>(null);
  const [toast, setToast] = useState('');
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200); };
  const handleToggle = (bot: CustomBot) => { toggleBot({ id: bot.id, active: !bot.is_active }); notify(`${bot.name} is now ${!bot.is_active ? 'active' : 'inactive'}`); };
  return <div className="space-y-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-bold text-[var(--text-primary)]">Custom Bots</h2><p className="mt-1 text-[var(--text-secondary)]">Create focused assistants with their own role and knowledge.</p></div><button onClick={() => setModalBot(null)} className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] hover:shadow-[var(--energy-glow)]"><Plus size={17} />Create Bot</button></div>
    {isLoading ? <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />)}</div> : error ? <div className="rounded-[var(--radius-lg)] border border-[rgba(250,82,82,0.35)] bg-[rgba(250,82,82,0.1)] p-5 text-sm text-[var(--error)]">{error instanceof Error ? error.message : 'Could not load custom bots.'}</div> : bots.length === 0 ? <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-20 text-center"><Bot size={48} className="mb-4 text-[var(--accent)]" /><h3 className="text-lg font-semibold text-[var(--text-primary)]">No custom bots yet</h3><p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">Create a focused assistant for a team, workflow, or document collection.</p><button onClick={() => setModalBot(null)} className="mt-5 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">Create your first bot</button></div> : <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">{bots.map((bot) => <div key={bot.id} className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)]"><div className="flex items-start gap-3"><BotAvatar bot={bot} /><div className="min-w-0 flex-1"><h3 className="truncate font-semibold text-[var(--text-primary)]">{bot.name}</h3><p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{bot.personality}</p></div><button role="switch" aria-checked={bot.is_active} aria-label={`Toggle ${bot.name}`} onClick={() => handleToggle(bot)} className={`relative h-6 w-11 rounded-full transition-colors ${bot.is_active ? 'bg-[var(--accent)]' : 'bg-[var(--bg-surface-hover)]'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${bot.is_active ? 'left-6' : 'left-1'}`} /></button></div><div className="mt-5 flex items-center justify-between"><span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-surface-hover)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"><FileText size={13} />{bot.document_count} documents</span><span className={`text-xs font-medium ${bot.is_active ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>{bot.is_active ? 'Active' : 'Inactive'}</span></div>{bot.documents && bot.documents.length > 0 && <div className="mt-3 flex flex-col gap-1.5">{bot.documents.map((doc: any) => <div key={doc.id} className="flex items-center gap-2 rounded bg-[var(--bg-surface-hover)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]"><FileText size={12} className="shrink-0 text-[var(--accent)]" /><span className="truncate">{doc.filename}</span></div>)}</div>}<div className="mt-auto pt-5"><div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4"><button onClick={() => setChatBot(bot)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"><MessageSquare size={15} />Chat</button><button onClick={() => setIntegrationBot(bot)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"><Globe2 size={15} />Integration</button><button onClick={() => setModalBot(bot)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"><Pencil size={15} />Edit</button></div></div></div>)}</div>}
    {modalBot !== undefined && <BotModal bot={modalBot} onClose={() => setModalBot(undefined)} onSaved={() => notify('Bot saved successfully')} />}
    {chatBot && <BotChatPanel bot={chatBot} onClose={() => setChatBot(null)} />}
    {integrationBot && <IntegrationPanel bot={integrationBot} onClose={() => setIntegrationBot(null)} notify={notify} />}
    {toast && <div role="status" className="fixed bottom-6 right-6 z-[70] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-lg"><Check size={15} className="mr-2 inline text-[var(--success)]" />{toast}</div>}
  </div>;
}