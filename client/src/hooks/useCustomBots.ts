import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface CustomBotDocument {
  id: string;
  filename: string;
  status: 'PROCESSING' | 'READY' | 'PROCESSED_NO_RAG' | 'FAILED' | string;
  progress?: number;
}

export interface CustomBot {
  id: string;
  name: string;
  personality: string;
  accent: string;
  is_active: boolean;
  document_count: number;
  documents?: CustomBotDocument[];
  starter_questions?: string[];
}

export interface BotIntegration {
  configured: boolean;
  enabled?: boolean;
  public_key?: string;
  allowed_origins?: string[];
  last_used_at?: string | null;
  secret?: string;
}

interface BotInput { name: string; personality: string; accent: string; starter_questions?: string[]; }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Custom bot request failed');
  return data as T;
}

export function useCustomBots() {
  const queryClient = useQueryClient();
  const queryKey = ['customBots'];
  const botsQuery = useQuery({
    queryKey,
    queryFn: () => request<{ bots: CustomBot[] }>('/api/admin/custom-bots').then((data) => data.bots),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: BotInput }) => request<CustomBot>(id ? `/api/admin/custom-bots/${id}` : '/api/admin/custom-bots', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => request<CustomBot>(`/api/admin/custom-bots/${id}/status?active=${active}`, { method: 'PATCH' }),
    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CustomBot[]>(queryKey);
      queryClient.setQueryData<CustomBot[]>(queryKey, (bots = []) => bots.map((bot) => bot.id === id ? { ...bot, is_active: active } : bot));
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(queryKey, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => request(`/api/admin/custom-bots/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const getIntegration = (id: string) => request<BotIntegration>(`/api/admin/custom-bots/${id}/integration`);
  const saveIntegration = (id: string, input: Omit<BotIntegration, 'configured' | 'public_key' | 'last_used_at' | 'secret'>) => request<BotIntegration>(`/api/admin/custom-bots/${id}/integration`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const createIntegration = (id: string, input: Omit<BotIntegration, 'configured' | 'public_key' | 'last_used_at' | 'secret'>) => request<BotIntegration>(`/api/admin/custom-bots/${id}/integration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const rotateIntegration = (id: string) => request<BotIntegration>(`/api/admin/custom-bots/${id}/integration/rotate`, { method: 'POST' });
  const deleteIntegration = (id: string) => request(`/api/admin/custom-bots/${id}/integration`, { method: 'DELETE' });

  return {
    bots: botsQuery.data || [],
    isLoading: botsQuery.isLoading,
    error: botsQuery.error,
    saveBot: saveMutation.mutateAsync,
    toggleBot: toggleMutation.mutate,
    deleteBot: deleteMutation.mutateAsync,
    refreshBots: botsQuery.refetch,
    getIntegration,
    saveIntegration,
    createIntegration,
    rotateIntegration,
    deleteIntegration,
  };
}