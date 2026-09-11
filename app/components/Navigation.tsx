"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {useAuth} from "../context/SupabaseAuthContext"
// import { useAuth } from "../context/AuthContext";
import { useSchoolData } from "../context/SchoolDataContext";
import AcademicYearSelector from "./AcademicYearSelector";
import LogoutButton from "./LogoutButton";


// Simple Icons
const Icons = {
  Home: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
  Academic: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>,
  Attendance: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
  Analytics: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>,
  Admin: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
  Search: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  ChevronDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>,
};

export default function Navigation() {
  const { isAuthenticated, currentUser, isAdmin } = useAuth();
  const { classes, isSaving, syncError, hasUnsavedChanges, saveChanges } = useSchoolData();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarLoading, setSidebarLoading] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("has-sidebar", isAuthenticated && isAdmin);

    return () => {
      document.body.classList.remove("has-sidebar");
    };
  }, [isAuthenticated]);
  
  const hideNavigation = pathname.includes("/pdf")
    || pathname.includes("/print")
    || pathname === "/reports-and-analytics/report-builder-alevel/pdf"
    || pathname === "/reports-and-analytics/report-builder-alevel/print";

  // --- State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    studentID: string;
    firstName: string;
    secondName: string;
    className: string;
    streamName: string;
  }>>([]);
  
  // Determine Active Primary Tab
  const activeTab = useMemo(() => {
    if (!isAuthenticated) return "Public";
    if (pathname === "/" || pathname === "/teacher-dashboard") return "Overview";
    if (pathname.startsWith("/class-management") || pathname.startsWith("/student-management") || pathname.startsWith("/subjects") || pathname === "/academic-years") return "Academic";
    if (pathname.startsWith("/attendance-tracking")) return "Attendance";
    if (pathname.startsWith("/reports-and-analytics")) return "Analytics";
    if (pathname.startsWith("/settings")) return "Admin";
    return "Overview";
  }, [pathname, isAuthenticated]);

  // Class Switcher Logic
  const currentClassName = searchParams.get("class");
  const effectiveClassName = currentClassName || (classes && classes.length > 0 ? classes[0].name : "");

  // Search Logic
  useMemo(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const results: typeof searchResults = [];
    
    classes.forEach(cls => {
      cls.streams.forEach(stream => {
        stream.students.forEach(student => {
          const matchesName = 
            student.firstName.toLowerCase().includes(query) ||
            student.secondName.toLowerCase().includes(query) ||
            student.studentID.toLowerCase().includes(query);
          
          if (matchesName) {
            results.push({
              studentID: student.studentID,
              firstName: student.firstName,
              secondName: student.secondName,
              className: cls.name,
              streamName: stream.name
            });
          }
        });
      });
    });
    
    setSearchResults(results.slice(0, 10));
  }, [searchQuery, classes]);

  const handleClassSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClassName = e.target.value;
    setSidebarLoading(true);
    
    setTimeout(() => {
      setSidebarLoading(false);
      
      let base = pathname;
      if (!base.includes('class-management') && !base.includes('student-management')) {
        base = '/class-management';
      }
      
      const params = new URLSearchParams(searchParams.toString());
      params.set("class", newClassName);
      params.delete("stream");
      
      router.push(`${base}?${params.toString()}`);
    }, 300);
  };

  if (hideNavigation) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Navigation Bar */}
      <nav className="main-nav">
        <div className="nav-container">
          {/* Left: Navigation Links */}
          <div className="nav-left">
            <button 
              className="mobile-menu-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? '✕' : '☰'}
            </button>
            
            <div className="nav-links">
              {currentUser?.role === 'teacher' ? (
                <Link href="/teacher-dashboard" className={`nav-link ${pathname === '/teacher-dashboard' ? 'active' : ''}`}>
                  <Icons.Home /> Dashboard
                </Link>
              ) : (
                <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
                  <Icons.Home /> Overview
                </Link>
              )}
              {isAdmin && (
                <>
                  <Link href="/class-management" className={`nav-link ${activeTab === 'Academic' ? 'active' : ''}`}>
                    <Icons.Academic /> Academic
                  </Link>
                  <Link href="/attendance-tracking" className={`nav-link ${activeTab === 'Attendance' ? 'active' : ''}`}>
                    <Icons.Attendance /> Attendance
                  </Link>
                  <Link href="/reports-and-analytics" className={`nav-link ${activeTab === 'Analytics' ? 'active' : ''}`}>
                    <Icons.Analytics /> Analytics
                  </Link>
                  <Link href="/settings" className={`nav-link ${activeTab === 'Admin' ? 'active' : ''}`}>
                    <Icons.Admin /> Admin
                  </Link>
                  <Link href="/academic-years" className={`nav-link ${pathname === '/academic-years' ? 'active' : ''}`}>
                    📅 Years
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="nav-right">
            {/* Academic Year Selector */}
            <div className="nav-item nav-year-selector">
              <AcademicYearSelector compact showLabels={false} />
            </div>

            {/* Save Button */}
            <div className="nav-item save-wrapper">
              {isSaving ? (
                <div className="save-status">
                  <span className="save-spinner"></span>
                  Saving...
                </div>
              ) : syncError ? (
                <div className="save-status error" title={syncError}>
                  ⚠️ Error
                </div>
              ) : (
                <button 
                  className={`save-btn ${hasUnsavedChanges ? 'active' : ''}`}
                  onClick={() => hasUnsavedChanges && saveChanges()}
                  disabled={isSaving || !hasUnsavedChanges}
                >
                  {hasUnsavedChanges ? '💾 Save' : '✅ Saved'}
                </button>
              )}
            </div>

            {/* Search */}
            <div className="nav-item search-wrapper">
              <div className="search-box">
                <Icons.Search />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                />
                {searchQuery && (
                  <div className="search-results">
                    {searchResults.length > 0 ? (
                      searchResults.map((result, idx) => (
                        <div
                          key={idx}
                          className="search-result"
                          onClick={() => {
                            router.push(`/student-management?class=${encodeURIComponent(result.className)}&search=${encodeURIComponent(result.studentID)}`);
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                        >
                          <div className="search-result-name">
                            <strong>{result.firstName} {result.secondName}</strong>
                            <span className="search-result-id">{result.studentID}</span>
                          </div>
                          <div className="search-result-meta">
                            {result.className} - {result.streamName}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="search-result empty">No students found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Logout */}
            <div className="nav-item">
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <aside className={`context-sidebar ${!isAdmin ? 'teacher-sidebar-hidden' : ''}`}>
        {activeTab === 'Academic' && (
          <>
            <div className="sidebar-header">
              <span className="header-label">Academic Manager</span>
              <div className="class-selector-wrapper">
                <select 
                  className="class-selector" 
                  value={effectiveClassName}
                  onChange={handleClassSwitch}
                >
                  {classes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <div className="selector-icon"><Icons.ChevronDown /></div>
              </div>
            </div>

            {isSidebarLoading ? (
              <div className="sidebar-skeleton">
                <div className="skeleton-line" style={{ width: '80%' }}></div>
                <div className="skeleton-line" style={{ width: '60%' }}></div>
                <div className="skeleton-line" style={{ width: '70%' }}></div>
              </div>
            ) : (
              <div className="sidebar-menu">
                <div className="menu-group">
                  <span className="group-title">Class {effectiveClassName}</span>
                  <Link href={`/class-management?class=${encodeURIComponent(effectiveClassName)}`} className={`menu-item ${pathname === '/class-management' ? 'active' : ''}`}>
                    <span className="dot blue"></span> Overview & Subjects
                  </Link>
                  <Link href={`/student-management?class=${encodeURIComponent(effectiveClassName)}`} className={`menu-item ${pathname === '/student-management' ? 'active' : ''}`}>
                    <span className="dot green"></span> Students
                  </Link>
                  <Link href={`/class-management/assessments?class=${encodeURIComponent(effectiveClassName)}`} className={`menu-item ${pathname.includes('assessments') ? 'active' : ''}`}>
                    <span className="dot amber"></span> Assessments
                  </Link>
                  <Link href={`/class-management/consolidated-marksheet?class=${encodeURIComponent(effectiveClassName)}`} className={`menu-item ${pathname.includes('consolidated-marksheet') ? 'active' : ''}`}>
                    <span className="dot purple"></span> Consolidated Marksheet
                  </Link>
                </div>

                <div className="menu-group">
                  <span className="group-title">Global</span>
                  <Link href="/subjects" className={`menu-item ${pathname === '/subjects' ? 'active' : ''}`}>
                    Subject Catalog
                  </Link>
                  <Link href="/academic-years" className={`menu-item ${pathname === '/academic-years' ? 'active' : ''}`}>
                    📅 Academic Years
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'Analytics' && (
          <>
            <div className="sidebar-header">
              <span className="header-label">Report Builder</span>
            </div>
            <div className="sidebar-menu">
              <Link href="/reports-and-analytics" className={`menu-item ${pathname === '/reports-and-analytics' ? 'active' : ''}`}>Dashboard</Link>
              <Link href="/reports-and-analytics/report-builder" className={`menu-item ${pathname === '/reports-and-analytics/report-builder' ? 'active' : ''}`}>O-Level Report Cards</Link>
              <Link href="/reports-and-analytics/report-builder-alevel" className={`menu-item ${pathname === '/reports-and-analytics/report-builder-alevel' ? 'active' : ''}`}>A-Level Report Cards</Link>
              <Link href="#" className="menu-item">Export Center</Link>
            </div>
          </>
        )}

        {activeTab === 'Overview' && (
          <>
            <div className="sidebar-header">
              <span className="header-label">Dashboard</span>
            </div>
            <div className="sidebar-menu">
              <Link href="/" className="menu-item active">Home</Link>
              <Link href="#" className="menu-item">Calendar</Link>
              <Link href="#" className="menu-item">Messages</Link>
              <Link href="#" className="menu-item">My Tasks</Link>
            </div>
          </>
        )}
        
        {/* Fallback for other tabs */}
        {(activeTab === 'Admin' || activeTab === 'Attendance') && (
           <div className="sidebar-menu" style={{ marginTop: '1rem' }}>
             <Link href={pathname} className="menu-item active">{activeTab}</Link>
           </div>
        )}
      </aside>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="mobile-menu">
          {currentUser?.role === 'teacher' ? (
            <Link href="/teacher-dashboard" className="mobile-link" onClick={() => setIsMobileMenuOpen(false)}>
              <Icons.Home /> Dashboard
            </Link>
          ) : (
            <Link href="/" className="mobile-link" onClick={() => setIsMobileMenuOpen(false)}>
              <Icons.Home /> Overview
            </Link>
          )}
          {isAdmin && (
            <>
              <Link href="/class-management" className="mobile-link" onClick={() => setIsMobileMenuOpen(false)}>
                <Icons.Academic /> Academic
              </Link>
              <Link href="/attendance-tracking" className="mobile-link" onClick={() => setIsMobileMenuOpen(false)}>
                <Icons.Attendance /> Attendance
              </Link>
              <Link href="/reports-and-analytics" className="mobile-link" onClick={() => setIsMobileMenuOpen(false)}>
                <Icons.Analytics /> Analytics
              </Link>
              <Link href="/settings" className="mobile-link" onClick={() => setIsMobileMenuOpen(false)}>
                <Icons.Admin /> Admin
              </Link>
              <Link href="/academic-years" className="mobile-link" onClick={() => setIsMobileMenuOpen(false)}>
                📅 Academic Years
              </Link>
            </>
          )}
          <div className="mobile-divider"></div>
          <div className="mobile-controls">
            <AcademicYearSelector compact />
          </div>
        </div>
      )}

      <style jsx>{`
        /* --- Navigation Bar --- */
        .main-nav {
          background: white;
          border-bottom: 1px solid #e5e7eb;
          padding: 0.4rem 1.5rem;
          position: sticky;
          top: var(--banner-height);
          z-index: 99;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .nav-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1400px;
          margin: 0 auto;
          gap: 0.5rem;
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1 1 auto;
        }

        .mobile-menu-toggle {
          display: none;
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0.25rem;
          color: #374151;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          flex-wrap: wrap;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.35rem 0.7rem;
          border-radius: 6px;
          color: #6b7280;
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 500;
          white-space: nowrap;
          transition: all 0.15s;
        }

        .nav-link:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .nav-link.active {
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 600;
        }

        .nav-link svg {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .nav-item {
          display: flex;
          align-items: center;
        }

        .save-wrapper {
          display: flex;
          align-items: center;
        }

        .save-btn {
          padding: 0.25rem 0.6rem;
          border: none;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: not-allowed;
          background: #e5e7eb;
          color: #9ca3af;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .save-btn.active {
          background: #f59e0b;
          color: white;
          cursor: pointer;
        }

        .save-btn.active:hover {
          background: #d97706;
        }

        .save-status {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .save-status.error {
          color: #ef4444;
        }

        .save-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid #e5e7eb;
          border-top-color: #f59e0b;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .search-wrapper {
          position: relative;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.2rem 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: #f9fafb;
          min-width: 140px;
        }

        .search-box input {
          border: none;
          background: transparent;
          outline: none;
          font-size: 0.8rem;
          width: 100%;
          min-width: 60px;
          color: #111827;
        }

        .search-box input::placeholder {
          color: #9ca3af;
        }

        .search-results {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          left: 0;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          max-height: 250px;
          overflow-y: auto;
          z-index: 200;
          min-width: 250px;
        }

        .search-result {
          padding: 0.4rem 0.6rem;
          cursor: pointer;
          border-bottom: 1px solid #f3f4f6;
        }

        .search-result:hover {
          background: #f9fafb;
        }

        .search-result.empty {
          cursor: default;
          color: #9ca3af;
          text-align: center;
          padding: 0.75rem;
        }

        .search-result-name {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          font-size: 0.85rem;
        }

        .search-result-id {
          color: #9ca3af;
          font-size: 0.75rem;
        }

        .search-result-meta {
          font-size: 0.7rem;
          color: #9ca3af;
        }

        /* --- Sidebar --- */
        .context-sidebar {
          position: fixed;
          top: 60px; /* Height of nav bar */
          left: 0;
          bottom: 0;
          width: 260px;
          background: white;
          border-right: 1px solid #e5e7eb;
          padding: 1rem;
          overflow-y: auto;
          z-index: 50;
          box-shadow: 2px 0 8px rgba(0,0,0,0.05);
        }

        .teacher-sidebar-hidden {
          display: none;
        }

        .sidebar-header {
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .header-label {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #9ca3af;
          letter-spacing: 0.05em;
          display: block;
          margin-bottom: 0.5rem;
        }

        .class-selector-wrapper {
          position: relative;
        }

        .class-selector {
          width: 100%;
          padding: 0.4rem 2rem 0.4rem 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: white;
          font-size: 0.9rem;
          appearance: none;
          cursor: pointer;
          color: #111827;
        }

        .selector-icon {
          position: absolute;
          right: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #9ca3af;
        }

        .sidebar-skeleton {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .skeleton-line {
          height: 12px;
          background: #f3f4f6;
          border-radius: 4px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .sidebar-menu {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .menu-group {
          margin-bottom: 0.75rem;
        }

        .group-title {
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #9ca3af;
          letter-spacing: 0.05em;
          padding: 0.5rem 0.5rem 0.25rem;
          display: block;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.75rem;
          border-radius: 6px;
          color: #6b7280;
          text-decoration: none;
          font-size: 0.85rem;
          transition: all 0.15s;
        }

        .menu-item:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .menu-item.active {
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 500;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .dot.blue { background: #3b82f6; }
        .dot.green { background: #22c55e; }
        .dot.amber { background: #f59e0b; }
        .dot.purple { background: #8b5cf6; }

        /* --- Mobile Menu --- */
        .mobile-menu {
          display: none;
          position: fixed;
          top: 60px;
          left: 0;
          right: 0;
          bottom: 0;
          background: white;
          z-index: 98;
          padding: 1rem;
          overflow-y: auto;
          border-top: 1px solid #e5e7eb;
        }

        .mobile-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          borderRadius: 8px;
          color: #374151;
          text-decoration: none;
          font-size: 1rem;
          font-weight: 500;
        }

        .mobile-link:hover {
          background: #f3f4f6;
        }

        .mobile-divider {
          margin: 0.5rem 0;
          border-top: 1px solid #e5e7eb;
        }

        .mobile-controls {
          padding: 0.5rem 0;
        }

        /* --- Responsive --- */
        @media (min-width: 769px) {
          .mobile-menu {
            display: none !important;
          }
        }

        @media (max-width: 1024px) {
          .main-nav {
            padding: 0.4rem 0.75rem;
          }

          .nav-link {
            font-size: 0.75rem;
            padding: 0.25rem 0.5rem;
          }

          .search-box {
            min-width: 100px;
          }

          .search-box input {
            min-width: 40px;
          }

          .context-sidebar {
            width: 220px;
          }
        }

        @media (max-width: 768px) {
          .mobile-menu-toggle {
            display: flex !important;
          }

          .nav-links {
            display: none;
          }

          .mobile-menu {
            display: block;
          }

          .context-sidebar {
            display: none;
          }

          .nav-year-selector,
          .search-wrapper {
            display: none;
          }

          .search-box {
            min-width: 80px;
          }

          .search-box input {
            min-width: 30px;
            font-size: 0.7rem;
          }

          .save-btn {
            font-size: 0.65rem;
            padding: 0.2rem 0.4rem;
          }

          .save-wrapper {
            display: none;
          }

          .search-results {
            min-width: 180px;
            right: -20px;
            left: auto;
          }
        }

        @media (max-width: 480px) {
          .main-nav {
            padding: 0.25rem 0.5rem;
          }

          .search-box {
            min-width: 60px;
            padding: 0.15rem 0.3rem;
          }

          .search-box input {
            min-width: 20px;
            font-size: 0.65rem;
          }

          .nav-right {
            gap: 0.25rem;
          }
        }
      `}</style>
    </>
  );
}