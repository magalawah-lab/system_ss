"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/SupabaseAuthContext";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireTeacher?: boolean;
};

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireTeacher = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, isTeacher, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // Don't redirect while loading

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (requireAdmin && !isAdmin) {
      router.push("/teacher-dashboard");
      return;
    }

    if (requireTeacher && !isTeacher) {
      router.push("/");
      return;
    }
  }, [isAuthenticated, isAdmin, isTeacher, isLoading, requireAdmin, requireTeacher, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Access denied. Admin access required.</p>
      </div>
    );
  }

  if (requireTeacher && !isTeacher) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Access denied. Teacher access required.</p>
      </div>
    );
  }

  return <>{children}</>;
}

