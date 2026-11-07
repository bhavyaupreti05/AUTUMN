import { useState, useCallback, useEffect } from 'react';

export interface CustomAgent {
  id: string;
  user_id: string;
  name: string;
  role: 'manager' | 'builder' | 'researcher' | 'tester' | 'reviewer' | 'custom';
  title: string;
  system_prompt: string;
  tools: string[];
  icon: string;
  is_active: boolean;
  created_at: string;
}

export interface AgentTask {
  id: string;
  user_id: string;
  agent_id?: string;
  agent_name?: string;
  agent_role?: string;
  agent_title?: string;
  agent_icon?: string;
  pipeline_id?: string;
  phase_index: number;
  title: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  context_links?: string[];
  document_ids?: string[];
  artifacts?: {
    search_citations?: Array<{ title: string; url: string; snippet: string }>;
    sandbox_execution?: {
      stdout: string;
      stderr: string;
      execution_time_ms: number;
      exit_code: number;
    };
    grounded_documents?: Array<{ id: string; filename: string; chunks_used?: number }>;
    context_links?: string[];
  };
  error_message?: string;
  is_read: boolean;
  created_at: string;
  completed_at?: string;
}

export interface AgentPipeline {
  id: string;
  user_id: string;
  title: string;
  goal: string;
  stages: Array<{
    title: string;
    role: string;
    agent_id?: string;
    instruction: string;
  }>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_stage: number;
  final_output?: string;
  created_at: string;
  completed_at?: string;
}

export interface AgentNotification {
  id: string;
  title: string;
  status: 'completed' | 'failed';
  completed_at: string;
  agent_name?: string;
  agent_role?: string;
}

export function useAgentStudio() {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [pipelines, setPipelines] = useState<AgentPipeline[]>([]);
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAgents(data);
        } else if (data && Array.isArray(data.agents)) {
          setAgents(data.agents);
        } else {
          setAgents([]);
        }
      }
    } catch (e: any) {
      console.error('Failed to load agents', e);
      setAgents([]);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/tasks', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTasks(data);
        } else if (data && Array.isArray(data.tasks)) {
          setTasks(data.tasks);
        } else {
          setTasks([]);
        }
      }
    } catch (e: any) {
      console.error('Failed to load tasks', e);
      setTasks([]);
    }
  }, []);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/pipelines', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPipelines(data);
        } else if (data && Array.isArray(data.pipelines)) {
          setPipelines(data.pipelines);
        } else {
          setPipelines([]);
        }
      }
    } catch (e: any) {
      console.error('Failed to load pipelines', e);
      setPipelines([]);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/notifications', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNotifications(data);
        } else if (data && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        } else {
          setNotifications([]);
        }
      }
    } catch (e: any) {
      console.error('Failed to load notifications', e);
      setNotifications([]);
    }
  }, []);

  const createAgent = async (payload: {
    name: string;
    role: string;
    title?: string;
    system_prompt?: string;
    tools?: string[];
    icon?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create agent');
      }
      const newAgent = await res.json();
      setAgents(prev => [...prev, newAgent]);
      return newAgent;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const deleteAgent = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setAgents(prev => prev.filter(a => a.id !== agentId));
      }
    } catch (e: any) {
      console.error('Failed to delete agent', e);
    }
  };

  const dispatchTask = async (
    agentId: string, 
    title: string, 
    prompt: string,
    contextLinks?: string[],
    documentIds?: string[]
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/tasks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          prompt,
          context_links: contextLinks || [],
          document_ids: documentIds || []
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to dispatch task');
      }
      const data = await res.json();
      setTasks(prev => [data.task, ...prev]);
      setTimeout(() => fetchTasks(), 1200);
      return data.task;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const createPipeline = async (title: string, goal: string, stages?: any[]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agents/pipelines', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, goal, stages })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to launch pipeline');
      }
      const data = await res.json();
      setPipelines(prev => [data.pipeline, ...prev]);
      setTimeout(() => fetchPipelines(), 1200);
      return data.pipeline;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const markNotificationsRead = async (taskIds?: string[]) => {
    try {
      await fetch('/api/agents/notifications/mark-read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: taskIds })
      });
      setNotifications([]);
    } catch (e: any) {
      console.error('Failed to mark notifications read', e);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAgents();
    fetchTasks();
    fetchPipelines();
    fetchNotifications();

    // Auto-poll notifications and active tasks every 8 seconds
    const interval = setInterval(() => {
      fetchNotifications();
      fetchTasks();
      fetchPipelines();
    }, 8000);

    return () => clearInterval(interval);
  }, [fetchAgents, fetchTasks, fetchPipelines, fetchNotifications]);

  return {
    agents,
    tasks,
    pipelines,
    notifications,
    loading,
    error,
    createAgent,
    deleteAgent,
    dispatchTask,
    createPipeline,
    markNotificationsRead,
    refreshAgents: fetchAgents,
    refreshTasks: fetchTasks,
    refreshPipelines: fetchPipelines,
    refreshNotifications: fetchNotifications
  };
}
