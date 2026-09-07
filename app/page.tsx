"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useSchoolData } from "./context/SchoolDataContext";
import { useAuth } from "./context/SupabaseAuthContext"
// import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AcademicYearSelector from "./components/AcademicYearSelector";

function HomeContent() {
  const { classes, teachers, catalog, academicYears, currentAcademicYearId, currentTermId } = useSchoolData();
  const { isAdmin, isTeacher } = useAuth();

  // Get current year and term names
  const currentYear = academicYears.find(y => y.id === currentAcademicYearId);
  const currentTerm = currentYear?.terms.find(t => t.id === currentTermId);

  // Calculate statistics - filtered by current academic year and term
  const stats = useMemo(() => {
    // Filter assessments by current year and term
    const currentAssessments = classes.flatMap(cls =>
      (cls.assessments || []).filter(a =>
        a.academicYearId === currentAcademicYearId &&
        a.termId === currentTermId
      )
    );

    const totalStudents = classes.reduce((acc, cls) =>
      acc + cls.streams.reduce((streamAcc, stream) =>
        streamAcc + (stream.students?.length || 0), 0), 0
    );

    const totalClasses = classes.length;
    const totalStreams = classes.reduce((acc, cls) => acc + cls.streams.length, 0);
    const totalTeachers = teachers.length;
    const totalAssessments = currentAssessments.length;

    const oLevelClasses = classes.filter(c => c.level === "O").length;
    const aLevelClasses = classes.filter(c => c.level === "A").length;

    const maleStudents = classes.reduce((acc, cls) =>
      acc + cls.streams.reduce((streamAcc, stream) =>
        streamAcc + (stream.students?.filter(s => s.gender === "Male").length || 0), 0), 0
    );
    const femaleStudents = classes.reduce((acc, cls) =>
      acc + cls.streams.reduce((streamAcc, stream) =>
        streamAcc + (stream.students?.filter(s => s.gender === "Female").length || 0), 0), 0
    );

    const totalSubjects = new Set(
      classes.flatMap(c => c.streams.flatMap(s => s.subjects.map(sub =>
        typeof sub === 'string' ? sub : sub.name
      )))
    ).size;

    const compulsorySubjects = Object.values(catalog).filter(c => c === "compulsory").length;
    const optionalSubjects = Object.values(catalog).filter(c => c === "optional").length;

    // Calculate assessment stats for current year/term
    const assessmentsWithScores = currentAssessments.filter(a =>
      Object.values(a.scores).some(s => typeof s === 'number')
    ).length;

    const totalPossibleScores = currentAssessments.reduce((acc, a) =>
      acc + Object.keys(a.scores).length, 0
    );
    const totalFilledScores = currentAssessments.reduce((acc, a) =>
      acc + Object.values(a.scores).filter(s => typeof s === 'number').length, 0
    );
    const completionRate = totalPossibleScores > 0
      ? Math.round((totalFilledScores / totalPossibleScores) * 100)
      : 0;

    return {
      totalStudents,
      totalClasses,
      totalStreams,
      totalTeachers,
      totalAssessments,
      oLevelClasses,
      aLevelClasses,
      maleStudents,
      femaleStudents,
      totalSubjects,
      compulsorySubjects,
      optionalSubjects,
      assessmentsWithScores,
      completionRate,
      currentAssessmentsCount: currentAssessments.length,
    };
  }, [classes, teachers, catalog, currentAcademicYearId, currentTermId]);

  // Class distribution data - show only classes with students
  const classDistribution = useMemo(() => {
    return classes.map(cls => ({
      name: cls.name,
      level: cls.level,
      streams: cls.streams.length,
      students: cls.streams.reduce((acc, stream) => acc + (stream.students?.length || 0), 0),
      assessments: (cls.assessments || []).filter(a =>
        a.academicYearId === currentAcademicYearId &&
        a.termId === currentTermId
      ).length,
    }));
  }, [classes, currentAcademicYearId, currentTermId]);

  // Get recent assessments
  const recentAssessments = useMemo(() => {
    return classes.flatMap(cls =>
      (cls.assessments || [])
        .filter(a =>
          a.academicYearId === currentAcademicYearId &&
          a.termId === currentTermId
        )
        .map(a => ({
          ...a,
          className: cls.name,
        }))
    ).slice(0, 5);
  }, [classes, currentAcademicYearId, currentTermId]);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Academic Dashboard</h1>
          <p className="header-subtitle">
            Welcome back! Here's an overview of your school's academic performance and key metrics.
          </p>
        </div>
        <div className="header-date">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      {/* Academic Year & Term Selector */}
      <div style={{ marginBottom: '1.5rem' }}>
        <AcademicYearSelector />
      </div>

      {/* Current Year/Term Banner */}
      {currentYear && currentTerm && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(37, 99, 235, 0.02))',
          border: '1px solid rgba(37, 99, 235, 0.15)',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontWeight: '600', color: '#1d4ed8' }}>
            📅 Currently Viewing:
          </span>
          <span style={{ fontWeight: '500' }}>
            {currentYear.name} • {currentTerm.name}
          </span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            ({currentYear.startDate} → {currentYear.endDate})
          </span>
          <span style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            background: currentTerm.isActive ? '#dbeafe' : '#f3f4f6',
            color: currentTerm.isActive ? '#1d4ed8' : '#6b7280'
          }}>
            {currentTerm.isActive ? 'Active Term' : 'Inactive'}
          </span>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-blue">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <p className="stat-label">Total Students</p>
            <h3 className="stat-number">{stats.totalStudents}</h3>
            <p className="stat-detail">
              {stats.maleStudents} Male • {stats.femaleStudents} Female
            </p>
          </div>
        </div>

        <div className="stat-card stat-green">
          <div className="stat-icon">🏫</div>
          <div className="stat-content">
            <p className="stat-label">Classes</p>
            <h3 className="stat-number">{stats.totalClasses}</h3>
            <p className="stat-detail">
              {stats.oLevelClasses} O-Level • {stats.aLevelClasses} A-Level
            </p>
          </div>
        </div>

        <div className="stat-card stat-orange">
          <div className="stat-icon">📚</div>
          <div className="stat-content">
            <p className="stat-label">Streams</p>
            <h3 className="stat-number">{stats.totalStreams}</h3>
            <p className="stat-detail">
              Across all classes
            </p>
          </div>
        </div>

        <div className="stat-card stat-purple">
          <div className="stat-icon">👨‍🏫</div>
          <div className="stat-content">
            <p className="stat-label">Teachers</p>
            <h3 className="stat-number">{stats.totalTeachers}</h3>
            <p className="stat-detail">
              Active faculty members
            </p>
          </div>
        </div>

        <div className="stat-card stat-blue">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <p className="stat-label">Assessments ({currentYear?.name || 'Current Year'})</p>
            <h3 className="stat-number">{stats.currentAssessmentsCount}</h3>
            <p className="stat-detail">
              {stats.assessmentsWithScores} with scores • {stats.completionRate}% complete
            </p>
          </div>
        </div>

        <div className="stat-card stat-green">
          <div className="stat-icon">📖</div>
          <div className="stat-content">
            <p className="stat-label">Subjects</p>
            <h3 className="stat-number">{stats.totalSubjects}</h3>
            <p className="stat-detail">
              {stats.compulsorySubjects} Compulsory • {stats.optionalSubjects} Optional
            </p>
          </div>
        </div>
      </div>

      {/* Teacher Dashboard Link - Non-Admin Teachers Only */}
      {isTeacher && !isAdmin && (
        <div style={{ marginTop: '2rem' }}>
          <div className="section-header">
            <div>
              <h2>Your Dashboard</h2>
              <p className="section-subtitle">Access your classes and subjects</p>
            </div>
          </div>
          <div className="actions-grid">
            <Link href="/teacher-dashboard" className="action-card action-card-primary">
              <div className="action-icon">👨‍🏫</div>
              <h3>Go to Teacher Dashboard</h3>
              <p>View your assigned classes, manage subjects, and enter student marks.</p>
              <div className="action-arrow">→</div>
            </Link>
          </div>
        </div>
      )}

      {/* Management Tools - Admin Only */}
      {isAdmin && (
        <div style={{ marginTop: '2rem' }}>
          <div className="section-header">
            <div>
              <h2>Management Tools</h2>
              <p className="section-subtitle">Quick actions for daily tasks</p>
            </div>
          </div>
          <div className="actions-grid">
            <Link href="/class-management/assessments" className="action-card action-card-accent">
              <div className="action-icon">📝</div>
              <h3>Assessments</h3>
              <p>Manage assignments and enter scores.</p>
              <div className="action-arrow">→</div>
            </Link>

            <Link href="/reports-and-analytics/report-builder" className="action-card action-card-tertiary">
              <div className="action-icon">📄</div>
              <h3>Report Builder</h3>
              <p>Generate and print report cards.</p>
              <div className="action-arrow">→</div>
            </Link>

            <Link href="/attendance-tracking" className="action-card action-card-success">
              <div className="action-icon">📅</div>
              <h3>Attendance</h3>
              <p>Track daily student attendance.</p>
              <div className="action-arrow">→</div>
            </Link>

            <Link href="/student-management" className="action-card action-card-secondary">
              <div className="action-icon">👥</div>
              <h3>Students</h3>
              <p>View and manage student records.</p>
              <div className="action-arrow">→</div>
            </Link>
          </div>
        </div>
      )}

      {/* Insights Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        {/* Class Insights */}
        <div className="card">
          <div className="section-header">
            <div>
              <h2>Class Distribution</h2>
              <p className="section-subtitle">Overview by level and enrollment</p>
            </div>
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            {classDistribution.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {classDistribution.map((cls) => (
                  <div
                    key={cls.name}
                    style={{
                      padding: '1rem',
                      background: 'var(--background)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <strong style={{ color: 'var(--primary)' }}>{cls.name}</strong>
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '0.2rem 0.6rem',
                          background: cls.level === 'O' ? 'rgba(52, 152, 219, 0.1)' : 'rgba(155, 89, 182, 0.1)',
                          color: cls.level === 'O' ? '#3498DB' : '#9B59B6',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          {cls.level}-Level
                        </span>
                        {cls.assessments > 0 && (
                          <span style={{
                            marginLeft: '0.5rem',
                            padding: '0.2rem 0.6rem',
                            background: 'rgba(39, 174, 96, 0.1)',
                            color: '#27AE60',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            {cls.assessments} assessments
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {cls.students}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          students
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {cls.streams} stream{cls.streams !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                No classes configured yet
              </p>
            )}
          </div>
        </div>

        {/* Recent Assessments */}
        <div className="card">
          <div className="section-header">
            <div>
              <h2>Recent Assessments</h2>
              <p className="section-subtitle">
                {currentYear?.name} • {currentTerm?.name}
              </p>
            </div>
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            {recentAssessments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentAssessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'var(--background)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {assessment.name}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {assessment.className} • {assessment.date || 'No date set'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {assessment.maxScore && (
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          background: 'rgba(37, 99, 235, 0.1)',
                          color: '#2563eb',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          Max: {assessment.maxScore}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                No assessments for {currentYear?.name || 'current year'}
              </p>
            )}
            {recentAssessments.length > 0 && (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <Link
                  href="/class-management/assessments"
                  style={{
                    color: '#2563eb',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 500
                  }}
                >
                  View All Assessments →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      {isAdmin && (
        <div className="quick-actions">
          <div className="section-header">
            <div>
              <h2>Quick Access</h2>
              <p className="section-subtitle">Navigate to key sections of the system</p>
            </div>
          </div>
          <div className="actions-grid">
            <Link href="/class-management" className="action-card action-card-primary">
              <div className="action-icon">📚</div>
              <h3>Class Management</h3>
              <p>Manage classes, streams, and subjects. Configure academic structure and assignments.</p>
              <div className="action-arrow">→</div>
            </Link>

            <Link href="/student-management" className="action-card action-card-secondary">
              <div className="action-icon">👥</div>
              <h3>Student Management</h3>
              <p>Add, edit, and manage student records. Import students and track enrollment.</p>
              <div className="action-arrow">→</div>
            </Link>

            <Link href="/class-management/assessments" className="action-card action-card-accent">
              <div className="action-icon">📝</div>
              <h3>Assessments</h3>
              <p>Create and manage assessments. Enter scores and track student performance.</p>
              <div className="action-arrow">→</div>
            </Link>

            <Link href="/reports-and-analytics/marksheets" className="action-card action-card-tertiary">
              <div className="action-icon">📊</div>
              <h3>Marksheets & Lists</h3>
              <p>Generate class lists and marksheets for all students. Export to CSV or print.</p>
              <div className="action-arrow">→</div>
            </Link>

            <Link href="/reports-and-analytics/report-builder" className="action-card action-card-info">
              <div className="action-icon">📄</div>
              <h3>Report Cards</h3>
              <p>Generate and print individual student report cards with grades and comments.</p>
              <div className="action-arrow">→</div>
            </Link>

            <Link href="/subjects" className="action-card action-card-info">
              <div className="action-icon">📖</div>
              <h3>Subject Catalog</h3>
              <p>Manage subject catalog, set categories, and assign teachers to subjects.</p>
              <div className="action-arrow">→</div>
            </Link>

            <Link href="/attendance-tracking" className="action-card action-card-success">
              <div className="action-icon">📅</div>
              <h3>Attendance Tracking</h3>
              <p>Track student attendance and monitor participation across classes.</p>
              <div className="action-arrow">→</div>
            </Link>

            <Link href="/settings" className="action-card action-card-primary">
              <div className="action-icon">⚙️</div>
              <h3>Settings</h3>
              <p>Configure system settings, manage teachers, and customize preferences.</p>
              <div className="action-arrow">→</div>
            </Link>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="info-banner">
        <div className="banner-icon">💡</div>
        <div>
          <h3>Welcome to Your Academic Dashboard</h3>
          <p>
            This dashboard provides a comprehensive overview of your school's academic data.
            Use the academic year selector above to switch between different years and terms.
            All statistics and assessments are filtered based on your selection. Use the quick
            links to navigate to different sections.
          </p>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Currently viewing: <strong>{currentYear?.name || 'No year selected'}</strong> •
            <strong> {currentTerm?.name || 'No term selected'}</strong>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 1.5rem;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-radius: 12px;
          color: white;
        }

        .header-content h1 {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          color: #f1f5f9;
        }

        .header-subtitle {
          margin: 0;
          opacity: 0.9;
          font-size: 1rem;
        }

        .header-date {
          font-size: 0.9rem;
          opacity: 0.9;
          
          padding: 0.5rem 1rem;
          border-radius: 8px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: transform 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .stat-icon {
          font-size: 2rem;
        }

        .stat-content {
          flex: 1;
        }

        .stat-label {
          margin: 0;
          font-size: 0.85rem;
          color: #6b7280;
        }

        .stat-number {
          margin: 0.25rem 0;
          font-size: 1.75rem;
          font-weight: 700;
        }

        .stat-detail {
          margin: 0;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .stat-blue .stat-number { color: #2563eb; }
        .stat-green .stat-number { color: #059669; }
        .stat-orange .stat-number { color: #d97706; }
        .stat-purple .stat-number { color: #7c3aed; }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .section-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .section-subtitle {
          margin: 0.25rem 0 0 0;
          color: #6b7280;
          font-size: 0.95rem;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .action-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
          position: relative;
          display: block;
        }

        .action-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .action-icon {
          font-size: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .action-card h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
        }

        .action-card p {
          margin: 0;
          color: #6b7280;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .action-arrow {
          position: absolute;
          right: 1.5rem;
          top: 1.5rem;
          font-size: 1.25rem;
          color: #6b7280;
          transition: transform 0.2s;
        }

        .action-card:hover .action-arrow {
          transform: translateX(4px);
        }

        .action-card-primary { border-left: 4px solid #2563eb; }
        .action-card-secondary { border-left: 4px solid #7c3aed; }
        .action-card-accent { border-left: 4px solid #f59e0b; }
        .action-card-tertiary { border-left: 4px solid #059669; }
        .action-card-success { border-left: 4px solid #10b981; }
        .action-card-info { border-left: 4px solid #06b6d4; }

    .info-banner {
        display: flex;
        align-items: flex-start;
        gap: 1.5rem;
        padding: 1.75rem 2rem;

  border-radius: 12px;
  border: 1px solid #334155;
  margin-top: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;
}

.info-banner::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  
  border-radius: 50%;
  pointer-events: none;
}

.info-banner::after {
  content: '';
  position: absolute;
  bottom: -50%;
  left: -10%;
  width: 200px;
  height: 200px;
  
  border-radius: 50%;
  pointer-events: none;
}

.banner-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.5rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.info-banner > div {
  flex: 1;
  position: relative;
  z-index: 1;
}

.info-banner h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: -0.025em;
}

.info-banner p {
  margin: 0 0 0.75rem 0;
  color: #ffff;
  line-height: 1.7;
  font-size: 0.95rem;
}

.info-banner .banner-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.info-banner .banner-meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #94a3b8;
  
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.info-banner .banner-meta strong {
  color: #e2e8f0;
  font-weight: 600;
}

/* Hover effect */
.info-banner:hover {
  border-color: rgba(183, 215, 245, 0.3);
  box-shadow: 0 4px 12px -1px rgba(224, 240, 6, 0.89), 0 2px 6px -1px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

/* Glow accent line at top */
.info-banner .accent-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #3b82f6, #facc15, #3b82f6);
  background-size: 300% 100%;
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 0% 0%;
  }
  50% {
    background-position: 100% 0%;
  }
  100% {
    background-position: 0% 0%;
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .info-banner {
    flex-direction: column;
    padding: 1.25rem 1.25rem;
  }

  .banner-icon {
    font-size: 2rem;
    align-self: flex-start;
  }

  .info-banner h3 {
    font-size: 1.1rem;
  }

  .info-banner p {
    font-size: 0.9rem;
  }

  .info-banner .banner-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}

        .card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            gap: 1rem;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .actions-grid {
            grid-template-columns: 1fr;
          }

          .header-date {
            align-self: flex-start;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <HomeContent />
    </ProtectedRoute>
  );
}