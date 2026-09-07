"use client";

import React, { Suspense, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SupabaseAuthProvider } from './context/SupabaseAuthContext';
import { SchoolDataProvider } from './context/SchoolDataContext';
import { AcademicYearProvider } from './context/AcademicYearContext';
import Navigation from './components/Navigation';
import Link from 'next/link';
import { useAuth } from './context/SupabaseAuthContext';
import './globals.css';

// SchoolBanner component
function SchoolBanner() {
  const { currentUser } = useAuth();
  const homePath = currentUser?.role === 'teacher' ? '/teacher-dashboard' : '/';

  return (
    <header className="school-banner">
      <Link href={homePath} className="school-banner-link" aria-label="Go to dashboard home">
        <div className="banner-content">
          <div className="banner-left">
            <div className="school-logo">
              <img
                src="/logo.jpg"
                alt="School Logo"
                style={{
                  width: '50px',
                  height: '50px',
                  objectFit: 'contain',
                  borderRadius: '8px'
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="school-info">
              <h1 className="school-name">Busaana Senior Secondary School</h1>
              <p className="school-motto">"Education is Key to Success"</p>
            </div>
          </div>
          <div className="banner-right">
            <div className="banner-year">
              <span>📅</span>
              <span>{new Date().getFullYear()}</span>
            </div>
          </div>
        </div>
      </Link>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const hidePageChrome = pathname?.includes('/pdf') || pathname?.includes('/print') || false;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <html lang="en">
      <body>
        <SupabaseAuthProvider>
          <SchoolDataProvider>
            <AcademicYearProvider>
              <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                background: '#f3f4f6'
              }}>
                {!hidePageChrome && <SchoolBanner />}

                {!hidePageChrome && (
                  <Suspense fallback={null}>
                    <Navigation />
                  </Suspense>
                )}

                {/* Main Content */}
                <main className="main-content">
                  {children}
                </main>
              </div>
            </AcademicYearProvider>
          </SchoolDataProvider>
        </SupabaseAuthProvider>

        <style jsx global>{`
          .school-banner {
            background: linear-gradient(135deg, #1a365d 0%, #2d3748 50%, #1a202c 100%);
            padding: 0.5rem 1.5rem;
            border-bottom: 3px solid #ecc94b;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }

          .school-banner-link {
            display: block;
            color: inherit;
            text-decoration: none;
          }

          .banner-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            max-width: 1400px;
            margin: 0 auto;
            gap: 1rem;
          }

          .banner-left {
            display: flex;
            align-items: center;
            gap: 1rem;
          }

          .school-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            border-radius: 10px;
            padding: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            flex-shrink: 0;
          }

          .school-logo img {
            width: 50px;
            height: 50px;
            object-fit: contain;
            borderRadius: 6px;
          }

          .school-info {
            display: flex;
            flex-direction: column;
          }

          .school-name {
            font-size: 1.4rem;
            font-weight: 700;
            color: white;
            margin: 0;
            line-height: 1.2;
            letter-spacing: 0.5px;
            text-shadow: 0 1px 3px rgba(0,0,0,0.3);
          }

          .school-motto {
            font-size: 0.8rem;
            color: #ecc94b;
            margin: 0;
            font-style: italic;
            letter-spacing: 1px;
          }

          .banner-right {
            display: flex;
            align-items: center;
            gap: 1rem;
          }

          .banner-year {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.3rem 0.8rem;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            color: #ecc94b;
            font-size: 0.85rem;
            font-weight: 500;
            border: 1px solid rgba(236, 201, 75, 0.2);
          }

          @media (max-width: 768px) {
            .school-banner {
              padding: 0.4rem 0.75rem;
            }

            .school-logo img {
              width: 36px;
              height: 36px;
            }

            .school-name {
              font-size: 1rem;
            }

            .school-motto {
              font-size: 0.65rem;
            }

            .banner-year {
              font-size: 0.7rem;
              padding: 0.2rem 0.6rem;
            }

            .banner-right {
              display: none;
            }
          }

          @media (max-width: 480px) {
            .school-logo img {
              width: 30px;
              height: 30px;
            }

            .school-name {
              font-size: 0.85rem;
            }

            .school-motto {
              font-size: 0.55rem;
            }
          }
        `}</style>
      </body>
    </html>
  );
}