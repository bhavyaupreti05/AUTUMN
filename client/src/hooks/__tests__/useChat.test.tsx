import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from '../useChat';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider } from '../../contexts/AuthContext';

global.fetch = vi.fn();

describe('useChat Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('optimistically adds message', async () => {
    (global.fetch as any).mockImplementation(async (url: string, _init: any) => {
      if (url.includes('/conversations')) {
        return { ok: true, json: async () => ({ messages: [] }) };
      }
      let readCount = 0;
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              readCount++;
              if (readCount === 1) return Promise.resolve({ done: false, value: new TextEncoder().encode('data: Hello\n\n') });
              return Promise.resolve({ done: true });
            })
          })
        }
      };
    });

    const { result } = renderHook(() => useChat('conv-1'), { wrapper });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.sendMessage('Hi');
    });

    const messages = result.current.messages;
    expect(messages.length).toBeGreaterThan(0);

    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'Hi' });
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant' });
  });

  it('handles error state on failed fetch', async () => {
    (global.fetch as any).mockImplementation(async (url: string, _init: any) => {
      if (url.includes('/conversations')) {
        return { ok: true, json: async () => ({ messages: [] }) };
      }
      throw new Error('Network error');
    });

    const { result } = renderHook(() => useChat('conv-2'), { wrapper });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.sendMessage('Hi');
    });

    const messages = result.current.messages;
    expect(messages[messages.length - 1].status).toBe('error');
    
    expect(result.current.messages[result.current.messages.length - 1].content).toContain('Error: Network error');
  });

  it('uses a lenient timeout for slow local LLM responses', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    (global.fetch as any).mockImplementation(async (url: string, _init: any) => {
      if (url.includes('/conversations')) {
        return { ok: true, json: async () => ({ messages: [] }) };
      }
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: Hello\n\n') })
              .mockResolvedValueOnce({ done: true })
          })
        }
      };
    });

    const { result } = renderHook(() => useChat('conv-3'), { wrapper });

    await act(async () => {
      result.current.sendMessage('Slow request');
      await Promise.resolve();
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 600000);
    vi.useRealTimers();
  });

  it('marks a streamed max-token response as aborted', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/conversations')) {
        return { ok: true, json: async () => ({ messages: [] }) };
      }
      let readCount = 0;
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              readCount++;
              if (readCount === 1) {
                return Promise.resolve({ done: false, value: new TextEncoder().encode('data: {"chunk":"Partial"}\n\ndata: {"status":"MAX_TOKENS"}\n\n') });
              }
              return Promise.resolve({ done: true });
            })
          })
        }
      };
    });

    const { result } = renderHook(() => useChat('conv-4'), { wrapper });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    await act(async () => {
      await result.current.sendMessage('Partial request');
    });

    expect(result.current.messages.at(-1)?.status).toBe('aborted');
    expect(result.current.messages.at(-1)?.content).toBe('Partial');
  });

  it('replaces the temporary assistant ID with the persisted message ID', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/conversations')) {
        return { ok: true, json: async () => ({ messages: [] }) };
      }
      let readCount = 0;
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              readCount++;
              if (readCount === 1) {
                return Promise.resolve({
                  done: false,
                  value: new TextEncoder().encode(
                    'data: {"chunk":"Answer"}\n\ndata: {"message_id":"persisted-answer-1"}\n\n'
                  ),
                });
              }
              return Promise.resolve({ done: true });
            }),
          }),
        },
      };
    });

    const { result } = renderHook(() => useChat('conv-feedback'), { wrapper });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    await act(async () => {
      await result.current.sendMessage('Give me an answer');
    });

    expect(result.current.messages.at(-1)).toMatchObject({
      id: 'persisted-answer-1',
      role: 'assistant',
      content: 'Answer',
      status: 'complete',
    });
  });

  it('retries in a new conversation when a stored conversation is forbidden', async () => {
    let chatRequests = 0;
    (global.fetch as any).mockImplementation(async (url: string, init: RequestInit) => {
      if (url.includes('/auth/me')) {
        return { ok: false, status: 401 };
      }
      if (url.includes('/conversations')) {
        return { ok: true, json: async () => ({ messages: [] }) };
      }
      chatRequests++;
      if (chatRequests === 1) {
        return { ok: false, status: 403 };
      }
      expect(JSON.parse(String(init.body)).conversation_id).toBeNull();
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"conversation_id":"new-conv"}\n\n') })
              .mockResolvedValueOnce({ done: true }),
          }),
        },
      };
    });

    const { result } = renderHook(() => useChat('stale-conv'), { wrapper });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    await act(async () => {
      await result.current.sendMessage('Start fresh');
    });

    expect(chatRequests).toBe(2);
    expect(result.current.messages.at(-1)?.status).toBe('complete');
  });

  it('restores a bot-specific conversation from its own storage key without touching the global chat key', async () => {
    localStorage.setItem('trpwbot.customBotConversation.bot-42', 'custom-conv-1');

    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/conversations/custom-conv-1')) {
        return { ok: true, json: async () => ({ messages: [{ id: 'm1', role: 'user', content: 'Earlier message' }] }) };
      }
      throw new Error('Unexpected fetch');
    });

    const { result } = renderHook(() => useChat(null, '/api/chat', 'trpwbot.customBotConversation.bot-42'), { wrapper });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect(result.current.currentConversationId).toBe('custom-conv-1');
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'Earlier message' });
    expect(localStorage.getItem('trpwbot.currentConversationId')).toBeNull();
    expect(localStorage.getItem('trpwbot.customBotConversation.bot-42')).toBe('custom-conv-1');
  });

  it('clears the stored conversation when the user explicitly starts a new chat', async () => {
    localStorage.setItem('trpwbot.currentConversationId', 'old-conv-1');

    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/conversations/old-conv-1')) {
        return { ok: true, json: async () => ({ messages: [{ id: 'm1', role: 'user', content: 'Old message' }] }) };
      }
      return { ok: true, json: async () => ({ messages: [] }) };
    });

    const { result, rerender } = renderHook(({ value }) => useChat(value), { wrapper, initialProps: { value: 'old-conv-1' } });

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect(result.current.currentConversationId).toBe('old-conv-1');

    rerender({ value: null });
    localStorage.removeItem('trpwbot.currentConversationId');

    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect(result.current.currentConversationId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(localStorage.getItem('trpwbot.currentConversationId')).toBeNull();
  });

  it('does not restore an old conversation after starting a new chat', async () => {
    let resolveHistory: ((response: { ok: boolean; json: () => Promise<{ messages: Array<{ id: string; role: 'user'; content: string }> }> }) => void) | undefined;
    const historyPending = new Promise<typeof resolveHistory extends ((response: infer T) => void) ? T : never>(resolve => {
      resolveHistory = resolve;
    });

    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/conversations/old-conv-2')) {
        return historyPending;
      }
      return { ok: true, json: async () => ({ messages: [] }) };
    });

    const { result, rerender } = renderHook(({ value }) => useChat(value), { wrapper, initialProps: { value: 'old-conv-2' } });

    await act(async () => {
      rerender({ value: null });
      await Promise.resolve();
    });
    expect(result.current.messages).toEqual([]);

    await act(async () => {
      resolveHistory?.({
        ok: true,
        json: async () => ({ messages: [{ id: 'old-message', role: 'user', content: 'Old conversation' }] }),
      });
      await Promise.resolve();
    });

    expect(result.current.messages).toEqual([]);
  });
});
