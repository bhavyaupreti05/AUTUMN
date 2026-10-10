import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../contexts/AuthContext';
import { LoginPage } from '../LoginPage';

const renderLoginPage = () => render(
  <MemoryRouter>
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  </MemoryRouter>
);

describe('LoginPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const password = screen.getByPlaceholderText('Password');
    const toggle = screen.getByRole('button', { name: 'Show password' });

    expect(password).toHaveAttribute('type', 'password');
    await user.click(toggle);
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });

  it('keeps the password toggle available in sign-up mode', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: "Don't have an account? Sign up" }));

    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });
});
