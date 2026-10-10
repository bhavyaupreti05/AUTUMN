import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('AuthContext', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('initial state starts as loading and unauthenticated, then resolves', async () => {
    // Mock checkAuth failure
    mockFetch.mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => useAuth(), { 
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider> 
    });
    
    // Initial state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it('login success sets authenticated and admin status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false }); // initial checkAuth on mount
    const username = 'demo-user';

    const { result } = renderHook(() => useAuth(), { 
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider> 
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // mock login success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'user-42', username, is_admin: true })
    });

    act(() => {
      result.current.login();
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.userId).toBe('user-42');
    expect(result.current.username).toBe(username);
    expect(mockFetch).toHaveBeenCalledWith('/auth/me', { credentials: 'include' });
  });

  it('login failure leaves unauthenticated', async () => {
    mockFetch.mockResolvedValue({ ok: false }); // applies to both mount and login

    const { result } = renderHook(() => useAuth(), { 
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider> 
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.login();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it('logout hits endpoint and clears state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ is_admin: false })
    }); // mount check

    const { result } = renderHook(() => useAuth(), { 
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider> 
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);

    mockFetch.mockResolvedValueOnce({ ok: true }); // logout mock

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    
    expect(mockFetch).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({
      method: 'POST',
      credentials: 'include'
    }));
  });
});
