import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseRedirectUrl, isSupabaseConfigured, supabase } from '@/lib/supabase';

interface AuthUser {
  name: string;
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  authMode: 'supabase' | 'mock';
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  loginSSO: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [user, setUser] = useState<AuthUser | null>(null);

  const setUserFromSession = (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }

    const email = session.user.email || '';
    const displayName =
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      (email ? email.split('@')[0] : 'User');

    setUser({ name: displayName, email });
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
      setUser({ name: 'HR Admin', email });
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
      setUser({ name: 'HR Admin', email: 'admin@cores.nl' });
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
