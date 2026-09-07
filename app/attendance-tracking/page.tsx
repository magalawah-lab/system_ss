"use client";

import React, { useState } from "react";
import { useSchoolData } from "../context/SchoolDataContext";
import ContextMenu from "../components/ContextMenu";

export default function AttendanceTracking() {
  const { classes } = useSchoolData();
  const [level, setLevel] = useState<'O'|'A'>('O');
  const classesForLevel = classes.filter((c) => c.level === level);
  const [selectedClassIndex, setSelectedClassIndex] = useState(0);
  const [selectedStream, setSelectedStream] = useState(classesForLevel[0]?.streams[0]?.name ?? '');

  const currentStream = classesForLevel[selectedClassIndex]?.streams.find((s) => s.name === selectedStream);

  return (
    <div>
      <h1>Attendance Tracking</h1>
      <p>Record and view attendance for classes and students.</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <select value={level} onChange={(e) => { const v = e.target.value as 'O'|'A'; setLevel(v); setSelectedClassIndex(0); setSelectedStream(classes.filter((c)=>c.level===v)[0]?.streams[0]?.name ?? ''); }}>
          <option value='O'>O'Level</option>
          <option value='A'>A'Level</option>
        </select>

        <select value={selectedClassIndex} onChange={(e) => setSelectedClassIndex(Number(e.target.value))}>
          {classesForLevel.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
        </select>

        <select value={selectedStream} onChange={(e) => setSelectedStream(e.target.value)}>
          {(classesForLevel[selectedClassIndex]?.streams ?? []).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
      </div>

      <div style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr><th>#</th><th>Student</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {(currentStream?.students ?? []).map((st, i) => (
              <tr key={st.id}>
                <td>{i+1}</td>
                <td>{st.firstName} {st.secondName}</td>
                <td><ContextMenu items={[{ label: 'Mark Present', action: () => alert('Marked present'), icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>) }, { label: 'Mark Absent', action: () => alert('Marked absent'), danger: true, icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18" stroke="#b91c1c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 6l12 12" stroke="#b91c1c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>) }]} /></td> 
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 
