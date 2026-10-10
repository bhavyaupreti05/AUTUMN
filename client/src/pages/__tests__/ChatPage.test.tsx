import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { ChatPage } from '../ChatPage';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ userId: 'user-1' }),
}));

vi.mock('../../hooks/useChat', () => ({
  useChat: () => ({
    messages: [],
    isGenerating: false,
    sendMessage: vi.fn(),
    stopGeneration: vi.fn(),
    regenerateMessage: vi.fn(),
    currentConversationId: null,
  }),
}));

vi.mock('../../hooks/useDocuments', () => ({
  useDocuments: () => ({
    documents: [],
    uploadDocument: vi.fn(),
    isUploading: false,
    uploadError: null,
    detachDocument: vi.fn(),
  }),
}));

vi.mock('../../components/chat/Sidebar', () => ({
  Sidebar: () => <aside aria-label="Conversation sidebar" />,
}));

vi.mock('../../components/chat/ChatArea', () => ({
  ChatArea: () => <main aria-label="Chat area" />,
}));

vi.mock('../../components/chat/ChatInput', () => ({
  ChatInput: () => <div aria-label="Chat input" />,
}));

describe('ChatPage help dialog', () => {
  it('opens and closes help content', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <ChatPage />
        </ThemeProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Open help' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Using Autumn')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close help' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
