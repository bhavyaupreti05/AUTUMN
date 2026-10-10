import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
}

export function useConversations() {
  
  const queryClient = useQueryClient();

  const fetchConversations = async (): Promise<Conversation[]> => {
    const res = await fetch('/api/conversations', {
      credentials: "include"
    });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    const data = await res.json();
    return data.conversations || [];
  };

  const { data: conversations = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conversations/${id}`, {
      credentials: "include",
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData(['conversations'], (old: Conversation[] | undefined) => 
        old?.filter(c => c.id !== id)
      );
    }
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string, title: string }) => {
      const res = await fetch(`/api/conversations/${id}/title`, {
      credentials: "include",
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      });
      if (!res.ok) throw new Error('Failed to rename');
    },
    onSuccess: (_, { id, title }) => {
      queryClient.setQueryData(['conversations'], (old: Conversation[] | undefined) => 
        old?.map(c => c.id === id ? { ...c, title } : c)
      );
    }
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string, isPinned: boolean }) => {
      const action = isPinned ? 'unpin' : 'pin';
      const res = await fetch(`/api/conversations/${id}/${action}`, {
      credentials: "include",
        method: 'POST'
      });
      if (!res.ok) throw new Error(`Failed to ${action}`);
    },
    onSuccess: (_, { id, isPinned }) => {
      queryClient.setQueryData(['conversations'], (old: Conversation[] | undefined) => 
        old?.map(c => c.id === id ? { ...c, is_pinned: !isPinned } : c)
      );
    }
  });

  return {
    conversations,
    isLoading,
    isError,
    refetch,
    deleteConversation: deleteMutation.mutate,
    renameConversation: renameMutation.mutate,
    togglePin: togglePinMutation.mutate,
  };
}
