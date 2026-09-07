"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSchoolData } from "../../../context/SchoolDataContext";

export default function PrintReportCardPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
      <PrintReportCard />
    </Suspense>
  );
}

function PrintReportCard() {
  const searchParams = useSearchParams();
  const { classes, academicYears } = useSchoolData();
  
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [classInfo, setClassInfo] = useState<any>(null);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  useEffect(() => {
    const classIndex = parseInt(searchParams?.get('classIndex') || '-1');
    const streamIndex = parseInt(searchParams?.get('streamIndex') || '-1');
    const studentId = searchParams?.get('studentId');
    const assessmentId = searchParams?.get('assessmentId');

    if (classIndex >= 0 && streamIndex >= 0 && studentId) {
      const cls = classes[classIndex];
      if (cls) {
        setClassInfo(cls);
        const stream = cls.streams[streamIndex];
        if (stream) {
          setStreamInfo(stream);
          const stu = stream.students.find((s: any) => s.id === studentId);
          if (stu) {
            setStudent(stu);
            // Filter assessments by year/term if needed
            let clsAssessments = cls.assessments || [];
            if (assessmentId) {
              clsAssessments = clsAssessments.filter((a: any) => a.id === assessmentId);
              setSelectedAssessmentId(assessmentId);
            }
            setAssessments(clsAssessments);
          }
        }
      }
    }
    setLoading(false);
  }, [searchParams, classes]);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!student || !classInfo || !streamInfo) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Student not found</h2>
        <p>Please check the URL parameters and try again.</p>
      </div>
    );
  }

  // Get year and term info for each assessment
  const getAssessmentYearTerm = (assessment: any) => {
    if (!assessment.academicYearId || !Array.isArray(academicYears)) {
      return { year: '—', term: '—' };
    }
    const year = academicYears.find((y: any) => y.id === assessment.academicYearId);
    if (!year) return { year: '—', term: '—' };
    const term = year.terms?.find((t: any) => t.id === assessment.termId);
    return {
      year: year.name || '—',
      term: term?.name || '—'
    };
  };

  // Calculate averages
  const validScores = assessments
    .map((a) => {
      const score = a.scores?.[student.id];
      if (score === null || score === undefined) return null;
      const pct = a.maxScore ? (score / a.maxScore) * 100 : score;
      return { score, max: a.maxScore, pct };
    })
    .filter((s) => s !== null);

  const avgPercent = validScores.length 
    ? validScores.reduce((sum, s) => sum + (s?.pct || 0), 0) / validScores.length 
    : null;

  function gradeFromPercent(p: number | null) {
    if (p === null) return '—';
    if (p >= 90) return 'A';
    if (p >= 80) return 'B';
    if (p >= 70) return 'C';
    if (p >= 60) return 'D';
    return 'F';
  }

  return (
    <div style={{ 
      padding: '2rem', 
      maxWidth: '900px', 
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* School Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #333', paddingBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>BSSS - School Management System</h1>
        <p style={{ margin: '0.25rem 0', color: '#666' }}>
          {classInfo.name} • Stream {streamInfo.name}
        </p>
        <p style={{ margin: '0.25rem 0', color: '#666' }}>
          Report Card • {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Student Info */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '0.5rem 2rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: '#f9fafb',
        borderRadius: '8px'
      }}>
        <div><strong>Name:</strong> {student.firstName} {student.secondName}</div>
        <div><strong>Student ID:</strong> {student.studentID}</div>
        <div><strong>Gender:</strong> {student.gender}</div>
        <div><strong>Average:</strong> {avgPercent !== null ? `${avgPercent.toFixed(1)}%` : '—'}</div>
        <div><strong>Grade:</strong> {avgPercent !== null ? gradeFromPercent(avgPercent) : '—'}</div>
        <div><strong>Optional Subjects:</strong> {student.optionalSubjects?.join(', ') || 'None'}</div>
      </div>

      {/* Assessments Table */}
      {assessments.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#666' }}>No assessments available.</p>
      ) : (
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          marginTop: '1rem'
        }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #d1d5db' }}>Assessment</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>Score</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>Max</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>Percent</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>Year</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>Term</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((a) => {
              const score = a.scores?.[student.id];
              const pct = score === null || score === undefined 
                ? null 
                : (a.maxScore ? (score / a.maxScore) * 100 : score);
              const { year, term } = getAssessmentYearTerm(a);
              
              return (
                <tr key={a.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem', border: '1px solid #d1d5db' }}>{a.name}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>
                    {score !== null && score !== undefined ? score : '—'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>
                    {a.maxScore || '—'}
                  </td>
                  <td style={{ 
                    padding: '0.75rem', 
                    textAlign: 'center', 
                    border: '1px solid #d1d5db',
                    fontWeight: '600',
                    color: pct !== null && pct >= 70 ? '#16a34a' : pct !== null && pct >= 50 ? '#f59e0b' : '#ef4444'
                  }}>
                    {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>{year}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>{term}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f9fafb', fontWeight: 'bold' }}>
              <td style={{ padding: '0.75rem', border: '1px solid #d1d5db' }}>Summary</td>
              <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>
                {validScores.filter(s => s?.score !== null && s?.score !== undefined).length} / {assessments.length}
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>-</td>
              <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db', color: '#16a34a' }}>
                {avgPercent !== null ? `${avgPercent.toFixed(1)}%` : '—'}
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>-</td>
              <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #d1d5db' }}>-</td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* Print Button */}
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '0.6rem 2rem',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          🖨️ Print Report Card
        </button>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          body > div, body > div * {
            visibility: visible;
          }
          body > div {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 1rem;
          }
          .no-print {
            display: none !important;
          }
          button {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>
    </div>
  );
}