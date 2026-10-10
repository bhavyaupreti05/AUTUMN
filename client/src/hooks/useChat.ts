import { useState, useRef, useCallback, useEffect } from 'react';
import { createId } from '../utils/id';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'sending' | 'complete' | 'aborted' | 'error' | 'timeout';
}

const CHAT_TIMEOUT_MS = 600000; // 10 minutes for slow local LLM inference; avoid aborting valid document-grounded answers

export function useChat(initialConversationId: string | null | undefined, chatEndpoint = '/api/chat', storageKey = 'trpwbot.currentConversationId') {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const resolveConversationId = useCallback((providedId: string | null | undefined) => {
    if (providedId !== undefined) {
      if (providedId === null && storageKey === 'trpwbot.currentConversationId') return null;
      if (providedId === null) return typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      return providedId;
    }
    return typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
  }, [storageKey]);

  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => resolveConversationId(initialConversationId));
  
  
  // Ref to hold the streamed text before flushing to state
  const streamingTextRef = useRef('');
  const flushFrameRef = useRef<number | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversation messages when the ID changes externally
  useEffect(() => {
    let cancelled = false;
    const nextConversationId = resolveConversationId(initialConversationId);

    if (nextConversationId) {
      if (!cancelled) setCurrentConversationId(nextConversationId);
      // Fetch history
      fetch(`/api/conversations/${nextConversationId}`, {
      credentials: "include"
      })
      .then(res => {
        if (cancelled) return null;
        if (res.status === 403 || res.status === 404) {
          localStorage.removeItem(storageKey);
          setCurrentConversationId(null);
          setMessages([]);
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!cancelled && data?.messages) {
          setMessages(data.messages);
        }
      })
      .catch(err => {
        if (!cancelled) console.error("Failed to load history", err);
      });
    } else {
      setCurrentConversationId(null);
      setMessages([]);
    }

    return () => {
      cancelled = true;
    };
  }, [initialConversationId, storageKey]);

  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem(storageKey, currentConversationId);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [currentConversationId, storageKey]);

  const scheduleFlush = useCallback(() => {
    if (flushFrameRef.current !== null) return; 
    flushFrameRef.current = requestAnimationFrame(() => {
      setMessages((prev) => 
        prev.map(msg => 
          msg.id === activeAssistantIdRef.current 
            ? { ...msg, content: streamingTextRef.current } 
            : msg
        )
      );
      flushFrameRef.current = null;
    });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isGenerating) return;

    const userMsg: Message = { id: createId(), role: 'user', content: text };
    
    const assistantId = createId();
    activeAssistantIdRef.current = assistantId;
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', status: 'sending' };
    
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsGenerating(true);
    streamingTextRef.current = '';

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    try {
      const requestChat = (conversationId: string | null) => fetch(chatEndpoint, {
        credentials: "include",
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId
        })
      });

      let requestConversationId = currentConversationId;
      let res = await requestChat(requestConversationId);
      if (res.status === 403 && requestConversationId) {
        localStorage.removeItem(storageKey);
        setCurrentConversationId(null);
        requestConversationId = null;
        res = await requestChat(null);
      }

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errorMsg = "API Error";
        if (res.status === 429) errorMsg = "Rate limit exceeded. Please wait a minute and try again.";
        else if (res.status === 503) errorMsg = "Server is currently busy. Please try again shortly.";
        else if (res.status === 401) errorMsg = "Unauthorized. Please log in again.";
        else {
          const errorData = await res.json().catch(() => ({}));
          if (typeof errorData.detail === 'string' && errorData.detail.trim()) errorMsg = errorData.detail;
        }
        throw new Error(errorMsg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream available');
      const decoder = new TextDecoder("utf-8");
      let buffer = '';
      let streamStatus: Message['status'] = 'complete';
      let streamError: Error | null = null;

      streamLoop: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr.trim() === '[DONE]') break;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.conversation_id) {
                setCurrentConversationId(data.conversation_id);
                requestConversationId = data.conversation_id;
              }
              if (data.chunk) {
                streamingTextRef.current += data.chunk;
                scheduleFlush();
              }
              if (data.message_id) {
                const temporaryId = activeAssistantIdRef.current;
                setMessages((prev) => prev.map((message) => message.id === temporaryId ? { ...message, id: data.message_id } : message));
                activeAssistantIdRef.current = data.message_id;
              }
              if (data.error) {
                streamError = new Error(data.error);
                break streamLoop;
              }
              if (data.status === 'MAX_TOKENS') {
                streamStatus = 'aborted';
              }
            } catch (e) {
              console.error("Error parsing SSE chunk", e);
            }
          }
        }
      }

      if (streamError) throw streamError;
      
      if (buffer.trim()) {
         const lines = buffer.split('\n');
         for (const line of lines) {
           if (line.startsWith('data: ')) {
             const dataStr = line.slice(6);
             if (dataStr.trim() !== '[DONE]') {
               try {
                 const data = JSON.parse(dataStr);
                 if (data.chunk) streamingTextRef.current += data.chunk;
               } catch {}
             }
           }
         }
      }
      
      const currentId = activeAssistantIdRef.current;
      setMessages((prev) => 
        prev.map(msg => 
          msg.id === currentId 
            ? { ...msg, content: streamingTextRef.current, status: streamStatus }
            : msg
        )
      );

    } catch (err: any) {
      clearTimeout(timeoutId);
      const hasContent = streamingTextRef.current.trim().length > 0;
      
      const status = hasContent ? 'aborted' : 'error';
      
      let content = '';
      if (hasContent) {
        content = streamingTextRef.current;
      } else {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          content = `Network connection lost. The server might still be processing. Please wait a moment and refresh.`;
        } else {
          content = `Error: ${err.message}`;
        }
      }

      const currentId = activeAssistantIdRef.current;
      setMessages(prev => 
        prev.map(msg => 
          msg.id === currentId 
            ? { ...msg, content, status } 
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
      activeAssistantIdRef.current = null;
      if (flushFrameRef.current !== null) {
        cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
    }
  }, [chatEndpoint, isGenerating, scheduleFlush, currentConversationId]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const regenerateMessage = useCallback(async (messageId: string, newContent: string) => {
    if (isGenerating) return;
    
    // Find index of the edited user message
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    
    // Truncate history up to (and excluding) this message, since we are sending a new one
    // Wait, if we are modifying it, we can just slice up to the message, and then call sendMessage
    // But `sendMessage` just appends. 
    // We can manually set the messages array to truncated, and then trigger the API logic.
    
    // Slice up to idx (exclusive)
    const truncatedHistory = messages.slice(0, idx);
    
    const userMsg: Message = { id: createId(), role: 'user', content: newContent };
    const assistantId = createId();
    activeAssistantIdRef.current = assistantId;
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', status: 'sending' };
    
    setMessages([...truncatedHistory, userMsg, assistantMsg]);
    setIsGenerating(true);
    streamingTextRef.current = '';

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    try {
      const res = await fetch(chatEndpoint, {
        credentials: "include",
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: newContent,
          conversation_id: currentConversationId,
          truncate_from_message_id: messageId
        })
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errorMsg = "API Error";
        if (res.status === 429) errorMsg = "Rate limit exceeded. Please wait a minute and try again.";
        else if (res.status === 503) errorMsg = "Server is currently busy. Please try again shortly.";
        else if (res.status === 401) errorMsg = "Unauthorized. Please log in again.";
        else {
          const errorData = await res.json().catch(() => ({}));
          if (typeof errorData.detail === 'string' && errorData.detail.trim()) errorMsg = errorData.detail;
        }
        throw new Error(errorMsg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream available');
      const decoder = new TextDecoder("utf-8");
      let buffer = '';
      let streamStatus: Message['status'] = 'complete';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr.trim() === '[DONE]') break;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.conversation_id && !currentConversationId) {
                // Not strictly needed here since we require currentConversationId to edit, but safe
              }
              if (data.chunk) {
                streamingTextRef.current += data.chunk;
                scheduleFlush();
              }
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.status === 'MAX_TOKENS') {
                streamStatus = 'aborted';
              }
            } catch (e) {
              console.error("Error parsing SSE chunk", e);
            }
          }
        }
      }
      
      if (buffer.trim()) {
         const lines = buffer.split('\n');
         for (const line of lines) {
           if (line.startsWith('data: ')) {
             const dataStr = line.slice(6);
             if (dataStr.trim() !== '[DONE]') {
               try {
                 const data = JSON.parse(dataStr);
                 if (data.chunk) streamingTextRef.current += data.chunk;
               } catch {}
             }
           }
         }
      }
      
      const currentId = activeAssistantIdRef.current;
      setMessages((prev) => 
        prev.map(msg => 
          msg.id === currentId 
            ? { ...msg, content: streamingTextRef.current, status: streamStatus }
            : msg
        )
      );

    } catch (err: any) {
      clearTimeout(timeoutId);
      const hasContent = streamingTextRef.current.trim().length > 0;
      
      const status = hasContent ? 'aborted' : 'error';
      
      let content = '';
      if (hasContent) {
        content = streamingTextRef.current;
      } else {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          content = `Network connection lost. The server might still be processing. Please wait a moment and refresh.`;
        } else {
          content = `Error: ${err.message}`;
        }
      }

      const currentId = activeAssistantIdRef.current;
      setMessages(prev => 
        prev.map(msg => 
          msg.id === currentId 
            ? { ...msg, content, status } 
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
      activeAssistantIdRef.current = null;
      if (flushFrameRef.current !== null) {
        cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
    }
  }, [chatEndpoint, messages, isGenerating, scheduleFlush, currentConversationId]);

  return { messages, isGenerating, sendMessage, stopGeneration, regenerateMessage, currentConversationId };
}
