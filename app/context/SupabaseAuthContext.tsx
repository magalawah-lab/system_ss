// app/context/SupabaseAuthContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export type UserRole = "admin" | "teacher";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

type AuthContextType = {
  user: AppUser | null;
  currentUser: AppUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const supabase = createClient();

const getErrorMessage = (error: any): string => {
  if (error?.message === 'Invalid login credentials') {
    return 'Invalid email or password. Please try again.';
  }
  if (error?.message === 'Failed to fetch' || error?.message?.includes('fetch')) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }
  return error?.message || 'An unexpected error occurred. Please try again.';
};

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserProfile = async (authUser: User) => {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        return;
      }

      if (profile) {
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: profile.name || authUser.email?.split('@')[0] || 'User',
          role: profile.role || 'teacher',
        });
      } else {
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            id: authUser.id,
            email: authUser.email,
            name: authUser.email?.split('@')[0] || 'User',
            role: 'teacher',
          })
          .select()
          .single();

        if (!createError && newProfile) {
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: newProfile.name || authUser.email?.split('@')[0] || 'User',
            role: newProfile.role || 'teacher',
          });
        } else {
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.email?.split('@')[0] || 'User',
            role: 'teacher',
          });
        }
      }
    } catch (error) {
      // Silently fail
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          setIsLoading(false);
          return;
        }

        if (session) {
          setSession(session);
          await loadUserProfile(session.user);
        }
      } catch (error) {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);

        if (session) {
          await loadUserProfile(session.user);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!email || !password) {
      return { success: false, error: 'Email and password are required.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { success: false, error: getErrorMessage(error) };
      }

      if (data.user) {
        await loadUserProfile(data.user);
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (error) {
      // Silently fail
    }
  };

  const value: AuthContextType = {
    user,
    currentUser: user,
    session,
    isLoading,
    isAuthenticated: user !== null,
    isAdmin: user?.role === 'admin',
    isTeacher: user?.role === 'teacher',
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ✅ MAKE SURE useAuth IS EXPORTED AS A NAMED EXPORT
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}

// ✅ Also export the context if needed
export { AuthContext };