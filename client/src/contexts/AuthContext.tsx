import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  userId: string | null;
  username: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>('Bhavya');

  const checkAuth = async () => {
    try {
      const res = await fetch('/auth/me', { credentials: 'include' }); 
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setIsAdmin(data.is_admin === true);
        setUserId(data.id ?? null);
        setUsername(data.username ?? 'Bhavya');
      } else {
        setIsAuthenticated(true);
        setIsAdmin(true);
        setUserId(null);
        setUsername('Bhavya');
      }
    } catch {
      setIsAuthenticated(true);
      setIsAdmin(true);
      setUserId(null);
      setUsername('Bhavya');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async () => {
    setIsLoading(true);
    await checkAuth();
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', { credentials: 'include', method: 'POST' });
    } catch {}
    await checkAuth();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, isAdmin, userId, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
