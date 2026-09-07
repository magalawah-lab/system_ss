"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/SupabaseAuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, isAdmin, isTeacher, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const timer = setTimeout(() => {
        if (isAdmin) {
          router.push("/");
        } else if (isTeacher) {
          router.push("/teacher-dashboard");
        } else {
          router.push("/");
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isAdmin, isTeacher, router, isLoading]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || "Invalid email or password");
        setLoading(false);
      }
    } catch {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%)"
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ position: "relative", width: "48px", height: "48px" }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              border: "3px solid rgba(16, 185, 129, 0.2)",
              animation: "spin 1s linear infinite"
            }}></div>
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)"
            }}>
              <svg style={{ width: "24px", height: "24px", color: "#10b981" }} fill="none" viewBox="0 0 24 24">
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
          <p style={{ color: "#a1a1aa", fontSize: "14px" }} className="animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%)"
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "2px solid rgba(16, 185, 129, 0.5)",
            borderTopColor: "#10b981",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "#a1a1aa", fontSize: "14px" }} className="animate-pulse">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      width: "100%",
      background: "linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%)",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <div style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none"
      }}>
        <div style={{
          position: "absolute",
          top: 0,
          left: "25%",
          width: "384px",
          height: "384px",
          borderRadius: "50%",
          background: "rgba(16, 185, 129, 0.08)",
          filter: "blur(100px)"
        }} className="animate-pulse-slow"></div>
        <div style={{
          position: "absolute",
          bottom: 0,
          right: "25%",
          width: "384px",
          height: "384px",
          borderRadius: "50%",
          background: "rgba(20, 184, 166, 0.08)",
          filter: "blur(100px)"
        }} className="animate-pulse-slow delay-1000"></div>
      </div>

      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        padding: "48px 24px",
        position: "relative",
        zIndex: 1
      }}>
        <div style={{
          width: "100%",
          maxWidth: "400px",
          margin: "0 auto"
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px"
          }}>
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.3)",
                filter: "blur(20px)"
              }}></div>
              <div style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "72px",
                height: "72px",
                borderRadius: "16px",
                background: "rgba(24, 24, 27, 0.9)",
                border: "2px solid rgba(16, 185, 129, 0.3)",
                boxShadow: "0 20px 40px -10px rgba(16, 185, 129, 0.3)",
                overflow: "hidden"
              }}>
                <img
                  src="/logo.jpg"
                  alt="School Logo"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    padding: "8px",
                    borderRadius: "16px"
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "9999px",
              background: "rgba(16, 185, 129, 0.1)",
              color: "#34d399",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              padding: "4px 12px",
              fontSize: "12px",
              fontWeight: 500
            }}>
              BSSS - School Management System
            </span>
          </div>

          <div style={{
            background: "rgba(24, 24, 27, 0.8)",
            backdropFilter: "blur(20px)",
            borderRadius: "24px",
            padding: "32px",
            border: "1px solid rgba(39, 39, 42, 0.5)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
          }}>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <h1 style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "white",
                margin: "0 0 8px 0",
                letterSpacing: "-0.02em"
              }}>
                Welcome back
              </h1>
              <p style={{ color: "#a1a1aa", fontSize: "14px", margin: 0 }}>
                Enter your credentials to access the system
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {error && (
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "14px",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "12px",
                  color: "#f87171",
                  fontSize: "14px"
                }}>
                  <svg style={{ width: "18px", height: "18px", flexShrink: 0, marginTop: "1px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#d4d4d8",
                  marginLeft: "4px"
                }}>
                  Email
                </label>
                <div style={{ position: "relative" }}>
                  <div style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center"
                  }}>
                    <svg style={{ width: "18px", height: "18px", color: "#71717a" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    placeholder="admin@school.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "14px 14px 14px 46px",
                      borderRadius: "12px",
                      border: "1px solid rgba(63, 63, 70, 0.5)",
                      background: "rgba(39, 39, 42, 0.3)",
                      color: "white",
                      fontSize: "14px",
                      outline: "none",
                      transition: "all 0.2s"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#d4d4d8",
                  marginLeft: "4px"
                }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <div style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center"
                  }}>
                    <svg style={{ width: "18px", height: "18px", color: "#71717a" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "14px 14px 14px 46px",
                      borderRadius: "12px",
                      border: "1px solid rgba(63, 63, 70, 0.5)",
                      background: "rgba(39, 39, 42, 0.3)",
                      color: "white",
                      fontSize: "14px",
                      outline: "none",
                      transition: "all 0.2s"
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: loading ? "rgba(16, 185, 129, 0.5)" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  marginTop: "8px",
                  boxShadow: "0 4px 14px -2px rgba(16, 185, 129, 0.3)",
                  transition: "all 0.2s"
                }}
              >
                {loading ? (
                  <>
                    <svg style={{ width: "18px", height: "18px" }} className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* Info Section */}
            <div style={{
              marginTop: "24px",
              paddingTop: "20px",
              borderTop: "1px solid rgba(63, 63, 70, 0.3)"
            }}>
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "8px",
                padding: "14px",
                background: "rgba(39, 39, 42, 0.3)",
                borderRadius: "12px",
                border: "1px solid rgba(63, 63, 70, 0.3)"
              }}>
                <div style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#34d399",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}>
                  JADEFAZE TECH SERVICES
                </div>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  fontSize: "11px",
                  color: "#a1a1aa"
                }}>
                  <div>Seeta Namugongo Road</div>
                  <div>Tel: 0754989392</div>
                  <div>jadefaze@gmail.com</div>
                </div>
                <div style={{
                  display: "flex",
                  gap: "12px",
                  fontSize: "10px",
                  color: "#71717a",
                  marginTop: "4px"
                }}>
                  <span>FB: @jadefaze</span>
                  <span>X: @Jadefaze</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        .delay-1000 {
          animation-delay: 1s;
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}