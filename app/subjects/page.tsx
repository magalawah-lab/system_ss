"use client";

import React, { useMemo, useState } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import { useSchoolData } from "../context/SchoolDataContext";
import { COMPULSORY_OLEVEL_SUBJECTS } from "../context/olevelSubjects";
import { ALEVEL_SUBSIDIARY_SUBJECTS } from "../context/alevelConfig";
import ContextMenu from "../components/ContextMenu";
import IconTrash from "../components/IconTrash";

// A-Level subject options.
// Students take exactly 5 subjects: 3 principal + 2 subsidiary.
// Subsidiary = General Paper (compulsory) + one choice of
// Subsidiary Mathematics OR Subsidiary Computer.
const ALEVEL_PRINCIPAL_SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Economics",
  "Accounting",
  "Literature in English",
  "Divinity",
  "Entrepreneurship Education",
  "Agriculture",
  "Luganda",
  "Fine Art",
];

// Other/Additional subjects (for both levels)
const ADDITIONAL_SUBJECTS = [
  "Agriculture",
  "Entrepreneurship",
  "Luganda",
  "Fine Art",
  "Kiswahili",
  "Physical Education",
  "CRE",
  "Literature",
  "Religious Education",
];

export default function SubjectsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <SubjectsPageContent />
    </ProtectedRoute>
  );
}

function SubjectsPageContent() {
  const { 
    classes, 
    addSubjectToStream, 
    addSubjectToAllStreams, 
    removeSubjectFromStream, 
    teachers, 
    addTeacher, 
    updateSubjectInStream
  } = useSchoolData();

  const [selectedClassIndex, setSelectedClassIndex] = useState(0);
  const [selectedStreamName, setSelectedStreamName] = useState<string>(classes[0]?.streams[0]?.name ?? "");
  const [newSubject, setNewSubject] = useState("");
  const [showAutoAddModal, setShowAutoAddModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newSubjectCategory, setNewSubjectCategory] = useState<"compulsory" | "optional">("optional");
  const [teachersList, setTeachersList] = useState([] as any[]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherInitials, setNewTeacherInitials] = useState("");
  const [newTeacherPassword, setNewTeacherPassword] = useState("");
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTeacherId, setEditTeacherId] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // New state for A-Level papers
  const [paperNames, setPaperNames] = useState<string[]>([]);
  const [numPapers, setNumPapers] = useState(0);

  React.useEffect(() => { 
    setTeachersList(teachers || []); 
    if (!selectedTeacherId && (teachers || []).length) setSelectedTeacherId(teachers[0].id); 
  }, [teachers]);

  const currentClass = classes[selectedClassIndex];
  const currentStream = currentClass?.streams.find((s) => s.name === selectedStreamName) ?? currentClass?.streams[0] ?? null;

  // Clear messages after 5 seconds
  React.useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  React.useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // ensure selectedStreamName stays valid when switching class
  function onSelectClass(index: number) {
    setSelectedClassIndex(index);
    const stream = classes[index]?.streams[0]?.name ?? "";
    setSelectedStreamName(stream);
    setNumPapers(0);
    setPaperNames([]);
  }

  function handleNumPapersChange(val: number) {
    const n = Math.max(0, Math.min(6, val));
    setNumPapers(n);
    setPaperNames(Array.from({ length: n }, (_, i) => `P${i + 1}`));
  }

  async function addSubjectToSelectedStream() {
    if (!currentClass || !selectedStreamName) return;
    if (!selectedTeacherId) {
      setErrorMessage('Please select or create a teacher for this subject');
      return;
    }

    const normalizedName = newSubject.trim();
    if (!normalizedName) {
      setErrorMessage('Please select a subject');
      return;
    }

    if (currentClass.level === 'A') {
      const existingNames = (currentStream?.subjects ?? []).map((sub: any) => typeof sub === 'string' ? sub : sub.name);
      const subjectAlreadyExists = existingNames.some((name) => name.toLowerCase() === normalizedName.toLowerCase());
      if (subjectAlreadyExists) {
        setErrorMessage(`${normalizedName} is already assigned to this A-Level stream.`);
        return;
      }
    }
    
    try {
      setIsUpdating(true);
      const finalPapers = currentClass.level === 'A' && paperNames.length > 0 ? paperNames : undefined;
      
      await addSubjectToStream(
        selectedClassIndex, 
        selectedStreamName, 
        normalizedName, 
        selectedTeacherId, 
        undefined, 
        newSubjectCategory,
        finalPapers
      );
      
      setNewSubject("");
      setNumPapers(0);
      setPaperNames([]);
      setSuccessMessage(`Subject "${normalizedName}" added successfully as ${newSubjectCategory}!`);
      setShowAddSubjectModal(false);
    } catch (error) {
      setErrorMessage(`Failed to add subject: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  }

  async function createNewTeacher() {
    if (!newTeacherName.trim()) {
      setErrorMessage('Teacher name is required');
      return;
    }
    try {
      const id = await addTeacher({
        name: newTeacherName.trim(),
        email: newTeacherEmail.trim() || undefined,
        initials: newTeacherInitials.trim() || undefined,
        password: newTeacherPassword.trim() || undefined
      });
      if (editingIndex !== null && currentStream) {
        updateSubjectInStream(selectedClassIndex, currentStream.name, editingIndex, { teacherId: id });
        setEditingIndex(null);
      } else {
        setSelectedTeacherId(id);
      }
      setNewTeacherName(''); setNewTeacherEmail(''); setNewTeacherInitials(''); setNewTeacherPassword('');
      setShowAddTeacherModal(false);
      setSuccessMessage('Teacher added successfully!');
    } catch (error) {
      setErrorMessage(`Failed to add teacher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function removeSubject(idx: number) {
    if (!currentClass || !currentStream) return;
    const subj = currentStream.subjects[idx];
    const name = subj ? (typeof subj === 'string' ? subj : subj.name) : '';
    if (!confirm(`Remove subject ${name} from ${currentClass.name} — ${currentStream.name}?`)) return;
    
    try {
      setIsUpdating(true);
      await removeSubjectFromStream(selectedClassIndex, currentStream.name, idx);
      setSuccessMessage(`Subject "${name}" removed successfully!`);
    } catch (error) {
      setErrorMessage(`Failed to remove subject: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  }

  function addToAll() {
    addSubjectToAllStreams(newSubject, selectedTeacherId || undefined, undefined, newSubjectCategory);
    setNewSubject("");
  }

  function autoAddCompulsoryToOLevel() {
    classes.forEach((cls, classIndex) => {
      if (cls.level !== "O") return;
      cls.streams.forEach((stream) => {
        COMPULSORY_OLEVEL_SUBJECTS.forEach((subject) => {
          addSubjectToStream(classIndex, stream.name, subject, undefined, undefined, "compulsory");
        });
      });
    });
    setShowAutoAddModal(false);
    setSuccessMessage('Compulsory O\'Level subjects added to all streams!');
  }

  function startEditSubject(i: number) {
    if (!currentStream) return;
    const subj: any = currentStream.subjects[i];
    const tId = typeof subj === 'string' ? '' : (subj.teacherId ?? '');
    setEditingIndex(i);
    setEditTeacherId(tId);
  }

  async function saveEditSubject() {
    if (editingIndex === null || !currentStream) return;
    try {
      setIsUpdating(true);
      await updateSubjectInStream(selectedClassIndex, currentStream.name, editingIndex, { teacherId: editTeacherId || undefined });
      setEditingIndex(null);
      setEditTeacherId('');
      setSuccessMessage('Subject teacher updated successfully!');
    } catch (error) {
      setErrorMessage(`Failed to update teacher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleTeacherChange(e: React.ChangeEvent<HTMLSelectElement>, subjectIndex: number) {
    const teacherId = e.target.value || undefined;
    try {
      setIsUpdating(true);
      await updateSubjectInStream(selectedClassIndex, currentStream!.name, subjectIndex, { teacherId });
      setSuccessMessage('Teacher assigned successfully!');
    } catch (error) {
      setErrorMessage(`Failed to assign teacher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleCategoryChange(subjectIndex: number, newCategory: 'compulsory' | 'optional') {
    if (!currentStream) return;
    const subj = currentStream.subjects[subjectIndex];
    const name = typeof subj === 'string' ? subj : subj.name;
    
    try {
      setIsUpdating(true);
      await updateSubjectInStream(selectedClassIndex, currentStream.name, subjectIndex, { category: newCategory });
      setSuccessMessage(`Subject "${name}" set as ${newCategory}`);
    } catch (error) {
      setErrorMessage(`Failed to update category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  }

  const allSubjects = useMemo(() => Array.from(new Set(classes.flatMap((c) => c.streams.flatMap((s) => s.subjects.map((sub: any) => typeof sub === 'string' ? sub : sub.name))))), [classes]);

  return (
    <div className="subjects-page">
      <h1>Subjects</h1>
      <p className="muted">Manage subjects per stream. Each subject's category (compulsory/optional) is set per class.</p>

      {/* Messages */}
      {errorMessage && (
        <div className="message error" role="alert">
          <span className="message-icon">❌</span>
          {errorMessage}
          <button className="message-close" onClick={() => setErrorMessage(null)}>×</button>
        </div>
      )}
      
      {successMessage && (
        <div className="message success" role="alert">
          <span className="message-icon">✅</span>
          {successMessage}
          <button className="message-close" onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}

      <div className="grid">
        <aside className="sidebar">
          <h3>Classes</h3>
          <select value={selectedClassIndex} onChange={(e) => onSelectClass(Number(e.target.value))}>
            {classes.map((c, i) => (
              <option key={c.name} value={i}>{c.name} — {c.level}</option>
            ))}
          </select>
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
            <p>💡 Subjects are categorized per class. A subject can be compulsory in one class and optional in another.</p>
          </div>
        </aside>

        <section className="main">
          <div className="class-header">
            <h2>{currentClass?.name}</h2>
            <div className="streams">
              <select value={selectedStreamName} onChange={(e) => setSelectedStreamName(e.target.value)}>
                {(currentClass?.streams ?? []).map((st) => <option key={st.name} value={st.name}>{st.name}</option>)}
              </select>
            </div> 
          </div>

          <div className="header-actions">
            <button className="primary" onClick={() => setShowAddSubjectModal(true)} disabled={isUpdating}>
              {isUpdating ? 'Processing...' : 'Add Subject'}
            </button>
            <button className="secondary" onClick={() => setShowAutoAddModal(true)}>Auto-Add Compulsory to O'Level</button>
          </div>

          <div className="subjects-table">
            <h4>{currentStream?.name} — Subjects ({currentClass?.level} Level)</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Teacher</th>
                  <th>Teacher Initials</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentStream?.subjects.map((s: any, i) => {
                  const subjName = typeof s === 'string' ? s : s.name;
                  const teacherId = typeof s === 'string' ? '' : (s.teacherId ?? '');
                  const category = typeof s === 'string' ? 'optional' : (s.category || 'optional');
                  const teacher = teacherId ? teachers.find((t: any) => t.id === teacherId) : undefined;
                  return (
                    <tr key={subjName + i}>
                      <td className="col-subject">{subjName}</td>
                      <td className="col-category">
                        <select 
                          value={category} 
                          onChange={(e) => handleCategoryChange(i, e.target.value as 'compulsory' | 'optional')}
                          aria-label={`Category for ${subjName}`}
                          disabled={isUpdating}
                          style={{
                            padding: '0.3rem 0.5rem',
                            borderRadius: '4px',
                            border: `2px solid ${category === 'compulsory' ? '#f59e0b' : '#8b5cf6'}`,
                            background: category === 'compulsory' ? '#fef3c7' : '#f3f0ff',
                            color: category === 'compulsory' ? '#92400e' : '#5b21b6',
                            fontWeight: '600'
                          }}
                        >
                          <option value="compulsory" style={{ background: '#fef3c7', color: '#92400e' }}>
                            📌 Compulsory
                          </option>
                          <option value="optional" style={{ background: '#f3f0ff', color: '#5b21b6' }}>
                            ○ Optional
                          </option>
                        </select>
                      </td>
                      <td className="col-teacher">
                        <select 
                          value={teacherId} 
                          onChange={(e) => handleTeacherChange(e, i)}
                          disabled={isUpdating}
                        >
                          <option value="">-- none --</option>
                          {teachersList.map((t: any) => <option key={t.id} value={t.id}>{t.name}{t.initials ? ` (${t.initials})` : ''}</option>)}
                        </select>
                        <button className="secondary" onClick={() => { setEditingIndex(i); setShowAddTeacherModal(true); }} disabled={isUpdating}>+ Add</button>
                      </td>
                      <td className="col-initials">
                        {teacher?.initials || '—'}
                      </td>
                      <td className="col-actions">
                        <ContextMenu items={[{ label: 'Remove', action: () => removeSubject(i), danger: true, icon: (<IconTrash size={14} />) }]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showAddSubjectModal && (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-subject-title" onClick={() => setShowAddSubjectModal(false)}>
              <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
                <h3 id="add-subject-title">Add Subject to {currentClass?.name}</h3>
                
                <div className="subject-selection">
                  <label>Subject</label>
                  <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)} required>
                    <option value="">-- Select a subject --</option>
                    
                    {currentClass?.level === 'O' ? (
                      <>
                        <optgroup label="Compulsory O'Level Subjects">
                          {COMPULSORY_OLEVEL_SUBJECTS.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Optional O'Level Subjects">
                          {ADDITIONAL_SUBJECTS.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </optgroup>
                      </>
                    ) : (
                      <>
                        <optgroup label="Principal Subjects (choose 3)">
                          {ALEVEL_PRINCIPAL_SUBJECTS.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Subsidiary Subjects">
                          {ALEVEL_SUBSIDIARY_SUBJECTS.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Additional Subjects">
                          {ADDITIONAL_SUBJECTS.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </optgroup>
                      </>
                    )}
                    
                    <optgroup label="Custom Subject">
                      <option value="__custom__">+ Enter custom subject</option>
                    </optgroup>
                  </select>
                  
                  {newSubject === '__custom__' && (
                    <input 
                      type="text" 
                      placeholder="Enter subject name" 
                      onChange={(e) => setNewSubject(e.target.value)}
                      style={{ marginTop: '0.5rem', width: '100%' }}
                    />
                  )}
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Category for {currentClass?.name}:
                  </label>
                  <div className="category-select" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      background: newSubjectCategory === 'compulsory' ? '#fef3c7' : 'transparent',
                      border: `2px solid ${newSubjectCategory === 'compulsory' ? '#f59e0b' : '#d1d5db'}`,
                      cursor: 'pointer'
                    }}>
                      <input 
                        type="radio" 
                        name="cat_add" 
                        checked={newSubjectCategory === "compulsory"} 
                        onChange={() => setNewSubjectCategory("compulsory")} 
                      /> 
                      <span>📌 Compulsory</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>(Required for all students)</span>
                    </label>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      background: newSubjectCategory === 'optional' ? '#f3f0ff' : 'transparent',
                      border: `2px solid ${newSubjectCategory === 'optional' ? '#8b5cf6' : '#d1d5db'}`,
                      cursor: 'pointer'
                    }}>
                      <input 
                        type="radio" 
                        name="cat_add" 
                        checked={newSubjectCategory === "optional"} 
                        onChange={() => setNewSubjectCategory("optional")} 
                      /> 
                      <span>○ Optional</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>(Students can choose)</span>
                    </label>
                  </div>
                </div>

                <label>
                  Teacher
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} style={{ flex: 1 }}>
                      <option value="">-- none --</option>
                      {teachersList.map((t: any) => <option key={t.id} value={t.id}>{t.name}{t.initials ? ` (${t.initials})` : ''}</option>)}
                    </select>
                    <button className="secondary" onClick={() => setShowAddTeacherModal(true)}>+ Add teacher</button>
                  </div>
                </label>

                {currentClass?.level === 'A' && (
                  <div className="alevel-papers-config" style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>A-Level Paper Configuration</h4>
                    <label>
                      Number of Papers
                      <input 
                        type="number" 
                        min="0" 
                        max="6" 
                        value={numPapers} 
                        onChange={(e) => handleNumPapersChange(parseInt(e.target.value) || 0)}
                        style={{ width: '100%', marginBottom: '0.5rem' }}
                      />
                    </label>
                    
                    {numPapers > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                        {paperNames.map((name, idx) => (
                          <div key={idx}>
                            <label style={{ fontSize: '0.8rem', marginBottom: '2px' }}>Paper {idx + 1}</label>
                            <input 
                              value={name} 
                              onChange={(e) => {
                                const newNames = [...paperNames];
                                newNames[idx] = e.target.value;
                                setPaperNames(newNames);
                              }}
                              placeholder={`e.g. P${idx + 1}`}
                              style={{ width: '100%', padding: '0.35rem', fontSize: '0.85rem' }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="modal-actions">
                  <button className="primary" onClick={addSubjectToSelectedStream} disabled={isUpdating || !newSubject || newSubject === '__custom__'}>
                    {isUpdating ? 'Adding...' : 'Add Subject'}
                  </button>
                  <button onClick={() => setShowAddSubjectModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {showAddTeacherModal && (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-teacher-title" onClick={() => setShowAddTeacherModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3 id="add-teacher-title">Add Teacher</h3>
                <label>
                  Name *
                  <input value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} placeholder="Teacher name" />
                </label>
                <label>
                  Email
                  <input value={newTeacherEmail} onChange={(e) => setNewTeacherEmail(e.target.value)} placeholder="teacher@school.com" />
                </label>
                <label>
                  Initials
                  <input value={newTeacherInitials} onChange={(e) => setNewTeacherInitials(e.target.value)} placeholder="e.g. JD" style={{ width: 120 }} />
                </label>
                <label>
                  Password
                  <input type="password" value={newTeacherPassword} onChange={(e) => setNewTeacherPassword(e.target.value)} placeholder="Default: password123" />
                </label>
                <div className="modal-actions">
                  <button className="primary" onClick={createNewTeacher} disabled={!newTeacherName.trim()}>
                    Add Teacher
                  </button>
                  <button onClick={() => setShowAddTeacherModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {showAutoAddModal && (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auto-add-title" onClick={() => setShowAutoAddModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3 id="auto-add-title">Auto-Add Compulsory Subjects</h3>
                <p style={{ marginBottom: 12 }}>
                  This adds all compulsory O&apos;Level subjects to every O&apos;Level stream and skips subjects that already exist.
                </p>
                <div style={{ marginBottom: 12 }}>
                  <strong>Subjects:</strong> {COMPULSORY_OLEVEL_SUBJECTS.join(", ")}
                </div>
                <div className="modal-actions">
                  <button className="primary" onClick={autoAddCompulsoryToOLevel}>Add to All O&apos;Level Streams</button>
                  <button onClick={() => setShowAutoAddModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div className="section">
            <h4>Subject Overview (Across All Classes)</h4>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Shows how each subject is categorized in different classes
            </p>
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Category by Class</th>
                </tr>
              </thead>
              <tbody>
                {allSubjects.map((sub) => {
                  const classCategories = classes
                    .flatMap((c) => c.streams.map((st) => ({ 
                      className: c.name, 
                      level: c.level, 
                      stream: st,
                      subject: st.subjects.find((s: any) => (typeof s === 'string' ? s : s.name) === sub)
                    })))
                    .filter((x) => x.subject)
                    .map((x) => {
                      const subject = x.subject;
                      if (!subject) return null;
                      const category = typeof subject === 'string' ? 'optional' : (subject.category || 'optional');
                      return `${x.className} (${x.level}) → ${category}`;
                    })
                    .filter((category): category is string => category !== null);
                
                  if (classCategories.length === 0) return null;
                  
                  return (
                    <tr key={sub}>
                      <td><strong>{sub}</strong></td>
                      <td>
                        {classCategories.map((cat, i) => (
                          <span key={i}>
                            {cat}
                            {i < classCategories.length - 1 && <span style={{ margin: '0 4px', color: '#d1d5db' }}>|</span>}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style jsx>{`
        .subjects-page { padding: 1rem }
        .muted { color: rgba(0,0,0,0.6) }
        .class-header { display:flex; align-items:center; justify-content:space-between; gap:12px }
        .streams { display:flex; gap:8px }
        .grid { display: grid; grid-template-columns: 240px 1fr; gap: 1rem }
        .sidebar { border-right: 1px solid rgba(0,0,0,0.06); padding-right: 1rem }
        .sidebar select { width: 100%; padding: 0.5rem; border-radius: 6px; border: 1px solid #e5e7eb; }
        .header-actions { display:flex; justify-content:flex-end; margin:12px 0; gap: 8px }
        input { padding:0.45rem; border-radius:6px; border:1px solid #e5e7eb; min-width: 220px }
        .primary { background:#2563eb; color:#fff; border:none; padding:0.45rem 0.7rem; border-radius:6px; cursor:pointer }
        .primary:disabled { opacity: 0.5; cursor: not-allowed }
        .secondary { background:transparent; border:1px solid #e5e7eb; padding:0.35rem 0.6rem; border-radius:6px; cursor:pointer }
        .secondary:disabled { opacity: 0.5; cursor: not-allowed }
        .subjects-table .table { width:100%; border-collapse: collapse }
        .subjects-table th, .subjects-table td { padding:0.5rem; border-bottom:1px solid #f1f5f9; text-align:left }
        .subjects-table thead th { background:#f9fafb; font-weight:600 }
        .col-actions { text-align:right }
        .col-teacher select { min-width: 180px }
        .col-category select { min-width: 160px; cursor: pointer }

        /* Modal */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; z-index: 1000 }
        .modal { background:#fff; padding:1.5rem; border-radius:8px; width:360px; max-width: 90vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(2,6,23,0.15) }
        .modal-wide { width: 480px; max-width: 95vw }
        .modal label { display:block; margin-bottom:0.5rem; font-size:0.95rem }
        .modal input, .modal select { width:100%; padding:0.45rem; margin-top:0.25rem; margin-bottom:0.5rem; border-radius:6px; border:1px solid #e5e7eb }
        .modal-actions { display:flex; gap:0.5rem; justify-content:flex-end; margin-top: 1rem }

        /* Messages */
        .message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 1rem;
          animation: slideIn 0.3s ease;
        }
        .message.error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }
        .message.success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }
        .message-icon { font-size: 1.2rem }
        .message-close {
          margin-left: auto;
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: inherit;
          opacity: 0.6;
          padding: 0 4px;
        }
        .message-close:hover { opacity: 1 }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width:700px) {
          .grid { grid-template-columns: 1fr }
          .sidebar { border-right:none; padding-right:0 }
          .modal-wide { width: 95vw }
          .class-header { flex-direction: column; align-items: stretch }
          .header-actions { flex-wrap: wrap }
          .col-teacher select { min-width: 120px }
        }
      `}</style>
    </div>
  );
}
