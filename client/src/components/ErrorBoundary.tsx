import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] p-8 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-sm max-w-md w-full text-center">
            <div className="text-[var(--error)] mb-4 flex justify-center">
              <AlertCircle size={48} />
            </div>
            <h2 className="text-[var(--text-primary)] text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-[var(--text-secondary)] mb-6 text-sm">
              We encountered an unexpected error while rendering this page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-[var(--radius-md)] transition-colors inline-flex items-center justify-center gap-2 w-full"
            >
              <RefreshCw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
