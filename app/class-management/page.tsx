"use client";

export const dynamic = 'force-dynamic';

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DeleteModal from "../components/DeleteModal";
import IconTrash from "../components/IconTrash";
import ContextMenu from "../components/ContextMenu";
import ProtectedRoute from "../components/ProtectedRoute";
import { ALEVEL_SUBJECTS_CONFIG } from "../context/alevelConfig";
import { useSchoolData, Student, Stream, Teacher } from "../context/SchoolDataContext";

type ScheduleItem = { day: string; time: string; subject: string };


function makeStudents(prefix: string, n = 6) {
  return Array.from({ length: n }).map((_, i) => `${prefix} Student ${i + 1}`);
}

function makeSchedule() {
  return [
    { day: "Mon", time: "08:00 - 09:00", subject: "Mathematics" },
    { day: "Tue", time: "10:00 - 11:00", subject: "English" },
    { day: "Wed", time: "11:30 - 12:30", subject: "Science" },
  ];
}

function makeStream(name: string): Stream {
  return { name, students: [], subjects: [] };
}

export default function ClassManagement() {
  const router = useRouter();

  const { classes, setClasses, catalog, addSubjectToStream, removeSubjectFromStream, updateSubjectInStream, addStudentToStream, editStudentInStream, removeStudentFromStream, importStudentsToStream, teachers, addTeacher, editTeacher, removeTeacher, setClassTeacher } = useSchoolData();

  const [level, setLevel] = useState<"O" | "A">("O");
  const classesForLevel = classes.filter((c) => c.level === level);

  const [selectedClassIndex, setSelectedClassIndex] = useState(0);
  const [selectedStream, setSelectedStream] = useState<string>(classesForLevel[0]?.streams[0]?.name ?? "");
  const [selectedCatalogSubject, setSelectedCatalogSubject] = useState("");
  const [selectedCatalogInitials, setSelectedCatalogInitials] = useState("");
  const [selectedCatalogTeacherId, setSelectedCatalogTeacherId] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);


  // Modal state (includes delete modal)
  const [modal, setModal] = useState<
    | { type: "add-class" | "add-stream" | "edit-class" | "edit-student" | "delete" | "manage-teachers" | "add-teacher" | "edit-teacher" | "change-subject-teacher" | "edit-subject" | "none"; target?: "class" | "stream" | "subject" | "level" | "student"; payload?: any }
    | null
  >({ type: "none" });

  const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherInitials, setTeacherInitials] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");

  const [subjectToEdit, setSubjectToEdit] = useState<{ classIndex: number, streamName: string, subjectIndex: number } | null>(null);
  const [subjectEditName, setSubjectEditName] = useState('');
  const [subjectEditPapers, setSubjectEditPapers] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  // Initialize from URL query params on mount or when classes change
  useEffect(() => {
    const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const lvl = sp?.get("level");
    const className = sp?.get("class");
    const streamName = sp?.get("stream");

    if (lvl === "A" || lvl === "O") {
      setLevel(lvl);
    }

    const arr = (lvl === "A" ? classes.filter((c) => c.level === "A") : classes.filter((c) => c.level === "O"));

    if (className) {
      const decoded = decodeURIComponent(className);
      const idx = arr.findIndex((c) => c.name === decoded);
      if (idx >= 0) {
        setSelectedClassIndex(idx);
        const s = streamName ? decodeURIComponent(streamName) : arr[idx].streams[0]?.name;
        setSelectedStream(s);
        return;
      }
    }

    // if no matching class found, reset to defaults
    setSelectedClassIndex(0);
    setSelectedStream(arr[0]?.streams[0]?.name ?? "");
  }, [classes]);

  // Reflect state into URL (replace to avoid noisy history)
  useEffect(() => {
    // compute current class from `classes` directly to avoid depending on a freshly-created array
    const cls = classes.filter((c) => c.level === level)[selectedClassIndex];
    const params = new URLSearchParams();
    params.set("level", level);
    if (cls) params.set("class", encodeURIComponent(cls.name));
    if (selectedStream) params.set("stream", encodeURIComponent(selectedStream));

    const url = `/class-management?${params.toString()}`;
    // only replace the URL when it actually differs to avoid repeated navigation calls
    const currentUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
    if (currentUrl !== url) router.replace(url);
  }, [level, selectedClassIndex, selectedStream, classes, router]);

  // Helpers to update data
  function addClass(l: "O" | "A", name: string, streamNames: string[]) {
    if (!name) return;
    
    // Check if class already exists for this level
    const exists = classes.some(c => c.name.toLowerCase() === name.toLowerCase() && c.level === l);
    if (exists) {
      alert(`Class "${name}" already exists in ${l === 'O' ? "O'Level" : "A'Level"}.`);
      return;
    }

    const newClass = { name, level: l, streams: streamNames.map((s) => makeStream(s)), assessments: [] };
    setClasses((prev) => [...prev, newClass]);
    setLevel(l);
    setSelectedClassIndex(classesForLevel.length);
    setSelectedStream(streamNames[0]);
    setModal({ type: "none" });
  }

  function removeClass(l: "O" | "A", index: number) {
    const cls = classes.filter((c) => c.level === l)[index];
    if (!cls) return;
    if (!confirm(`Remove class ${cls.name}?`)) return;
    setClasses((prev) => prev.filter((c) => !(c.name === cls.name && c.level === l)));
    setSelectedClassIndex((i) => Math.max(0, Math.min(i, classesForLevel.length - 2)));
  }

  function addStreamToClass(index: number, streamName: string) {
    if (!streamName) return;
    const cls = classesForLevel[index];
    if (!cls) return;

    // Check if stream already exists in this class
    if (cls.streams.some(s => s.name.toLowerCase() === streamName.toLowerCase())) {
      alert(`Stream "${streamName}" already exists in ${cls.name}.`);
      return;
    }

    setClasses((prev) => prev.map((c) => (c.name === cls.name && c.level === cls.level ? { ...c, streams: [...c.streams, makeStream(streamName)] } : c)));
    setSelectedStream(streamName);
    setModal({ type: "none" });
  }

  function removeStreamFromClass(index: number, streamIndex: number) {
    const cls = classesForLevel[index];
    if (!cls) return;
    const name = cls.streams[streamIndex].name;
    if (!confirm(`Remove stream ${name} from ${cls.name}?`)) return;
    setClasses((prev) => prev.map((c) => (c.name === cls.name && c.level === cls.level ? { ...c, streams: c.streams.filter((_, j) => j !== streamIndex) } : c)));

    // adjust selected stream if it was removed
    if (selectedStream === name) {
      const newStreams = cls.streams.filter((_, j) => j !== streamIndex);
      setSelectedStream(newStreams[0]?.name ?? "");
    }
  }

  function addSubjectToCurrentStream(subject: string, initials?: string, teacherId?: string) {
    if (!subject) return;
    const cls = classesForLevel[selectedClassIndex];
    if (!cls) return;
    const globalIndex = classes.findIndex((c) => c.name === cls.name && c.level === cls.level);
    // teacherId is required by addSubjectToStream
    addSubjectToStream(globalIndex, selectedStream, subject, teacherId ?? '', initials);
    setSelectedCatalogSubject("");
    setSelectedCatalogInitials("");
    setSelectedCatalogTeacherId("");
  }

  function removeSubjectFromCurrentStream(subjectIndex: number) {
    const cls = classesForLevel[selectedClassIndex];
    if (!cls) return;
    const globalIndex = classes.findIndex((c) => c.name === cls.name && c.level === cls.level);
    const subj = cls.streams.find((s) => s.name === selectedStream)?.subjects[subjectIndex];
    const name = subj ? (typeof subj === 'string' ? subj : subj.name) : '';
    if (!confirm(`Remove subject ${name} from ${cls.name} — ${selectedStream}?`)) return;
    removeSubjectFromStream(globalIndex, selectedStream, subjectIndex);
  }

  const handleSaveTeacher = async () => {
    if (!teacherName) {
      alert("Teacher name is required.");
      return;
    }
    if (teacherToEdit) {
      try {
        await editTeacher(teacherToEdit.id, { name: teacherName, email: teacherEmail, initials: teacherInitials, password: teacherPassword || undefined });
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Could not update the teacher login.');
        return;
      }
    } else {
      try {
        await addTeacher({ name: teacherName, email: teacherEmail, initials: teacherInitials, password: teacherPassword || undefined });
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Could not create the teacher login.');
        return;
      }
    }
    setModal({ type: 'manage-teachers' });
    setTeacherToEdit(null);
    setTeacherPassword('');
  };

  function handleDelete(target: "class" | "stream" | "subject" | "level" | "student", index: number) {
    if (target === "class") {
      removeClass(level, index);
    } else if (target === "stream") {
      removeStreamFromClass(selectedClassIndex, index);
    } else if (target === "subject") {
      removeSubjectFromCurrentStream(index);
    } else if (target === "student") {
      removeStudentFromCurrentStream(index);
    } else if (target === "level") {
      const lvl = index === 0 ? "O" : "A";
      if (lvl === "O") {
        setClasses((prev) => prev.filter((c) => c.level !== "O"));
        if (level === "O") {
          setSelectedClassIndex(0);
          setSelectedStream("");
          setLevel("A");
        }
      } else {
        setClasses((prev) => prev.filter((c) => c.level !== "A"));
        if (level === "A") {
          setSelectedClassIndex(0);
          setSelectedStream("");
          setLevel("O");
        }
      }
    }
    setModal({ type: "none" });
  }

  // Keyboard navigation for classes (up/down)
  function onClassesKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedClassIndex((i) => Math.min(i + 1, classesForLevel.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedClassIndex((i) => Math.max(i - 1, 0));
    }
  }

  // Keyboard navigation for streams (left/right)
  function onStreamsKeyDown(e: React.KeyboardEvent) {
    const idx = classesForLevel[selectedClassIndex]?.streams.findIndex((s) => s.name === selectedStream) ?? -1;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = Math.min(idx + 1, (classesForLevel[selectedClassIndex]?.streams.length ?? 1) - 1);
      const s = classesForLevel[selectedClassIndex]?.streams[next]?.name;
      if (s) setSelectedStream(s);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = Math.max(idx - 1, 0);
      const s = classesForLevel[selectedClassIndex]?.streams[prev]?.name;
      if (s) setSelectedStream(s);
    }
  }

  // Focus input when modal opens
  useEffect(() => {
    if (modal?.type && modal.type !== "none") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [modal]);

  // Student form state for add/edit
  const [studentIDInput, setStudentIDInput] = useState("");
  const [firstNameInput, setFirstNameInput] = useState("");
  const [secondNameInput, setSecondNameInput] = useState("");
  const [otherNamesInput, setOtherNamesInput] = useState("");
  const [optional1, setOptional1] = useState("");
  const [optional2, setOptional2] = useState("");
  const [genderInput, setGenderInput] = useState<"Male" | "Female">("Male");

  // When opening edit-student modal, populate form
  useEffect(() => {
    if (modal?.type === 'edit-student' && modal.payload?.index !== undefined) {
      const idx = modal.payload.index as number;
      const cls = classesForLevel[selectedClassIndex];
      const stu = cls?.streams.find((s) => s.name === selectedStream)?.students[idx];
      if (stu) {
        setStudentIDInput(stu.studentID);
        setFirstNameInput(stu.firstName);
        setSecondNameInput(stu.secondName);
        setOtherNamesInput(stu.otherNames || "");
        setOptional1(stu.optionalSubjects[0] || "");
        setOptional2(stu.optionalSubjects[1] || "");
        setGenderInput((stu as any).gender || "Male");
      }
    }

    if (modal?.type === 'edit-subject' && subjectToEdit) {
      const cls = classes[subjectToEdit.classIndex];
      const subject = cls?.streams.find((s) => s.name === subjectToEdit.streamName)?.subjects[subjectToEdit.subjectIndex];
      const subjectName = typeof subject === 'string' ? subject : subject?.name ?? '';
      const subjectPapers = typeof subject === 'string' ? '' : (subject?.papers ?? ALEVEL_SUBJECTS_CONFIG[subjectName]?.papers ?? []).join(', ');
      setSubjectEditName(subjectName);
      setSubjectEditPapers(subjectPapers);
    }
  }, [modal, subjectToEdit, classes, selectedStream, selectedClassIndex]);

  function editStudentInCurrentStream() {
    const cls = classesForLevel[selectedClassIndex];
    if (!cls || !modal?.payload) return;
    const globalIndex = classes.findIndex((c) => c.name === cls.name && c.level === cls.level);
    const idx = modal.payload.index as number;
    const optionalSubjects = [optional1, optional2].filter(Boolean);
    editStudentInStream(globalIndex, selectedStream, idx, {
      studentID: studentIDInput,
      firstName: firstNameInput,
      secondName: secondNameInput,
      otherNames: otherNamesInput,
      optionalSubjects,
      gender: genderInput,
    });
    setModal({ type: 'none' });
  }

  async function saveSubjectEdits() {
    if (!subjectToEdit) return;
    const nextName = subjectEditName.trim();
    if (!nextName) {
      alert('Subject name is required.');
      return;
    }

    const nextPapers = Array.from(new Set(subjectEditPapers
      .split(',')
      .map((paper) => paper.trim())
      .filter(Boolean)));

    await updateSubjectInStream(subjectToEdit.classIndex, subjectToEdit.streamName, subjectToEdit.subjectIndex, {
      name: nextName,
      papers: level === 'A' ? (nextPapers.length > 0 ? nextPapers : undefined) : undefined,
    });

    setModal({ type: 'none' });
    setSubjectToEdit(null);
    setSubjectEditName('');
    setSubjectEditPapers('');
  }

  function removeStudentFromCurrentStream(index: number) {
    const cls = classesForLevel[selectedClassIndex];
    if (!cls) return;
    if (!confirm('Remove student?')) return;
    const globalIndex = classes.findIndex((c) => c.name === cls.name && c.level === cls.level);
    removeStudentFromStream(globalIndex, selectedStream, index);
  }

  const currentClass = classesForLevel[selectedClassIndex];

  const catalogSubjects = Object.keys(catalog).filter(key => !key.startsWith('O:') && !key.startsWith('A:')).sort();
  const currentStream = currentClass?.streams.find((s) => s.name === selectedStream);
  const availableSubjects = catalogSubjects.filter((s) => !currentStream?.subjects?.some((sub) => sub.name === s));
  const availableOptionalSubjects = (currentStream?.subjects || []).map((sub: any) => (typeof sub === 'string' ? sub : sub.name)).filter((name) => {
    const levelKey = `${level}:${name}`;
    return catalog[levelKey] === 'optional' || (!catalog[levelKey] && catalog[name] === 'optional');
  });

  useEffect(() => {
    // compute available subjects for the current stream without depending on transient objects
    const currStream = classes.filter((c) => c.level === level)[selectedClassIndex]?.streams.find((s) => s.name === selectedStream);
    const available = Object.keys(catalog).sort().filter((s) => !currStream?.subjects.some((sub: any) => (typeof sub === 'string' ? sub : sub.name) === s));
    setSelectedCatalogSubject(available[0] ?? "");
  }, [selectedStream, classes, catalog, level, selectedClassIndex]);

  const deleteItems: string[] = modal?.target === "class"
    ? classesForLevel.map((c) => c.name)
    : modal?.target === "stream"
    ? currentClass?.streams.map((s) => s.name) ?? []
    : modal?.target === "subject"
    ? (currentClass?.streams.find((x) => x.name === selectedStream)?.subjects ?? []).map((s: any) => (typeof s === 'string' ? s : s.name))
    : modal?.target === "student"
    ? (currentClass?.streams.find((x) => x.name === selectedStream)?.students ?? []).map((st) => `${st.studentID} — ${st.firstName} ${st.secondName}`) ?? []
    : ["O", "A"];
  return (
    <ProtectedRoute requireAdmin>
      <div className="class-management">
        <div className="page-header">
          <h1>Class Management</h1>
        </div>

      <div className="cm-grid">
        <div className="cm-sidebar card">
          <div className="cm-levels" role="tablist" aria-label="Levels">
            <button className={`level-tab ${level === 'O' ? 'active' : ''}`} onClick={() => { setLevel('O'); setSelectedClassIndex(0); }}>O'Level</button>
            <button className={`level-tab ${level === 'A' ? 'active' : ''}`} onClick={() => { setLevel('A'); setSelectedClassIndex(0); }}>A'Level</button>
          </div> 

          <div className="cm-classes">
            <h3 id="classes-heading">Classes</h3>
            <div
              role="listbox"
              aria-labelledby="classes-heading"
              tabIndex={0}
              onKeyDown={onClassesKeyDown}
            >
              <ul>
                {classesForLevel.map((c, i) => (
                  <li key={c.name}>
                    <div className="cm-class-row">
                      <button
                        role="option"
                        aria-selected={i === selectedClassIndex}
                        className={"cm-class" + (i === selectedClassIndex ? " selected" : "")}
                        onClick={() => setSelectedClassIndex(i)}
                      >
                        {c.name}
                      </button>
                    </div> 
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{flex:1}} onClick={() => setModal({ type: "add-class" })}>+ Class</button>
              <button className="icon-btn" aria-label="Delete class" title="Delete class" onClick={() => setModal({ type: "delete", target: "class" })}>
                <IconTrash size={18} />
              </button>
              <button className="btn btn-secondary" title="Manage Teachers" onClick={() => setModal({ type: 'manage-teachers' })}>
                Teachers
              </button>
            </div> 
          </div>
        </div>

        <section className="cm-main">
          <div className="cm-header">
            <div>
              <h2>{currentClass?.name}</h2>
              <p className="muted">Managing {currentClass?.streams.length} streams</p>
            </div>
          </div>

          <div className="cm-streams" role="tablist" aria-label="Streams" onKeyDown={onStreamsKeyDown}>
            {(currentClass?.streams ?? []).map((s) => (
              <button 
                key={s.name} 
                className={`stream-tab ${selectedStream === s.name ? 'active' : ''}`}
                onClick={() => setSelectedStream(s.name)}
              >
                Stream {s.name}
              </button>
            ))}

            <button className="stream-add-btn" onClick={() => setModal({ type: "add-stream" })}>
              +
            </button>
          </div> 

          <div className="cm-panel">
            <h3>
              {selectedStream} — Overview ({(currentClass?.streams.find((x) => x.name === selectedStream) ? makeStudents(selectedStream, 5).length : 0)} students)
            </h3>

            <div className="cm-section">
              <h4>Roster</h4>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Link href={`/student-management?level=${level}&class=${encodeURIComponent(currentClass?.name ?? '')}&stream=${encodeURIComponent(selectedStream ?? '')}`} className="btn btn-accent">Manage Students</Link>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    Import CSV
                    <input type="file" accept="text/csv" style={{ display: 'inline-block' }} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const text = await file.text();
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
                          otherNames: obj['Other_Names'] || obj['OtherNames'] || '',
                          optionalSubjects: [obj['Optional_Subject_1'] || obj['Optional_Subject_1'] || '', obj['Optional_Subject_2'] || obj['Optional_Subject_2'] || ''].filter(Boolean),
                          gender: (obj['Gender'] && String(obj['Gender']).toLowerCase().startsWith('f') ? 'Female' : 'Male') as "Male" | "Female",
                        };
                      });

                      const cls = classesForLevel[selectedClassIndex];
                      if (!cls) { alert('No class selected'); return; }
                      const globalIndex = classes.findIndex((c) => c.name === cls.name && c.level === cls.level);
                      importStudentsToStream(globalIndex, selectedStream, parsed);
                      alert(`Imported ${parsed.length} students`);
                      // clear input
                      (e.target as HTMLInputElement).value = '';
                    }} /></label>
                  <a href="/templates/students-template.csv" download style={{ marginLeft: 8 }}>Download template</a>
                </div>

                <table className="data-table card" style={{ width: '100%', marginTop: 16 }}>
                  <thead>
                    <tr>
                      <th>StudentID</th>
                      <th>First Name</th>
                      <th>Second Name</th>
                      <th>Gender</th>
                      <th>Other Names</th>
                      <th>Subjects</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(currentClass?.streams.find((x) => x.name === selectedStream)?.students ?? []).map((stu, si) => (
                      <tr key={stu.id}>
                        <td>{stu.studentID}</td>
                        <td>{stu.firstName}</td>
                        <td>{stu.secondName}</td>
                        <td>{stu.gender}</td>
                        <td>{stu.otherNames}</td>
                        <td>
                          <button className="view-btn" onClick={() => setViewIndex(si)}>View Details</button>
                        </td>
                        <td>
                          <ContextMenu items={[
                            { label: "Edit", action: () => setModal({ type: 'edit-student', payload: { index: si } }), icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 21v-3.75L14.06 6.19l3.75 3.75L6.75 21H3z" stroke="#000" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>) },
                            { label: "Delete", action: () => setModal({ type: 'delete', target: 'student', payload: { index: si } }), danger: true, icon: (<IconTrash size={14} />) }
                          ]} />
                        </td> 
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="cm-section">
              <h4>Class Teacher</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 500 }}>Assign Class Teacher:</label>
                <select 
                  value={currentClass?.streams.find(s => s.name === selectedStream)?.classTeacherId || ''} 
                  onChange={(e) => {
                    const globalIndex = classes.findIndex(c => c.name === currentClass?.name && c.level === currentClass?.level);
                    setClassTeacher(globalIndex, selectedStream, e.target.value || null);
                  }}
                  style={{ flex: 1, maxWidth: 300 }}
                >
                  <option value="">-- No Class Teacher --</option>
                  {(teachers || []).map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.initials ? `(${t.initials})` : ''} {t.email ? `- ${t.email}` : ''}
                    </option>
                  ))}
                </select>
                {currentClass?.streams.find(s => s.name === selectedStream)?.classTeacherId && (
                  <span style={{ 
                    background: '#3b82f6', 
                    color: 'white', 
                    padding: '4px 12px', 
                    borderRadius: '4px', 
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    Class Teacher Assigned
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
                Class teachers can view/edit all subject scores and manage students for this stream.
              </p>
            </div>

            <div className="cm-section">
              <h4>Subjects</h4>
              <ul className="subject-list">
                {mounted ? (currentClass?.streams.find((x) => x.name === selectedStream)?.subjects ?? []).map((sub, si) => {
                  const teacher = sub.teacherId ? (teachers || []).find((t: any) => t.id === sub.teacherId) : undefined;
                  return (
                    <li key={sub.name + si} className="subject-item">
                      <span className="subject-name">{sub.name}</span>
                      <span className="teacher-badge" title={teacher?.name ?? ''}>{teacher?.initials ?? sub.initials ?? '—'}</span>
                      <ContextMenu items={[
                        { label: "Edit", action: () => {
                          const globalIndex = classes.findIndex(c => c.name === currentClass.name && c.level === currentClass.level);
                          setSubjectToEdit({ classIndex: globalIndex, streamName: selectedStream, subjectIndex: si });
                          setModal({ type: 'edit-subject', payload: { subject: sub } });
                        } },
                        { label: "Change Teacher", action: () => {
                          const globalIndex = classes.findIndex(c => c.name === currentClass.name && c.level === currentClass.level);
                          setSubjectToEdit({ classIndex: globalIndex, streamName: selectedStream, subjectIndex: si });
                          setModal({ type: 'change-subject-teacher', payload: { subject: sub } });
                        } }
                      ]} />
                    </li>
                  );
                }) : null}
              </ul>

              <div className="add-subject-row">
                {catalogSubjects.length === 0 ? (
                  <p className="muted">No subjects in the catalog. Add subjects on the <Link href="/subjects">Subjects</Link> page.</p>
                ) : availableSubjects.length === 0 ? (
                  <p className="muted">All catalog subjects are already assigned to this stream.</p>
                ) : (
                  <>
                    <select value={selectedCatalogSubject} onChange={(e) => setSelectedCatalogSubject(e.target.value)}>
                      {availableSubjects.map((s) => {
                        const levelKey = `${level}:${s}`;
                        const category = catalog[levelKey] ?? catalog[s] ?? 'optional';
                        return <option key={s} value={s}>{s} — {category}</option>;
                      })}
                    </select>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <label style={{ fontSize: 12 }}>Teacher:</label>
                      <select value={selectedCatalogTeacherId} onChange={(e) => setSelectedCatalogTeacherId(e.target.value)}>
                        <option value="">-- select teacher --</option>
                        {(teachers || []).map((t: any) => (<option key={t.id} value={t.id}>{t.name} {t.initials ? `(${t.initials})` : ''}</option>))}
                      </select>
                      <input placeholder="Initials (opt)" value={selectedCatalogInitials} onChange={(e) => setSelectedCatalogInitials(e.target.value)} style={{ width: 80 }} />
                      <button className="btn btn-secondary" onClick={() => { addSubjectToCurrentStream(selectedCatalogSubject, selectedCatalogInitials, selectedCatalogTeacherId); setSelectedCatalogInitials(''); setSelectedCatalogTeacherId(''); }}>Add</button>
                    </div>

                    <button className="icon-btn" aria-label="Delete subject" title="Delete subject" onClick={() => setModal({ type: "delete", target: "subject" })}>
                      <IconTrash size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="cm-section">
              <h4>Schedule</h4>
              <table className="data-table card">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Subject</th>
                  </tr>
                </thead>
                <tbody>
                  {makeSchedule().map((item, i) => (
                    <tr key={i}>
                      <td>{item.day}</td>
                      <td>{item.time}</td>
                      <td>{item.subject}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </section>
      </div>

      {/* Modal */}
      {modal?.type === "add-class" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-class-title">
          <div className="modal">
            <h3 id="add-class-title">Add Class</h3>
            <label>
              Class name
              <input ref={inputRef} type="text" id="new-class-name" />
            </label>
            <label>
              Streams (comma separated)
              <input type="text" id="new-class-streams" placeholder="A,B,C" />
            </label>
            <div className="modal-actions">
              <button
                onClick={() => {
                  const nameEl = document.getElementById("new-class-name") as HTMLInputElement | null;
                  const streamsEl = document.getElementById("new-class-streams") as HTMLInputElement | null;
                  const name = nameEl?.value?.trim();
                  const streams = streamsEl?.value
                    ? streamsEl.value.split(",").map((s) => s.trim()).filter(Boolean)
                    : ["A"];
                  if (name) addClass(level, name, streams);
                }}
                className="primary"
              >
                Add
              </button>
              <button onClick={() => setModal({ type: "none" })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === "add-stream" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-stream-title">
          <div className="modal">
            <h3 id="add-stream-title">Add Stream to {currentClass?.name}</h3>
            <label>
              Stream name
              <input ref={inputRef} type="text" id="new-stream-name" />
            </label>
            <div className="modal-actions">
              <button
                onClick={() => {
                  const nameEl = document.getElementById("new-stream-name") as HTMLInputElement | null;
                  const name = nameEl?.value?.trim();
                  if (name) addStreamToClass(selectedClassIndex, name);
                }}
                className="primary"
              >
                Add Stream
              </button>
              <button onClick={() => setModal({ type: "none" })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'manage-teachers' && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="manage-teachers-title">
          <div className="modal" style={{ width: 500 }}>
            <h3 id="manage-teachers-title">Manage Teachers</h3>
            <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16, border: '1px solid #eee', borderRadius: 4 }}>
              {teachers.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderBottom: '1px solid #eee' }}>
                  <div style={{ flex: 1 }}>
                    <div>{t.name} {t.initials && `(${t.initials})`}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{t.email}</div>
                  </div>
                  <button onClick={() => {
                    setTeacherToEdit(t);
                    setTeacherName(t.name);
                    setTeacherEmail(t.email || '');
                    setTeacherInitials(t.initials || '');
                    setTeacherPassword('');
                    setModal({ type: 'edit-teacher' });
                  }}>Edit</button>
                  <button className="danger" onClick={() => {
                    if (confirm(`Delete teacher ${t.name}? This will unassign them from all subjects.`)) removeTeacher(t.id);
                  }}>Delete</button>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="primary" onClick={() => {
                setTeacherToEdit(null);
                setTeacherName('');
                setTeacherEmail('');
                setTeacherInitials('');
                setTeacherPassword('');
                setModal({ type: 'add-teacher' });
              }}>Add Teacher</button>
              <button onClick={() => setModal({ type: "none" })}>Close</button>
            </div>
          </div>
        </div>
      )}

      {(modal?.type === 'add-teacher' || modal?.type === 'edit-teacher') && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-edit-teacher-title">
          <div className="modal">
            <h3 id="add-edit-teacher-title">{teacherToEdit ? 'Edit Teacher' : 'Add Teacher'}</h3>
            <label>Name <input value={teacherName} onChange={e => setTeacherName(e.target.value)} /></label>
            <label>Email <input type="email" value={teacherEmail} onChange={e => setTeacherEmail(e.target.value)} /></label>
            <label>Initials <input value={teacherInitials} onChange={e => setTeacherInitials(e.target.value)} /></label>
            <label>Password <input type="password" value={teacherPassword} onChange={e => setTeacherPassword(e.target.value)} placeholder={teacherToEdit ? 'Leave blank to keep current' : 'Default: password123'} /></label>
            <div className="modal-actions">
              <button className="primary" onClick={handleSaveTeacher}>Save</button>
              <button onClick={() => setModal({ type: 'manage-teachers' })}>Back</button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'edit-subject' && subjectToEdit && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-subject-title">
          <div className="modal">
            <h3 id="edit-subject-title">Edit Subject</h3>
            <label>
              Subject name
              <input value={subjectEditName} onChange={(e) => setSubjectEditName(e.target.value)} />
            </label>
            {level === 'A' && (
              <label>
                Paper options (comma separated)
                <input
                  value={subjectEditPapers}
                  onChange={(e) => setSubjectEditPapers(e.target.value)}
                  placeholder="P1, P2, P3"
                />
              </label>
            )}
            <div className="modal-actions">
              <button className="primary" onClick={saveSubjectEdits}>Save</button>
              <button onClick={() => { setModal({ type: 'none' }); setSubjectToEdit(null); setSubjectEditName(''); setSubjectEditPapers(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'change-subject-teacher' && subjectToEdit && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="change-teacher-title">
          <div className="modal">
            <h3 id="change-teacher-title">Change Teacher for {modal.payload.subject.name}</h3>
            <select
              value={modal.payload.subject.teacherId || ''}
              onChange={e => {
                const newTeacherId = e.target.value;
                const teacher = teachers.find(t => t.id === newTeacherId);
                updateSubjectInStream(subjectToEdit.classIndex, subjectToEdit.streamName, subjectToEdit.subjectIndex, { teacherId: newTeacherId, initials: teacher?.initials });
                setModal({ type: 'none' });
                setSubjectToEdit(null);
              }}
            >
              <option value="">-- Select Teacher --</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="modal-actions">
              <button onClick={() => { setModal({ type: 'none' }); setSubjectToEdit(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}



      {modal?.type === 'edit-student' && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-student-title">
          <div className="modal">
            <h3 id="edit-student-title">Edit Student — {selectedStream}</h3>
            <label>
              Student ID
              <input value={studentIDInput} onChange={(e) => setStudentIDInput(e.target.value)} />
            </label>
            <label>
              First name
              <input value={firstNameInput} onChange={(e) => setFirstNameInput(e.target.value)} />
            </label>
            <label>
              Second name
              <input value={secondNameInput} onChange={(e) => setSecondNameInput(e.target.value)} />
            </label>
            <label>
              Other names
              <input value={otherNamesInput} onChange={(e) => setOtherNamesInput(e.target.value)} />
            </label>
            <label>
              Optional Subject 1
              <select value={optional1} onChange={(e) => setOptional1(e.target.value)}>
                <option value="">—</option>
                {availableOptionalSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Optional Subject 2
              <select value={optional2} onChange={(e) => setOptional2(e.target.value)}>
                <option value="">—</option>
                {availableOptionalSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <div className="modal-actions">
              <button onClick={() => editStudentInCurrentStream()} className="primary">Save</button>
              <button onClick={() => setModal({ type: 'none' })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {viewIndex !== null && currentStream && currentStream.students[viewIndex] && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
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

      {modal?.type === "delete" && (
        <DeleteModal
          target={modal?.target as any}
          items={deleteItems}
          onConfirm={(idx) => handleDelete(modal?.target as any, idx)}
          onCancel={() => setModal({ type: "none" })}
        />
      )}

      <style jsx>{`
        .class-management { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }
        .page-header { margin-bottom: 2rem; }
        
        .cm-grid { display: grid; grid-template-columns: 280px 1fr; gap: 2rem; }
        .cm-sidebar { height: fit-content; }
        
        .cm-levels { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
        .level-tab { flex: 1; padding: 0.6rem; border: 1px solid var(--border); background: var(--background); border-radius: 6px; cursor: pointer; font-weight: 600; color: var(--text-muted); transition: all 0.2s; }
        .level-tab.active { background: var(--primary); color: white; border-color: var(--primary); }
        
        .cm-classes ul { list-style: none; padding: 0; margin: 0 0 1.5rem 0; display: flex; flex-direction: column; gap: 0.5rem; }
        .cm-class { width: 100%; text-align: left; padding: 0.8rem 1rem; border-radius: 6px; background: transparent; border: 1px solid transparent; cursor: pointer; font-weight: 500; color: var(--text-main); transition: all 0.2s; }
        .cm-class:hover { background: var(--background); }
        .cm-class.selected { background: #EBF5FB; color: var(--primary); border-left: 3px solid var(--primary); font-weight: 600; }
        
        .cm-main { display: flex; flex-direction: column; gap: 1.5rem; }
        .cm-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
        
        .cm-streams { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
        .stream-tab { padding: 0.5rem 1rem; border: 1px solid var(--border); background: var(--surface); border-radius: 6px; cursor: pointer; font-weight: 500; color: var(--text-muted); transition: all 0.2s; }
        .stream-tab:hover { border-color: var(--primary); color: var(--primary); }
        .stream-tab.active { background: var(--primary); color: white; border-color: var(--primary); }
        .stream-add-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--border); background: transparent; border-radius: 6px; cursor: pointer; color: var(--text-muted); }
        .stream-add-btn:hover { border-color: var(--primary); color: var(--primary); }
        
        .cm-panel { min-height: 400px; }
        .cm-section { margin-bottom: 2rem; }
        .cm-section h4 { font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 1rem; font-weight: 700; letter-spacing: 0.05em; }
        
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
        .data-table th { text-align: left; padding: 1rem; border-bottom: 2px solid var(--border); color: var(--text-muted); font-weight: 600; background: var(--background); }
        .data-table td { padding: 1rem; border-bottom: 1px solid var(--border); color: var(--text-main); }
        .data-table tr:last-child td { border-bottom: none; }
        
        .subject-list { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
        .subject-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--surface); border-radius: 6px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); }
        .subject-name { font-weight: 500; }
        .teacher-badge { font-size: 0.8rem; background: var(--background); padding: 0.2rem 0.5rem; border-radius: 4px; color: var(--text-muted); }
        
        .add-subject-row { background: var(--surface); padding: 1rem; border-radius: 6px; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; border: 1px dashed var(--border); }
        
        .icon-btn { background: transparent; border: none; padding: 0.4rem; border-radius: 4px; cursor: pointer; color: var(--text-muted); display: inline-flex; }
        .icon-btn:hover { background: #FEE2E2; color: var(--danger); }
        
        select, input { padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: white; font-family: inherit; }

        .view-btn { background: none; border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; color: #444; }
        .view-btn:hover { background: #f5f5f5; border-color: #ccc; }
        .subject-tag { background: #f0f9ff; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-size: 0.85rem; border: 1px solid #bae6fd; }

        /* Modal */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; }
        .modal { background:#fff; padding:1.5rem; border-radius:8px; width:400px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
        .modal h3 { margin-bottom: 1.5rem; }
        .modal label { display:block; margin-bottom:0.5rem; font-size:0.95rem }
        .modal input { width:100%; padding:0.4rem; margin-top:0.25rem; margin-bottom:0.5rem }
        .modal-actions { display:flex; gap:0.5rem; justify-content:flex-end; margin-top: 1.5rem; }
        .primary { background: var(--primary); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .danger { color: var(--danger); border: 1px solid var(--danger); background: transparent; padding: 0.3rem 0.8rem; border-radius: 6px; cursor: pointer; }
        .detail-row { margin-bottom: 12px; font-size: 0.95rem; }

        @media (max-width: 700px) {
          .cm-grid { grid-template-columns: 1fr; }
          .cm-sidebar { border-right:none; padding-right:0; }
        }
      `}</style>
      </div>
    </ProtectedRoute>
  );
}
