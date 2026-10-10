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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      const res = await fetch('/auth/me', { credentials: 'include' }); 
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setIsAdmin(data.is_admin === true);
        setUserId(data.id ?? null);
        setUsername(data.username ?? null);
      } else {
        setIsAuthenticated(false);
        setIsAdmin(false);
        setUserId(null);
        setUsername(null);
      }
    } catch {
      setIsAuthenticated(false);
      setIsAdmin(false);
      setUserId(null);
      setUsername(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async () => {
    // Re-check auth to grab the isAdmin status after logging in
    setIsLoading(true);
    await checkAuth();
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', {
      credentials: "include", method: 'POST' });
    } catch {}
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUserId(null);
    setUsername(null);
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
