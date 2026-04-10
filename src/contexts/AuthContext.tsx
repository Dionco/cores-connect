import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseRedirectUrl, isSupabaseConfigured, supabase } from '@/lib/supabase';

interface AuthUser {
  name: string;
  email: string;
  role: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  authMode: 'supabase' | 'mock';
  isAdmin: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  loginSSO: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ALLOWED_EMAIL_DOMAIN = 'cores.nl';
const ADMIN_ROLES = new Set(['admin', 'hr_admin']);

const normalizeRole = (role: unknown): string | null => {
  if (typeof role !== 'string') {
    return null;
  }
  const normalized = role.trim().toLowerCase();
  return normalized || null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [user, setUser] = useState<AuthUser | null>(null);
  const isAdmin = Boolean(user?.role && ADMIN_ROLES.has(user.role));

  const setUserFromSession = (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }

    const email = session.user.email || '';

    // Enforce domain restriction for SSO users
    if (email && !email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
      supabase?.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
      return;
    }

    const displayName =
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      (email ? email.split('@')[0] : 'User');
    const role = normalizeRole(session.user.app_metadata?.role);

    setUser({ name: displayName, email, role });
    setIsAuthenticated(true);
  };

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        setUser(null);
        setIsAuthenticated(false);
      } else {
        setUserFromSession(data.session);
      }
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserFromSession(session);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!supabase) {
      setUser({ name: 'HR Admin', email, role: 'hr_admin' });
      setIsAuthenticated(true);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message);
    }

    setUserFromSession(data.session);
  };

  const loginSSO = async () => {
    if (!supabase) {
      setUser({ name: 'HR Admin', email: 'admin@cores.nl', role: 'hr_admin' });
      setIsAuthenticated(true);
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: getSupabaseRedirectUrl(),
        scopes: 'email profile',
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const logout = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(error.message);
      }
    }

    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        authMode: isSupabaseConfigured ? 'supabase' : 'mock',
        isAdmin,
        user,
        login,
        loginSSO,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
