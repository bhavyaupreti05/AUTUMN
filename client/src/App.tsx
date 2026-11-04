import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ChatPage } from './pages/ChatPage';
import './index.css';

const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const AgentStudioPage = lazy(() => import('./pages/AgentStudioPage').then(module => ({ default: module.AgentStudioPage })));

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <BrowserRouter>
              <Routes>
                {/* Direct open access for everyone */}
                <Route path="/" element={<ChatPage />} />
                <Route path="/agents" element={<Suspense fallback={null}><AgentStudioPage /></Suspense>} />
                <Route path="/admin" element={<Suspense fallback={null}><AdminPage /></Suspense>} />
                
                {/* Redirect login / registration / recovery directly to chat */}
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/reset-password" element={<Navigate to="/" replace />} />
                <Route path="/admin-recovery" element={<Navigate to="/" replace />} />
                
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
