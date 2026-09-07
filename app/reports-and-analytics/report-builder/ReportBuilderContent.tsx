"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Info } from "lucide-react";
import Link from "next/link";
import { useSchoolData } from "../../context/SchoolDataContext";
import AcademicYearSelector from "../../components/AcademicYearSelector";

export default function ReportBuilder() {
  const { classes, teachers, catalog, academicYears, currentAcademicYearId, currentTermId } = useSchoolData();
  const [selectedClassIndex, setSelectedClassIndex] = useState<number | null>(null);
  const [selectedStreamIndex, setSelectedStreamIndex] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [printPromptOpen, setPrintPromptOpen] = useState(false);
  const [printMode, setPrintMode] = useState<"current" | "all">("current");
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reportTitle, setReportTitle] = useState("END OF TERM ASSESSMENT REPORT");
  const classesForLevel = classes;
  const currentClass = selectedClassIndex !== null ? classesForLevel[selectedClassIndex] : undefined;
  const currentStream = currentClass && selectedStreamIndex !== null ? currentClass.streams?.[selectedStreamIndex] : undefined;
  const students = currentStream?.students ?? [];
  const assessments = useMemo(() => {
    return (currentClass?.assessments ?? []).filter((assessment) =>
      assessment.academicYearId === currentAcademicYearId &&
      assessment.termId === currentTermId
    );
  }, [currentClass, currentAcademicYearId, currentTermId]);

  const currentYear = academicYears.find((academicYear) => academicYear.id === currentAcademicYearId);
  const currentTerm = currentYear?.terms.find((academicTerm) => academicTerm.id === currentTermId);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    return students.filter(student =>
      `${student.firstName} ${student.secondName} ${student.studentID}`.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  const canGenerate = selectedStudentId !== "" && currentClass && currentStream;
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Grading functions
  function getGrade(mark: number | null): string {
    if (mark === null || mark === undefined) return "—";
    if (mark >= 80) return "A";
    if (mark >= 60) return "B";
    if (mark >= 40) return "C";
    if (mark >= 20) return "D";
    return "E";
  }

  function getComment(grade: string): string {
    const gradeComments: Record<string, string> = {
      A: "Excellent performance. Outstanding achievement.",
      B: "Good performance. Well done.",
      C: "Satisfactory performance. Keep up the good work.",
      D: "Fair performance. Needs improvement.",
      E: "Poor performance. Requires immediate attention.",
      "—": "",
    };
    return gradeComments[grade] || "";
  }

  function getTeacherInitials(teacherId?: string): string {
    if (!teacherId) return "";
    const teacher = teachers.find((t) => t.id === teacherId);
    return teacher?.initials || "";
  }

  // Find assessments
  const activityAssessments = useMemo(() => {
    return assessments.filter(
      (a) => a.maxScore !== undefined && a.maxScore !== null && a.maxScore >= 0.9 && a.maxScore <= 3
    );
  }, [assessments]);

  const c1Assessment = useMemo(() => activityAssessments[0], [activityAssessments]);
  const c2Assessment = useMemo(() => activityAssessments[1], [activityAssessments]);

  const endOfCycleAssessment = useMemo(() => {
    return assessments.find((a) => a.maxScore !== undefined && a.maxScore !== null && a.maxScore <= 80 && a.maxScore > 3);
  }, [assessments]);

  // Generate report rows for selected student
  const reportRows = useMemo(() => {
    if (!selectedStudentId || !selectedStudent) return [];
    
    return (currentStream?.subjects ?? [])
      .filter((subEntry: any) => {
        const subjectName = typeof subEntry === "string" ? subEntry : subEntry.name;
        // Check if subject is optional from catalog
        const isOptional = catalog?.[subjectName] === "optional";
        
        // If optional, only include if student has this subject
        if (isOptional) {
          return selectedStudent.optionalSubjects.includes(subjectName);
        }
        // If compulsory, always include
        return true;
      })
      .map((subEntry: any) => {
        const subjectName = typeof subEntry === "string" ? subEntry : subEntry.name;
        const teacherId = typeof subEntry === "string" ? undefined : subEntry.teacherId;
        const initials = getTeacherInitials(teacherId);

        const c1Score =
          c1Assessment?.subjectScores?.[subjectName]?.[selectedStudentId] ??
          c1Assessment?.scores?.[selectedStudentId];
        const c2Score =
          c2Assessment?.subjectScores?.[subjectName]?.[selectedStudentId] ??
          c2Assessment?.scores?.[selectedStudentId];
        const endOfCycleScore =
          endOfCycleAssessment?.subjectScores?.[subjectName]?.[selectedStudentId] ??
          endOfCycleAssessment?.scores?.[selectedStudentId];

        // Calculate 20% column
      // Formula: If only C1: (C1/3)*20, If C1 and C2: ((average(C1,C2))/3)*20
      let twentyPercentValue: number | null = null;
      const c1Present = typeof c1Score === "number";
      const c2Present = typeof c2Score === "number";

      if (c1Present && c2Present) {
        // Both C1 and C2: use average
        const average = (c1Score + c2Score) / 2;
        twentyPercentValue = (average / 3) * 20;
      } else if (c1Present) {
        // Only C1: use C1 directly
        twentyPercentValue = (c1Score / 3) * 20;
      } else if (c2Present) {
        // Only C2: use C2 directly
        twentyPercentValue = (c2Score / 3) * 20;
      }

      // End of Cycle column (mapped to 80%)
      const endOfCycleValue =
        typeof endOfCycleScore === "number" ? endOfCycleScore : null;

      let hundredPercentValue: number | null = null;
      if (twentyPercentValue !== null || endOfCycleValue !== null) {
        hundredPercentValue = (twentyPercentValue || 0) + (endOfCycleValue || 0);
      }

      const grade = getGrade(hundredPercentValue);
      const comment = getComment(grade);

      return {
        subject: subjectName,
        c1: typeof c1Score === "number" ? c1Score.toFixed(1) : "",
        c2: typeof c2Score === "number" ? c2Score.toFixed(1) : "",
        twenty:
          twentyPercentValue !== null ? Math.round(twentyPercentValue) : "",
        eighty:
          endOfCycleValue !== null
            ? Math.round(endOfCycleValue)
            : "",
        hundred:
          hundredPercentValue !== null
            ? Math.round(hundredPercentValue)
            : "",
        grade,
        comment,
        initials,
      };
    });
  }, [selectedStudentId, selectedStudent, currentStream?.subjects, c1Assessment, c2Assessment, endOfCycleAssessment, catalog]);

  // Calculate overall performance
  const overallGrades = reportRows
    .map((r) => r.hundred)
    .filter((h) => h !== "")
    .map((h) => typeof h === "string" ? parseInt(h, 10) : h)
    .filter((h): h is number => typeof h === "number");
  const overallPercentage =
    overallGrades.length > 0
      ? overallGrades.reduce((a, b) => a + b, 0) /
        overallGrades.length
      : null;
  const overallGrade = getGrade(overallPercentage);

  const handleGeneratePDF = () => {
    if (!canGenerate) return;
    const params = new URLSearchParams({
      classIndex: String(selectedClassIndex),
      streamIndex: String(selectedStreamIndex),
      studentId: selectedStudentId,
      title: reportTitle,
      academicYearId: currentAcademicYearId,
      termId: currentTermId,
    });
    window.open(`/reports-and-analytics/report-builder/pdf?${params}`, "_blank");

  };

  const handlePrintCurrent = () => {
    setPrintMode("current");
    setPrintPromptOpen(false);
    handleGeneratePDF();
  };

  const handlePrintAll = () => {
    setPrintMode("all");
    setPrintPromptOpen(false);
    const params = new URLSearchParams({
      classIndex: String(selectedClassIndex),
      streamIndex: String(selectedStreamIndex),
      title: reportTitle,
      academicYearId: currentAcademicYearId,
      termId: currentTermId,
      mode: "all",
    });
    window.open(`/reports-and-analytics/report-builder/print?${params}`, "_blank");

  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold">Report Card Builder</h1>
        <button onClick={() => setInfoModalOpen(true)} className="text-gray-400 hover:text-blue-600 transition-colors">
          <Info size={20} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sidebar: Class Selection & Student List */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Class & Stream Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Select Class</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Title</label>
              <input
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., End of Term Report"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic year and term</label>
              <AcademicYearSelector />
              <p className="text-xs text-gray-500 mt-2">
                Using existing assessments for {currentYear?.name || "the selected year"}, {currentTerm?.name || "the selected term"}.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select
                value={selectedClassIndex ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSelectedClassIndex(val);
                  setSelectedStreamIndex(val !== null ? 0 : null);
                  setSelectedStudentId("");
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Class --</option>
                {classesForLevel.map((cls, idx) => (
                  <option key={idx} value={idx}>
                    {cls.name} ({cls.level})
                  </option>
                ))}
              </select>
            </div>


            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stream</label>
              <select
                value={selectedStreamIndex ?? ""}
                onChange={(e) => {
                  setSelectedStreamIndex(e.target.value ? Number(e.target.value) : null);
                  setSelectedStudentId("");
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={selectedClassIndex === null}
              >
                <option value="">-- Select Stream --</option>
                {currentClass?.streams?.map((stream, idx) => (
                  <option key={idx} value={idx}>
                    Stream {stream.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Student List */}
          <div className="bg-white rounded-lg shadow p-6 flex-1 min-h-[400px]">
            {currentClass && currentStream ? (
              <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">
                  Students ({filteredStudents.length})
                </h2>
              </div>
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="space-y-1 max-h-[400px] overflow-y-auto border border-gray-200 rounded p-2">
                {filteredStudents.map((student, idx) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      student.id === selectedStudentId
                        ? "bg-blue-100 text-blue-900 font-semibold"
                        : "hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {idx + 1}. {student.firstName} {student.secondName}
                    </div>
                    <div className="text-xs text-gray-500">{student.studentID}</div>
                  </button>
                ))}
                {filteredStudents.length === 0 && (
                  <div className="text-sm text-gray-500 p-2">No students in this stream</div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => { setPrintPromptOpen(true); }}
                  disabled={!currentStream || students.length === 0}
                  className="w-full px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Print Reports
                </button>
              </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Please select a class and stream to view students.
              </div>
            )}
          </div>
        </div>

        {/* Report Preview */}
        <div className="lg:col-span-9">
          <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
            {!currentStream || filteredStudents.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 p-6 min-h-[600px]">
                <p>Select a class and stream to view student reports</p>
              </div>
            ) : !selectedStudentId ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 p-6 min-h-[600px]">
                <p>Select a student from the list to preview their report</p>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Toolbar */}
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                  <span className="font-bold text-gray-700">Preview: {selectedStudent?.firstName} {selectedStudent?.secondName}</span>
                  <button
                    onClick={handleGeneratePDF}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Open PDF
                  </button>
                </div>

                {/* Simplified Report Preview */}
                <div className="flex-1 overflow-y-auto bg-gray-100 p-8">
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    {/* Student Details */}
                    <div className="mb-6 pb-4 border-b border-gray-200">
                      <h3 className="text-xl font-bold text-gray-800">{selectedStudent?.firstName} {selectedStudent?.secondName}</h3>
                      <p className="text-gray-600">{currentClass?.name} {currentStream?.name}</p>
                      <p className="text-sm text-gray-500">{currentTerm?.name || "Selected term"}, {currentYear?.name || "Selected year"}</p>
                    </div>

                    {/* Overall Performance */}
                    <div className="mb-6 bg-blue-50 p-4 rounded-lg">
                      <h4 className="text-sm font-bold text-blue-800 mb-2">OVERALL PERFORMANCE</h4>
                      <p className="text-2xl font-bold text-blue-900">
                        {overallPercentage !== null
                          ? `${Math.round(overallPercentage)}%`
                          : "N/A"}
                      </p>
                      <p className="text-lg font-semibold text-blue-700">
                        {overallPercentage !== null ? `Grade ${overallGrade}` : "No grades recorded"}
                      </p>
                    </div>

                    {/* Subject Scores Summary */}
                    <h4 className="text-sm font-bold text-gray-700 mb-3">SUBJECT SUMMARY</h4>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b-2 border-gray-200 bg-gray-50">
                          <th className="p-3 text-sm font-semibold text-gray-600">SUBJECT</th>
                          <th className="p-3 text-sm font-semibold text-gray-600 text-center">FINAL SCORE</th>
                          <th className="p-3 text-sm font-semibold text-gray-600 text-center">GRADE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportRows.map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="p-3 font-medium text-gray-800">{row.subject}</td>
                            <td className="p-3 text-center text-gray-700">{row.hundred || "—"}%</td>
                            <td className="p-3 text-center font-bold text-gray-800">{row.grade}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print Prompt */}
      {printPromptOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Print Reports</h3>
            <p className="text-gray-700 mb-6">
              Choose what to print for <strong>{currentClass?.name} {currentStream?.name}</strong>:
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={handlePrintCurrent}
                disabled={!canGenerate}
                className={`w-full px-4 py-3 rounded-md font-medium text-left transition-colors ${
                  canGenerate
                    ? "bg-blue-100 hover:bg-blue-200 text-blue-900 border-2 border-blue-500"
                    : "bg-gray-100 text-gray-500 cursor-not-allowed"
                }`}
              >
                <div className="font-bold">Current Report</div>
                <div className="text-sm">Print report for {selectedStudent?.firstName}</div>
              </button>

              <button
                onClick={handlePrintAll}
                disabled={!currentStream || students.length === 0}
                className={`w-full px-4 py-3 rounded-md font-medium text-left transition-colors ${
                  currentStream && students.length > 0
                    ? "bg-green-100 hover:bg-green-200 text-green-900 border-2 border-green-500"
                    : "bg-gray-100 text-gray-500 cursor-not-allowed"
                }`}
              >
                <div className="font-bold">All Reports</div>
                <div className="text-sm">Print all {students.length} student reports</div>
              </button>
            </div>

            <button
              onClick={() => setPrintPromptOpen(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Report Structure Explained</h3>
            <div className="text-sm text-gray-700 space-y-3">
              <p>The report card is automatically calculated based on the assessments you've entered.</p>
              <ul className="list-disc list-inside space-y-2 bg-gray-50 p-4 rounded-md">
                <li><strong>C1, C2</strong>: These are scores from two separate 'Activity of Integration' tests, each with a maximum score of 3.</li>
                <li><strong>20% Column</strong>: This is a weighted value derived from the C1 and C2 scores. The formula is: `(Average(C1, C2) / 3) * 20`.</li>
                <li><strong>80% Column</strong>: This score comes from the main 'End of Cycle' assessment, which has a maximum score of 80.</li>
                <li><strong>100% Column</strong>: This is the final score for the subject, calculated by adding the <strong>20% Column</strong> and the <strong>80% Column</strong>.</li>
                <li><strong>Grade</strong>: A letter grade (A-E) is assigned based on the 100% score.</li>
                <li><strong>Comments</strong>: A pre-defined comment is added based on the assigned grade.</li>
              </ul>
              <p className="font-semibold">Ensure your assessments are set up with the correct maximum scores for accurate reports.</p>
            </div>
            <div className="mt-6 text-right">
              <button onClick={() => setInfoModalOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <Link href="/reports-and-analytics">
          <button className="px-6 py-2 rounded-md font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors">
            Back to Analytics
          </button>
        </Link>
      </div>
    </div>
  );
}
