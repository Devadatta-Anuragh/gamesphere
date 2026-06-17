'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, unwrap } from './api';
import { clearToken, getToken, setToken } from './token';

export interface AuthUser {
  id: string;
  username: string;
  avatar: string;
  rating: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from a stored token on first load.
  useEffect(() => {
    const existing = getToken();
    if (!existing) {
      setLoading(false);
      return;
    }
    setTokenState(existing);
    api
      .get<{ data: { user: AuthUser } }>('/users/me')
      .then((res) => setUser(res.data.data.user))
      .catch(() => {
        clearToken();
        setTokenState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string): Promise<void> => {
    const { token: t, user: u } = unwrap<{ token: string; user: AuthUser }>(
      await api.post('/auth/login', { username }),
    );
    setToken(t);
    setTokenState(t);
    setUser(u);
  };

  const logout = (): void => {
    clearToken();
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
