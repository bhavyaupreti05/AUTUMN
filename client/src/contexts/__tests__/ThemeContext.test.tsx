import { render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';
import { describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';

const ThemeTester = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
};

describe('ThemeContext Smoke Test', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('light');
  });

  it('toggling calls localStorage write and applies light class', async () => {
    render(
      <ThemeProvider>
        <ThemeTester />
      </ThemeProvider>
    );

    // Initial state is light (because polyfill says prefers-color-scheme: dark is false)
    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);

    // Toggle to dark
    const button = screen.getByText('Toggle Theme');
    await userEvent.click(button);

    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});
