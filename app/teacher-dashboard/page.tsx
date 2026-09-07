"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/SupabaseAuthContext";
import { useSchoolData, ClassItem, Assessment } from "../context/SchoolDataContext";
import AcademicYearSelector from "../components/AcademicYearSelector";
import CurrentTermDisplay from "../components/CurrentTermDisplay";

type TeacherClassSubject = {
  classIndex: number;
  className: string;
  level: "O" | "A";
  streamName: string;
  subjectName: string;
  assessments: Assessment[];
};

export default function TeacherDashboard() {
  const { currentUser, logout, isAuthenticated, isTeacher } = useAuth();
  const { classes, teachers, academicYears, currentAcademicYearId, currentTermId, isHydrated } = useSchoolData();
  const router = useRouter();

  // State for batch selection: { "className-streamName": [assessmentId1, assessmentId2] }
  const [selectedAssessments, setSelectedAssessments] = useState<Record<string, string[]>>({});

  // Redirect to login if not authenticated or not a teacher
  React.useEffect(() => {
    if (!isAuthenticated || !isTeacher) {
      router.push("/login");
    }
  }, [isAuthenticated, isTeacher, router]);

  const currentTeacher = currentUser?.role === "teacher" ? currentUser : null;
  const currentYear = academicYears.find((year) => year.id === currentAcademicYearId);
  const currentTerm = currentYear?.terms.find((term) => term.id === currentTermId);

  // ... existing teacherAssignments logic ...

  const handleToggleAssessment = (key: string, assessmentId: string) => {
    setSelectedAssessments((prev) => {
      const current = prev[key] ?? [];
      const next = current.includes(assessmentId)
        ? current.filter((id) => id !== assessmentId)
        : [...current, assessmentId];
      return { ...prev, [key]: next };
    });
  };
  const handleBatchEnter = (key: string, classIndex: number, streamName: string) => {
    const ids = selectedAssessments[key] ?? [];
    if (ids.length === 0) {
      alert("Please select at least one assessment.");
      return;
    }
    const url = `/teacher-dashboard/enter-scores?classIndex=${classIndex}&streamName=${encodeURIComponent(streamName)}&assessmentIds=${ids.join(",")}`;
    router.push(url);
  };

  // Assignments use the administrator-managed teacher ID, while the signed-in
  // user has a Supabase ID. Resolve both from the teacher's email.
  const teacherIds = useMemo(() => {
    if (!currentTeacher) return new Set<string>();

    const ids = new Set([currentTeacher.id]);
    const email = currentTeacher.email.trim().toLowerCase();
    teachers.forEach((teacher) => {
      if (teacher.id === currentTeacher.id || teacher.email?.trim().toLowerCase() === email) {
        ids.add(teacher.id);
      }
    });
    return ids;
  }, [currentTeacher, teachers]);

  // Get all streams where this teacher has a subject or class-teacher assignment.
  const teacherAssignments = useMemo(() => {
    if (teacherIds.size === 0 || !classes) return [];

    const assignments: TeacherClassSubject[] = [];

    classes.forEach((cls, classIndex) => {
      cls.streams.forEach((stream) => {
        const assessments = (cls.assessments ?? []).filter((assessment) =>
          assessment.academicYearId === currentAcademicYearId &&
          assessment.termId === currentTermId
        );
        const isClassTeacher = Boolean(stream.classTeacherId && teacherIds.has(stream.classTeacherId));
        let hasSubjectAssignment = false;

        stream.subjects.forEach((subject) => {
          const subjectName = typeof subject === "string" ? subject : subject.name;
          const teacherId = typeof subject === "string" ? undefined : subject.teacherId;

          if (teacherId && teacherIds.has(teacherId)) {
            hasSubjectAssignment = true;
            assignments.push({
              classIndex,
              className: cls.name,
              level: cls.level,
              streamName: stream.name,
              subjectName,
              assessments,
            });
          }
        });

        // Class teachers are associated with the whole stream even when they
        // do not teach one of its listed subjects.
        if (isClassTeacher && !hasSubjectAssignment) {
          assignments.push({
            classIndex,
            className: cls.name,
            level: cls.level,
            streamName: stream.name,
            subjectName: "Class Teacher",
            assessments,
          });
        }
      });
    });

    return assignments;
  }, [classes, teacherIds, currentAcademicYearId, currentTermId]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Group assignments by class and stream for better display
  const groupedAssignments = useMemo(() => {
    const grouped: Record<string, TeacherClassSubject[]> = {};
    teacherAssignments.forEach((assignment) => {
      const key = `${assignment.className}-${assignment.streamName}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(assignment);
    });
    return grouped;
  }, [teacherAssignments]);

  if (!isAuthenticated || !currentTeacher) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  if (!isHydrated || !currentAcademicYearId || !currentTermId) {
    return (
      <div className="teacher-dashboard-loading">
        <p>Loading your classes and assessments...</p>
      </div>
    );
  }

  return (
    <div className="teacher-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Teacher Dashboard</h1>
          <p className="muted">Welcome back, {currentTeacher.name}. Here's what's happening today.</p>
        </div>
        <div className="quick-actions">
          <button className="btn btn-primary" onClick={() => document.querySelector('.assignments-container')?.scrollIntoView({ behavior: 'smooth' })}>Enter Marks</button>
          <button className="btn btn-secondary" onClick={() => alert('Attendance feature coming soon!')}>Take Attendance</button>
        </div>
      </div>

      <div className="dashboard-period">
        <div>
          <strong>Viewing assessments for</strong>
          <span>{currentYear?.name || "No academic year"} • {currentTerm?.name || "No term"}</span>
        </div>
        <AcademicYearSelector compact />
      </div>

      {/* KPI Cards Placeholder */}
      <div className="dashboard-grid">
        <div className="dashboard-main-content">
          <div className="kpi-grid">
            <div className="card kpi-card">
              <h3>Total Classes</h3>
              <div className="kpi-value" style={{ color: 'var(--primary)' }}>{teacherAssignments.length}</div>
            </div>
            <div className="card kpi-card">
              <h3>Pending Assessments</h3>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>3</div>
              <div className="kpi-trend">Due this week</div>
            </div>
            <div className="card kpi-card">
              <h3>Avg. Attendance</h3>
              <div className="kpi-value" style={{ color: 'var(--secondary)' }}>94%</div>
              <div className="kpi-trend positive">↑ 2% vs last week</div>
            </div>
          </div>

          {teacherAssignments.length === 0 ? (
            <div className="panel" style={{ padding: "2rem", textAlign: "center" }}>
              <h2>No Assignments</h2>
              <p className="muted">
                You don't have any classes or subjects assigned yet. Please contact the administrator.
              </p>
            </div>
          ) : (
            <div className="assignments-container">
              {Object.entries(groupedAssignments).map(([key, assignments]) => {
                const firstAssignment = assignments[0];
                const allAssessments = Array.from(
                  new Set(assignments.flatMap((a) => a.assessments.map((ass) => ass.id)))
                )
                  .map((id) => firstAssignment.assessments.find((a) => a.id === id))
                  .filter((a): a is Assessment => a !== undefined);

                return (
                  <div key={key} className="card class-card">
                    <div className="class-header">
                      <h2>{firstAssignment.className} <span className="stream-badge">{firstAssignment.streamName}</span></h2>
                      <span className={`level-badge ${firstAssignment.level === 'A' ? 'level-a' : ''}`}>{firstAssignment.level === 'O' ? "O'Level" : "A'Level"}</span>
                    </div>

                    <div className="subjects-list">
                      <h4 className="section-title">Your Subjects</h4>
                      <ul className="subject-tags">
                        {assignments.map((assignment, idx) => (
                          <li key={idx} className="subject-tag">
                            {assignment.subjectName}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {allAssessments.length > 0 ? (
                      <div style={{ marginTop: "1.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                          <div>
                            <h4 className="section-title" style={{ marginBottom: 0 }}>Active Assessments</h4>
                            {(selectedAssessments[key]?.length ?? 0) === 0 && (
                              <span style={{ fontSize: "11px", color: "var(--accent)" }}>Select assessments below to batch enter scores</span>
                            )}
                          </div>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={(selectedAssessments[key]?.length ?? 0) === 0}
                            onClick={() => handleBatchEnter(key, firstAssignment.classIndex, firstAssignment.streamName)}
                          >
                            Batch Enter Scores ({(selectedAssessments[key]?.length ?? 0)})
                          </button>
                        </div>
                        <div className="assessments-grid">
                          {allAssessments.map((assessment) => (
                            <div
                              key={assessment.id}
                              className={`assessment-item ${selectedAssessments[key]?.includes(assessment.id) ? 'selected' : ''}`}
                              onClick={() => handleToggleAssessment(key, assessment.id)}
                              style={{ cursor: "pointer" }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <input
                                  type="checkbox"
                                  checked={selectedAssessments[key]?.includes(assessment.id) ?? false}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleAssessment(key, assessment.id);
                                  }}
                                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                                />
                                <div className="assessment-info">
                                  <span className="assessment-name">{assessment.name}</span>
                                  {assessment.date && (
                                    <span className="assessment-date">{assessment.date}</span>
                                  )}
                                </div>
                              </div>
                              <div className="assessment-meta" onClick={(e) => e.stopPropagation()}>
                                {assessment.maxScore && (
                                  <span className="max-score">Max: {assessment.maxScore}</span>
                                )}
                                <Link
                                  href={`/teacher-dashboard/enter-scores?classIndex=${firstAssignment.classIndex}&streamName=${encodeURIComponent(firstAssignment.streamName)}&assessmentId=${assessment.id}`}
                                  className="btn btn-secondary btn-sm"
                                >
                                  Single Entry
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="muted no-assessments-message" style={{ marginTop: "1rem" }}>
                        No assessments have been created for {currentYear?.name || "this academic year"}, {currentTerm?.name || "this term"}.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="sidebar-tools">
          <div className="card">
            <h3 className="section-title">Quick Tools</h3>
            <div className="tool-links">
              <Link href="/reports-and-analytics/report-builder" className="tool-link">
                <span className="tool-icon">📄</span>
                <div className="tool-info">
                  <span className="tool-name">Report Builder</span>
                  <span className="tool-desc">Generate report cards</span>
                </div>
              </Link>
              <Link href="/attendance-tracking" className="tool-link">
                <span className="tool-icon">📅</span>
                <div className="tool-info">
                  <span className="tool-name">Attendance</span>
                  <span className="tool-desc">Track daily attendance</span>
                </div>
              </Link>
              <Link href="/reports-and-analytics/marksheets" className="tool-link">
                <span className="tool-icon">📊</span>
                <div className="tool-info">
                  <span className="tool-name">Marksheets</span>
                  <span className="tool-desc">View & export lists</span>
                </div>
              </Link>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 className="section-title">Academic Info</h3>
            <div className="info-list">
              <div className="info-item"> 
                <span className="info-label">Status</span>     
                <span className="info-value text-success"><CurrentTermDisplay showStatus /></span>
                
              </div>
            </div>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .teacher-dashboard {
          padding: 1rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .teacher-dashboard-loading {
          display: flex;
          min-height: 40vh;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          color: var(--text-muted);
        }
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 2rem;
        }
        
        .dashboard-main-content {
          min-width: 0;
        }

        .dashboard-period {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
          padding: 0.75rem 1rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: white;
        }

        .dashboard-period div {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .dashboard-period span {
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .sidebar-tools {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .tool-links {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .tool-link {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          border-radius: 8px;
          text-decoration: none;
          color: inherit;
          transition: background 0.2s;
          border: 1px solid transparent;
        }

        .tool-link:hover {
          background: var(--background);
          border-color: var(--border);
        }

        .tool-icon {
          font-size: 1.5rem;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 8px;
          box-shadow: var(--shadow-sm);
        }

        .tool-info {
          display: flex;
          flex-direction: column;
        }

        .tool-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-main);
        }

        .tool-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .info-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }

        .info-label {
          color: var(--text-muted);
        }

        .info-value {
          font-weight: 600;
        }

        .text-success { color: #10b981; }

        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
          .sidebar-tools {
            order: -1;
          }
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border);
        }
        .quick-actions { display: flex; gap: 0.75rem; }
        
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2.5rem;
        }
        .kpi-card h3 { font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; font-weight: 600; }
        .kpi-value { font-size: 2.5rem; font-weight: 700; line-height: 1; margin-bottom: 0.25rem; }
        .kpi-trend { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; }
        .kpi-trend.positive { color: var(--secondary); }

        .assignments-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .class-card { margin-bottom: 1rem; border-left: 4px solid var(--primary); }
        .class-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .class-header h2 { margin: 0; font-size: 1.4rem; color: var(--primary); }
        .stream-badge { background: var(--primary-light); color: white; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.9rem; font-weight: 500; }
        .level-badge { background: #EBF5FB; color: var(--primary); padding: 0.2rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .level-badge.level-a { background: #FEF9E7; color: var(--accent); }
        
        .section-title { font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem; font-weight: 700; letter-spacing: 0.05em; }
        
        .subject-tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.75rem; }
        .subject-tag { background: var(--background); color: var(--text-main); padding: 0.5rem 1rem; border-radius: 6px; font-weight: 500; font-size: 0.9rem; border: 1px solid var(--border); }

        .assessments-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }
        .assessment-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: white;
          transition: all 0.2s;
        }
        .assessment-item:hover {
          border-color: var(--primary-light);
          background: #F8FBFE;
        }
        .assessment-item.selected {
          border-color: var(--primary);
          background: #EBF5FB;
          box-shadow: 0 0 0 1px var(--primary);
        }
        .assessment-info { display: flex; flex-direction: column; }
        .assessment-name { font-weight: 600; color: var(--text-main); }
        .assessment-date { font-size: 0.8rem; color: var(--text-muted); }
        .assessment-meta { display: flex; align-items: center; gap: 1rem; }
        .max-score { font-size: 0.85rem; color: var(--text-muted); background: var(--background); padding: 0.2rem 0.5rem; border-radius: 4px; }
        
        .btn-sm {
          padding: 0.3rem 0.8rem;
          font-size: 0.85rem;
        }

        @media (max-width: 640px) {
          .teacher-dashboard {
            padding: 0.75rem;
          }

          .dashboard-header {
            align-items: stretch;
            flex-direction: column;
            gap: 1rem;
            margin-bottom: 1rem;
          }

          .dashboard-header h1 {
            font-size: 1.5rem;
          }

          .quick-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .quick-actions .btn {
            min-height: 44px;
            padding: 0.6rem 0.5rem;
          }

          .dashboard-period {
            align-items: stretch;
            flex-direction: column;
            margin-bottom: 1rem;
          }

          .dashboard-period .academic-year-selector,
          .dashboard-period > div:last-child {
            width: 100%;
          }

          .class-header {
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }

          .class-header h2 {
            width: 100%;
            font-size: 1.15rem;
          }

          .assessments-grid {
            grid-template-columns: 1fr;
          }

          .assessment-item {
            align-items: flex-start;
            flex-direction: column;
            gap: 0.75rem;
            padding: 0.75rem;
          }

          .assessment-meta {
            justify-content: space-between;
            width: 100%;
          }

          .assessment-meta .btn {
            min-height: 40px;
          }
        }
      `}</style>
    </div>
  );
}
