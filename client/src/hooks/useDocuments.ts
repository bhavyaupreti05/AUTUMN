import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export interface Document {
  id: string;
  filename: string;
  status: 'PROCESSING' | 'READY' | 'PROCESSED_NO_RAG' | 'FAILED';
  progress?: number;
}

export function useDocuments(conversationId: string | null) {
  
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const queryKey = ['documents', conversationId];

  const fetchDocs = async (): Promise<Document[]> => {
    if (!conversationId) return [];
    const res = await fetch(`/api/conversations/${conversationId}/documents`, {
      credentials: "include"
    });
    if (!res.ok) throw new Error('Failed to fetch documents');
    const data = await res.json();
    return data.documents || [];
  };

  const { data: documents = [], isLoading } = useQuery({
    queryKey,
    queryFn: fetchDocs,
    enabled: !!conversationId,
    // Poll every 2 seconds ONLY IF there are processing documents
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.some(d => d.status === 'PROCESSING');
      return hasProcessing ? 2000 : false;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadError(null);
      if (!conversationId) throw new Error("No conversation selected");

      // 1. Upload Document
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/documents', {
      credentials: "include",
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Upload failed");
      }
      
      const data = await res.json();
      const docId = data.document.id;

      // 2. Attach to Conversation
      const attachRes = await fetch(`/api/conversations/${conversationId}/documents`, {
      credentials: "include",
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ document_id: docId })
      });
      
      if (!attachRes.ok) throw new Error("Failed to attach document");
      return data.document;
    },
    onSuccess: () => {
      // Invalidate query to trigger a refetch and start polling if processing
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      setUploadError(err.message);
    }
  });

  const detachMutation = useMutation({
    mutationFn: async (docId: string) => {
      if (!conversationId) return;
      const res = await fetch(`/api/conversations/${conversationId}/documents/${docId}`, {
      credentials: "include",
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to detach document");
    },
    onSuccess: (_, docId) => {
      queryClient.setQueryData(queryKey, (old: Document[] | undefined) => 
        old?.filter(d => d.id !== docId)
      );
    }
  });

  return {
    documents,
    isLoading,
    uploadDocument: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    uploadError,
    detachDocument: detachMutation.mutate,
  };
}
