// d:\Projects\system\app\Providers.tsx

"use client";

import React from "react";
import { SWRConfig } from 'swr';
import { SchoolDataProvider, useSchoolData } from "./context/SchoolDataContext";
import { SupabaseAuthProvider, useAuth } from "./context/SupabaseAuthContext";
import Navigation from "./components/Navigation";

const LoadingSpinner = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column", gap: "1rem" }}>
    <div className="spinner" />
    <style dangerouslySetInnerHTML={{ __html: `
      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}} />
    <p style={{ fontFamily: "sans-serif", color: "#666" }}>Loading...</p>
  </div>
);

function HydrationGuard({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  const { isHydrated } = useSchoolData();

  if (isLoading || !isHydrated) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseAuthProvider>
      <SWRConfig value={{
        fetcher: (url: string) => fetch(url).then(r => r.json()),
        revalidateOnFocus: false,
        provider: () => new Map()
      }}>
        <SchoolDataProvider>
          <HydrationGuard>
            <Navigation />
            {children}
          </HydrationGuard>
        </SchoolDataProvider>
      </SWRConfig>
    </SupabaseAuthProvider>
  );
}
