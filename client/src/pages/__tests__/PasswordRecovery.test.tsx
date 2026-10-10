import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPage } from '../LoginPage';
import { ResetPasswordPage } from '../ResetPasswordPage';
import { AdminPage } from '../AdminPage';
import { Sidebar } from '../../components/chat/Sidebar';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { AuthProvider } from '../../contexts/AuthContext';

const { issueResetToken, copyText } = vi.hoisted(() => ({
  issueResetToken: vi.fn(),
  copyText: vi.fn(),
}));

vi.mock('../../hooks/useAdmin', () => ({
  useAdminAnalytics: () => ({ data: { summary: {}, volume: [], trending: [], top_users: [], top_documents: [] }, isLoading: false, error: null, refetch: vi.fn() }),
  useAdminFeedback: () => ({ data: [], isLoading: false, reviewFeedback: vi.fn() }),
  useAdminSuggestions: () => ({ data: [], isLoading: false, reviewSuggestion: vi.fn() }),
  useAdminLearningInsights: () => ({ data: { repeated_questions: [], pending_negative_feedback: 0, verified_corrections: 0 } }),
  useUserConversations: () => ({ data: { conversations: [] }, isLoading: false }),
  useAdminUsers: () => ({
    pendingUsers: [], activeUsers: [{ id: 'user-1', username: 'normal-user', is_admin: false, status: 'approved' }], isLoading: false,
    approveUser: vi.fn(), rejectUser: vi.fn(), promoteUser: vi.fn(), demoteUser: vi.fn(), deactivateUser: vi.fn(), issueResetToken,
    errors: {}, clearErrors: vi.fn(),
  }),
}));

vi.mock('../../hooks/useConversations', () => ({
  useConversations: () => ({ conversations: [], isLoading: false, isError: false, refetch: vi.fn(), deleteConversation: vi.fn(), renameConversation: vi.fn(), togglePin: vi.fn() }),
}));

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/AuthContext')>('../../contexts/AuthContext');
  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, isAdmin: true, userId: 'admin-1', login: vi.fn(), logout: vi.fn() }) };
});

vi.mock('../../utils/copy', () => ({ copyText }));
vi.mock('recharts', () => {
  const Placeholder = ({ children }: { children?: unknown }) => <div>{children}</div>;
  return { AreaChart: Placeholder, Area: Placeholder, XAxis: Placeholder, YAxis: Placeholder, CartesianGrid: Placeholder, Tooltip: Placeholder, ResponsiveContainer: Placeholder, BarChart: Placeholder, Bar: Placeholder, LineChart: Placeholder, Line: Placeholder, Legend: Placeholder };
});

const renderWithProviders = (element: React.ReactElement) => render(
  <MemoryRouter>
    <ThemeProvider>{element}</ThemeProvider>
  </MemoryRouter>
);

describe('password recovery UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
  });

  it('shows the administrator recovery instruction from login', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthProvider><LoginPage /></AuthProvider>);
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByText('Ask your administrator for a reset link')).toBeInTheDocument();
  });

  it('reads the hash token, clears the fragment, and submits a reset', async () => {
    window.history.replaceState(null, '', '/reset-password#token=test-reset-token');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />);
    await user.type(screen.getByPlaceholderText('New password'), 'Reset-New-Password-1');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'Reset-New-Password-1');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/auth/reset-password', expect.objectContaining({ method: 'POST' })));
    expect(window.location.hash).toBe('');
  });

  it('shows the backend password policy error', async () => {
    window.history.replaceState(null, '', '/reset-password#token=test-reset-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Password must be at least 10 characters long.' }),
    }));
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />);
    await user.type(screen.getByPlaceholderText('New password'), 'short');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Password must be at least 10 characters long.')).toBeInTheDocument();
  });

  it('shows the local password error before submitting a short password', async () => {
    window.history.replaceState(null, '', '/reset-password#token=test-reset-token');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />);
    await user.type(screen.getByPlaceholderText('New password'), '123456789');
    await user.type(screen.getByPlaceholderText('Confirm new password'), '123456789');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(screen.getByText('Password must be at least 10 characters long.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('issues and copies an admin reset link', async () => {
    issueResetToken.mockResolvedValue({ token: 'one-time-token', expires_at: '2026-09-21T18:00:00+00:00' });
    const user = userEvent.setup();
    renderWithProviders(<AdminPage />);
    await user.click(screen.getByRole('button', { name: /User Management/ }));
    await user.click(screen.getByTitle('Reset password'));
    const passwordInput = screen.getByPlaceholderText('Your administrator password');
    await user.type(passwordInput, 'Admin-Password-1');
    expect(passwordInput).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show administrator password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide administrator password' }));
    await user.click(screen.getByRole('button', { name: 'Issue one-time link' }));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('/reset-password#token=one-time-token'));
    expect(screen.getByRole('button', { name: 'Link copied' })).toHaveTextContent('Copied');
  });

  it('opens and submits the change-password dialog', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<Sidebar currentConversationId={null} onSelectConversation={vi.fn()} onNewConversation={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Profile|User admin-1/i }));
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await user.type(screen.getByPlaceholderText('Current password'), 'Current-Password-1');
    await user.type(screen.getByPlaceholderText('New password'), 'New-Password-1');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'New-Password-1');
    await user.click(screen.getByRole('button', { name: 'Change password', exact: true }));
    expect(fetchMock).toHaveBeenCalledWith('/auth/change-password', expect.objectContaining({ method: 'POST' }));
  });

  it('shows a manual-copy error when the clipboard fallback fails', async () => {
    issueResetToken.mockResolvedValue({ token: 'one-time-token', expires_at: '2026-09-21T18:00:00+00:00' });
    copyText.mockRejectedValue(new Error('Copy failed'));
    const user = userEvent.setup();
    renderWithProviders(<AdminPage />);
    await user.click(screen.getByRole('button', { name: /User Management/ }));
    await user.click(screen.getByTitle('Reset password'));
    await user.type(screen.getByPlaceholderText('Your administrator password'), 'Admin-Password-1');
    await user.click(screen.getByRole('button', { name: 'Issue one-time link' }));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(screen.getByText('Copy failed. Select the link and copy it manually.')).toBeInTheDocument();
  });
});
