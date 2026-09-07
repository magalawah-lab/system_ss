// app/context/MockAuthContext.tsx
"use client";

import React, { createContext, useContext, useState } from 'react';

type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'teacher';
};

type AuthContextType = {
  user: User | null;
  currentUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [user] = useState<User>({
    id: 'mock-user-1',
    email: 'admin@school.com',
    name: 'Administrator',
    role: 'admin'
  });

  const value: AuthContextType = {
    user,
    currentUser: user,
    isLoading: false,
    isAuthenticated: true,
    isAdmin: true,
    isTeacher: false,
    login: async () => ({ success: true }),
    logout: async () => {},
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a MockAuthProvider');
  }
  return context;
}