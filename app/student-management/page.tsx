"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ContextMenu from "../components/ContextMenu";
import IconTrash from "../components/IconTrash";
import ProtectedRoute from "../components/ProtectedRoute";
import { useIsClassTeacher, useSchoolData } from "../context/SchoolDataContext";
import { useAuth } from "../context/SupabaseAuthContext";
import { ALEVEL_SUBSIDIARY_COMPULSORY, ALEVEL_SUBSIDIARY_CHOICES, ALEVEL_SUBSIDIARY_SUBJECTS } from "../context/alevelConfig";

export default function StudentManagement() {
  return (
    <ProtectedRoute>
      <StudentManagementContent />
    </ProtectedRoute>
  );
}

function StudentManagementContent() {
  const { classes, addStudentToStream, editStudentInStream, removeStudentFromStream, importStudentsToStream, catalog } = useSchoolData();
  const { isAdmin } = useAuth();

  const [level, setLevel] = useState<"O" | "A">('O');
  const classesForLevel = classes.filter((c) => c.level === level);
  const classNameQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('class') : null;
  const streamQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('stream') : null;

  // Initialize level from URL on mount (client only)
  useEffect(() => {
    const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const lvl = sp?.get('level');
    if (lvl === 'A' || lvl === 'O') setLevel(lvl as "O" | "A");
  }, []);

  const [selectedClassIndex, setSelectedClassIndex] = useState(0);
  const [selectedStream, setSelectedStream] = useState("");

  useEffect(() => {
    if (classNameQuery) {
      const decoded = decodeURIComponent(classNameQuery);
      const idx = classesForLevel.findIndex((c) => c.name === decoded);
      if (idx >= 0) setSelectedClassIndex(idx);
    } else {
      setSelectedClassIndex(0);
    }
  }, [classNameQuery, classes, level]);

  useEffect(() => {
    const cls = classesForLevel[selectedClassIndex];
    const streamName = streamQuery ? decodeURIComponent(streamQuery) : cls?.streams[0]?.name;
    setSelectedStream(streamName ?? "");
  }, [streamQuery, classes, level, selectedClassIndex]);

  // Find global class index and check class teacher status
  const globalClassIndex = useMemo(() => {
    const currentClass = classesForLevel[selectedClassIndex];
    if (!currentClass) return -1;
    return classes.findIndex(c => c.name === currentClass.name && c.level === currentClass.level);
  }, [classes, classesForLevel, selectedClassIndex]);

  const isClassTeacherForStream = useIsClassTeacher(globalClassIndex, selectedStream);
  const canEdit = isAdmin || isClassTeacherForStream;

  const currentClass = classesForLevel[selectedClassIndex];
  const currentStream = currentClass?.streams.find((s) => s.name === selectedStream);

  const catalogSubjects = Object.keys(catalog).filter(key => !key.startsWith('O:') && !key.startsWith('A:')).sort();
  const availableOptionalSubjects = (currentStream?.subjects || []).map((sub: any) => sub.name).filter((s) => {
    const levelKey = `${level}:${s}`;
    return catalog[levelKey] === 'optional' || (!catalog[levelKey] && catalog[s] === 'optional');
  });

  // A-Level: the class offers many subjects, but each student picks exactly 5
  // (3 principal + General Paper + one subsidiary choice).
  const streamSubjectNames = (currentStream?.subjects ?? []).map((sub: any) => (typeof sub === 'string' ? sub : sub.name));
  const availablePrincipalSubjects = streamSubjectNames.filter((name) => !ALEVEL_SUBSIDIARY_SUBJECTS.includes(name));
  const availableSubsidiaryChoices = ALEVEL_SUBSIDIARY_CHOICES.filter((name) => streamSubjectNames.includes(name));

  // form state
  const [studentID, setStudentID] = useState("");
  const [firstName, setFirstName] = useState("");
  const [secondName, setSecondName] = useState("");
  const [otherNames, setOtherNames] = useState("");
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [optional1, setOptional1] = useState("");
  const [optional2, setOptional2] = useState("");
  const [aPrincipalSubjects, setAPrincipalSubjects] = useState<string[]>(["", "", ""]);
  const [aSubsidiaryChoice, setASubsidiaryChoice] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  useEffect(() => {
    // clear form when switching stream
    setStudentID("");
    setFirstName("");
    setSecondName("");
    setOtherNames("");
    setGender("Male");
    setOptional1("");
    setOptional2("");
    setAPrincipalSubjects(["", "", ""]);
    setASubsidiaryChoice("");
    setEditIndex(null);
  }, [selectedStream, selectedClassIndex, level]);

  function buildALevelSubjects(): string[] | null {
    const chosenPrincipals = Array.from(new Set(aPrincipalSubjects.filter(Boolean)));
    if (chosenPrincipals.length !== 3) {
      alert('Select 3 distinct principal subjects.');
      return null;
    }
    if (!aSubsidiaryChoice) {
      alert('Select a subsidiary subject (Subsidiary Mathematics or Subsidiary Computer).');
      return null;
    }
    return [...chosenPrincipals, ALEVEL_SUBSIDIARY_COMPULSORY, aSubsidiaryChoice];
  }

  function handleAdd() {
    if (!currentClass || !selectedStream) { alert('Select class and stream'); return; }
    const globalIndex = classes.findIndex((c) => c.name === currentClass.name && c.level === currentClass.level);

    let subjects: string[] | undefined;
    let optionalSubjects: string[] = [optional1, optional2].filter(Boolean);

    if (currentClass.level === 'A') {
      const built = buildALevelSubjects();
      if (!built) return;
      subjects = built;
      optionalSubjects = [];
    }

    addStudentToStream(globalIndex, selectedStream, {
      studentID: studentID.trim(),
      firstName: firstName.trim(),
      secondName: secondName.trim(),
      otherNames: otherNames.trim(),
      gender,
      optionalSubjects,
      subjects,
    });
    // clear
    setStudentID(""); setFirstName(""); setSecondName(""); setOtherNames(""); setOptional1(""); setOptional2("");
    setAPrincipalSubjects(["", "", ""]); setASubsidiaryChoice("");
    alert('Student added');
  }

  function handleEdit() {
    if (editIndex === null || !currentClass) return;
    const globalIndex = classes.findIndex((c) => c.name === currentClass.name && c.level === currentClass.level);

    let subjects: string[] | undefined;
    let optionalSubjects: string[] = [optional1, optional2].filter(Boolean);

    if (currentClass.level === 'A') {
      const built = buildALevelSubjects();
      if (!built) return;
      subjects = built;
      optionalSubjects = [];
    }

    editStudentInStream(globalIndex, selectedStream, editIndex, {
      studentID: studentID.trim(),
      firstName: firstName.trim(),
      secondName: secondName.trim(),
      otherNames: otherNames.trim(),
      gender,
      optionalSubjects,
      subjects,
    });
    setEditIndex(null);
    alert('Student updated');
  }

  function openEdit(idx: number) {
    const stu = currentStream?.students[idx];
    if (!stu) return;
    setStudentID(stu.studentID);
    setFirstName(stu.firstName);
    setSecondName(stu.secondName);
    setOtherNames(stu.otherNames || "");

    if (currentClass?.level === 'A') {
      const principals = (stu.subjects ?? []).filter((s) => !ALEVEL_SUBSIDIARY_SUBJECTS.includes(s));
      const subsidiary = (stu.subjects ?? []).find((s) => ALEVEL_SUBSIDIARY_CHOICES.includes(s));
      setAPrincipalSubjects([principals[0] || "", principals[1] || "", principals[2] || ""]);
      setASubsidiaryChoice(subsidiary || "");
      setOptional1("");
      setOptional2("");
    } else {
      setOptional1(stu.optionalSubjects[0] || "");
      setOptional2(stu.optionalSubjects[1] || "");
    }
    setEditIndex(idx);
  }

  function handleImport(file: File | null) {
    if (!file) return;
    file.text().then((text) => {
      const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
      const header = rows.shift();
      if (!header) { alert('Invalid file'); return; }
      const cols = header.split(',').map(c => c.trim());
      const parsed = rows.map(r => {
        const parts = r.split(',');
        const obj: any = {};
        cols.forEach((c, i) => { obj[c] = (parts[i] || '').trim(); });
        return {
          studentID: obj['StudentID'] || obj['studentID'] || '',
          firstName: obj['First_Name'] || obj['FirstName'] || '',
          secondName: obj['Second_Name'] || obj['SecondName'] || '',
          gender: ((obj['Gender'] || obj['gender'] || '').toLowerCase() === 'female' ? 'Female' : 'Male') as "Male" | "Female",
          otherNames: obj['Other_Names'] || obj['OtherNames'] || '',
          optionalSubjects: [obj['Optional_Subject_1'] || '', obj['Optional_Subject_2'] || ''].filter(Boolean),
        };
      });

      if (!currentClass) { alert('No class selected'); return; }
      const globalIndex = classes.findIndex((c) => c.name === currentClass.name && c.level === currentClass.level);
      importStudentsToStream(globalIndex, selectedStream, parsed);
      alert(`Imported ${parsed.length} students`);
    });
  }

  function handleDelete(index: number) {
    if (!confirm('Remove student?')) return;
    if (!currentClass) return;
    const globalIndex = classes.findIndex((c) => c.name === currentClass.name && c.level === currentClass.level);
    removeStudentFromStream(globalIndex, selectedStream, index);
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Student Management</h1>
      <p>Manage student records, enrollments and CSV imports.</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <div>
          <select value={level} onChange={(e) => {
            const v = e.target.value as "O" | "A";
            setLevel(v);
            setSelectedClassIndex(0);
            const cls = classes.filter((c)=>c.level===v)[0];
            setSelectedStream(cls?.streams[0]?.name ?? "");
          }}>
            <option value="O">O'Level</option>
            <option value="A">A'Level</option>
          </select>
        </div>

        <select value={selectedClassIndex} onChange={(e) => setSelectedClassIndex(Number(e.target.value))}>
          {classesForLevel.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
        </select>

        <select value={selectedStream} onChange={(e) => setSelectedStream(e.target.value)}>
          {currentClass?.streams.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Import CSV
          <input type="file" accept="text/csv" onChange={(e) => handleImport(e.target.files?.[0] ?? null)} />
        </label>

        <a href="/templates/students-template.csv" download>Download template</a>
        <Link href="/class-management" style={{ marginLeft: 8 }}>Back to Classes</Link>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 480px', gap: 16 }}>
        <div>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>StudentID</th>
                <th>First</th>
                <th>Second</th>
                <th>Gender</th>
                <th>Other</th>
                <th>Subjects</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(currentStream?.students ?? []).map((stu, i) => (
                <tr key={stu.id}>
                  <td>{stu.studentID}</td>
                  <td>{stu.firstName}</td>
                  <td>{stu.secondName}</td>
                  <td>{stu.gender}</td>
                  <td>{stu.otherNames}</td>
                  <td>
                    <button className="view-btn" onClick={() => setViewIndex(i)}>View Details</button>
                  </td>
                  <td>
                    <ContextMenu items={[
                      ...(canEdit ? [
                        { label: 'Edit', action: () => openEdit(i), icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 21v-3.75L14.06 6.19l3.75 3.75L6.75 21H3z" stroke="#000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>) },
                        { label: 'Delete', action: () => handleDelete(i), danger: true, icon: (<IconTrash size={14} />) }
                      ] : [])
                    ]} />
                  </td> 
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="student-form">
          <h3>{editIndex === null ? 'Add Student' : 'Edit Student'}</h3>

          <div className="form-grid">
            <div className="form-row"><label htmlFor="student-id">Student ID</label><input id="student-id" value={studentID} onChange={(e) => setStudentID(e.target.value)} /></div>
            <div className="form-row"><label htmlFor="first-name">First name</label><input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div className="form-row"><label htmlFor="second-name">Second name</label><input id="second-name" value={secondName} onChange={(e) => setSecondName(e.target.value)} /></div>
            <div className="form-row"><label htmlFor="other-names">Other names</label><input id="other-names" value={otherNames} onChange={(e) => setOtherNames(e.target.value)} /></div>
            <div className="form-row"><label htmlFor="gender">Gender</label>
              <select id="gender" value={gender} onChange={(e) => setGender(e.target.value as "Male" | "Female") }>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {level === 'A' ? (
              <>
                {aPrincipalSubjects.map((val, i) => (
                  <div className="form-row" key={`principal-${i}`}>
                    <label htmlFor={`principal-${i}`}>Principal Subject {i + 1}</label>
                    <select
                      id={`principal-${i}`}
                      value={val}
                      onChange={(e) => {
                        const next = [...aPrincipalSubjects];
                        next[i] = e.target.value;
                        setAPrincipalSubjects(next);
                      }}
                    >
                      <option value="">—</option>
                      {availablePrincipalSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}

                <div className="form-row">
                  <label>General Paper</label>
                  <input value={ALEVEL_SUBSIDIARY_COMPULSORY} disabled title="General Paper is compulsory" />
                </div>

                <div className="form-row">
                  <label htmlFor="subsidiary-choice">Subsidiary Choice</label>
                  <select id="subsidiary-choice" value={aSubsidiaryChoice} onChange={(e) => setASubsidiaryChoice(e.target.value)}>
                    <option value="">—</option>
                    {availableSubsidiaryChoices.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="form-row"><label htmlFor="optional-1">Optional Subject 1</label>
                  <select id="optional-1" value={optional1} onChange={(e) => setOptional1(e.target.value)}>
                    <option value="">—</option>
                    {availableOptionalSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="form-row"><label htmlFor="optional-2">Optional Subject 2</label>
                  <select id="optional-2" value={optional2} onChange={(e) => setOptional2(e.target.value)}>
                    <option value="">—</option>
                    {availableOptionalSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="form-actions">
            {editIndex === null ? (
              <button className="primary" onClick={handleAdd} disabled={!canEdit}>Add Student</button>
            ) : (
              <>
                <button className="primary" onClick={handleEdit} disabled={!canEdit}>Save</button>
                <button onClick={() => { setEditIndex(null); setStudentID(''); setFirstName(''); setSecondName(''); setOtherNames(''); setOptional1(''); setOptional2(''); setAPrincipalSubjects(["", "", ""]); setASubsidiaryChoice(""); }}>Cancel</button>
              </>
            )}
          </div>

          {viewIndex !== null && currentStream && currentStream.students[viewIndex] && (
            <div className="modal-backdrop">
              <div className="modal">
                <h3>Student Details</h3>
                <div className="detail-row">
                  <strong>Name:</strong> {currentStream.students[viewIndex].firstName} {currentStream.students[viewIndex].secondName} {currentStream.students[viewIndex].otherNames}
                </div>
                <div className="detail-row">
                  <strong>Student ID:</strong> {currentStream.students[viewIndex].studentID}
                </div>
                <div className="detail-row">
                  <strong>Gender:</strong> {currentStream.students[viewIndex].gender}
                </div>
                <hr style={{ margin: '12px 0', border: 0, borderTop: '1px solid #eee' }} />
                <div className="detail-row">
                  <strong>Optional Subjects:</strong>
                  <p style={{ margin: '4px 0', color: '#555' }}>
                    {currentStream.students[viewIndex].optionalSubjects.length > 0 
                      ? currentStream.students[viewIndex].optionalSubjects.join(', ') 
                      : 'None selected'}
                  </p>
                </div>
                <div className="detail-row">
                  <strong>All Enrolled Subjects:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {currentStream.students[viewIndex].subjects.map((s, si) => (
                      <span key={si} className="subject-tag">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="modal-actions">
                  <button onClick={() => setViewIndex(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          <style jsx>{`
            .student-form { padding: 16px; border: 1px solid #eee; border-radius: 8px; background: #fff; box-shadow: 0 6px 18px rgba(2,6,23,0.04) }
            .student-form h3 { margin: 0 0 12px 0; font-size: 1.05rem }
            .form-grid { display: grid; grid-template-columns: 140px 1fr; gap: 8px 12px; align-items: center }
            .form-row label { font-size: 0.95rem; color: rgba(0,0,0,0.7); padding-right: 12px; text-align: right; font-weight:600 }
            .form-row input, .form-row select { width: 100%; padding: 0.45rem; border-radius: 6px; border: 1px solid #e5e7eb }
            .form-row input:focus, .form-row select:focus { outline: 2px solid rgba(37,99,235,0.15); border-color: #2563eb }
            .form-actions { margin-top: 12px; display:flex; gap:8px }
            .view-btn { background: none; border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; color: #444; }
            .view-btn:hover { background: #f5f5f5; border-color: #ccc; }
            .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
            .modal { background: white; padding: 20px; border-radius: 8px; width: 400px; max-width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
            .modal h3 { margin-top: 0; margin-bottom: 16px; }
            .detail-row { margin-bottom: 12px; font-size: 0.95rem; }
            .subject-tag { background: #f0f9ff; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem; border: 1px solid #bae6fd; }
            .modal-actions { display: flex; justify-content: flex-end; margin-top: 20px; }
            .modal-actions button { padding: 6px 16px; cursor: pointer; background: #eee; border: none; border-radius: 4px; }
            .modal-actions button:hover { background: #ddd; }
            @media (max-width: 700px) { .form-grid { grid-template-columns: 1fr } .form-row label { text-align: left; padding-right:0; margin-bottom:4px } }
          `}</style>
        </div>
      </div>
    </div>
  );
}
