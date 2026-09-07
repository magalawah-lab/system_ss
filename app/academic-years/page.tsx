"use client";

import React, { useState } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import { useSchoolData } from '../context/SchoolDataContext';

export default function AcademicYearsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AcademicYearsContent />
    </ProtectedRoute>
  );
}

function AcademicYearsContent() {
  const { 
    academicYears, 
    setAcademicYears,
    currentAcademicYearId,
    setCurrentAcademicYearId,
    currentTermId,
    setCurrentTermId
  } = useSchoolData();

  const [showAddYear, setShowAddYear] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [newYearStart, setNewYearStart] = useState('');
  const [newYearEnd, setNewYearEnd] = useState('');

  const [showAddTerm, setShowAddTerm] = useState<string | null>(null);
  const [newTermName, setNewTermName] = useState('');
  const [newTermNumber, setNewTermNumber] = useState<1 | 2 | 3>(1);
  const [newTermStart, setNewTermStart] = useState('');
  const [newTermEnd, setNewTermEnd] = useState('');

  const handleAddYear = () => {
    if (!newYearName || !newYearStart || !newYearEnd) return;
    
    const newYear = {
      id: 'year-' + Date.now(),
      name: newYearName,
      startDate: newYearStart,
      endDate: newYearEnd,
      isActive: false,
      terms: [
        {
          id: 'term-1-' + Date.now(),
          name: 'Term 1',
          number: 1 as const,
          startDate: newYearStart,
          endDate: newYearEnd,
          isActive: false,
        },
        {
          id: 'term-2-' + Date.now(),
          name: 'Term 2',
          number: 2 as const,
          startDate: newYearStart,
          endDate: newYearEnd,
          isActive: false,
        },
        {
          id: 'term-3-' + Date.now(),
          name: 'Term 3',
          number: 3 as const,
          startDate: newYearStart,
          endDate: newYearEnd,
          isActive: false,
        },
      ]
    };

    setAcademicYears([...academicYears, newYear]);
    setNewYearName('');
    setNewYearStart('');
    setNewYearEnd('');
    setShowAddYear(false);
  };

  const handleAddTerm = (yearId: string) => {
    if (!newTermName || !newTermStart || !newTermEnd) return;

    const newTerm = {
      id: 'term-' + Date.now(),
      name: newTermName,
      number: newTermNumber,
      startDate: newTermStart,
      endDate: newTermEnd,
      isActive: false,
    };

    setAcademicYears(academicYears.map(year => 
      year.id === yearId 
        ? { ...year, terms: [...year.terms, newTerm] }
        : year
    ));

    setNewTermName('');
    setNewTermNumber(1);
    setNewTermStart('');
    setNewTermEnd('');
    setShowAddTerm(null);
  };

  const toggleYearActive = (yearId: string) => {
    setAcademicYears(academicYears.map(year => 
      year.id === yearId 
        ? { ...year, isActive: !year.isActive }
        : year
    ));
  };

  const toggleTermActive = (yearId: string, termId: string) => {
    setAcademicYears(academicYears.map(year => 
      year.id === yearId 
        ? { 
            ...year, 
            terms: year.terms.map(term => 
              term.id === termId 
                ? { ...term, isActive: !term.isActive }
                : term
            )
          }
        : year
    ));
  };

  const deleteAcademicYear = (id: string) => {
    if (confirm('Delete this academic year and all its terms?')) {
      setAcademicYears(academicYears.filter(year => year.id !== id));
      if (currentAcademicYearId === id) {
        const nextYear = academicYears.find(y => y.id !== id);
        if (nextYear) setCurrentAcademicYearId(nextYear.id);
      }
    }
  };

  const deleteTerm = (yearId: string, termId: string) => {
    if (confirm('Delete this term?')) {
      setAcademicYears(academicYears.map(year => 
        year.id === yearId 
          ? { ...year, terms: year.terms.filter(term => term.id !== termId) }
          : year
      ));
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem 0' }}>📅 Academic Years</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Manage academic years and terms for the school
          </p>
        </div>
        <button 
          className="primary"
          onClick={() => setShowAddYear(true)}
          style={{
            padding: '0.5rem 1.5rem',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          + Add Academic Year
        </button>
      </div>

      {/* Academic Years List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {academicYears.map(year => (
          <div key={year.id} style={{
            border: `2px solid ${year.isActive ? '#2563eb' : '#e5e7eb'}`,
            borderRadius: '8px',
            padding: '1rem',
            background: year.isActive ? '#eff6ff' : 'white'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>{year.name}</h3>
                <span style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  background: year.isActive ? '#dbeafe' : '#f3f4f6',
                  color: year.isActive ? '#1d4ed8' : '#6b7280'
                }}>
                  {year.isActive ? 'Active' : 'Inactive'}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  {year.startDate} → {year.endDate}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => toggleYearActive(year.id)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  {year.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => setShowAddTerm(year.id)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  + Add Term
                </button>
                <button
                  onClick={() => deleteAcademicYear(year.id)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ef4444',
                    background: 'white',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Terms */}
            <div style={{ paddingLeft: '1rem', borderLeft: '3px solid #e5e7eb' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#6b7280' }}>Terms</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                {year.terms.map(term => (
                  <div key={term.id} style={{
                    padding: '0.5rem',
                    border: `1px solid ${term.isActive ? '#2563eb' : '#e5e7eb'}`,
                    borderRadius: '6px',
                    background: term.isActive ? '#eff6ff' : 'white'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{term.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {term.startDate} → {term.endDate}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          onClick={() => toggleTermActive(year.id, term.id)}
                          style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #d1d5db',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '0.7rem'
                          }}
                          title={term.isActive ? 'Active' : 'Inactive'}
                        >
                          {term.isActive ? '⭐' : '○'}
                        </button>
                        <button
                          onClick={() => deleteTerm(year.id, term.id)}
                          style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #ef4444',
                            background: 'white',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.7rem'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Term Form */}
            {showAddTerm === year.id && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: '#f9fafb'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Add Term to {year.name}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Term Name (e.g., Term 1)"
                    value={newTermName}
                    onChange={(e) => setNewTermName(e.target.value)}
                    style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  />
                  <select
                    value={newTermNumber}
                    onChange={(e) => setNewTermNumber(Number(e.target.value) as 1 | 2 | 3)}
                    style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  >
                    <option value={1}>Term 1</option>
                    <option value={2}>Term 2</option>
                    <option value={3}>Term 3</option>
                  </select>
                  <input
                    type="date"
                    placeholder="Start Date"
                    value={newTermStart}
                    onChange={(e) => setNewTermStart(e.target.value)}
                    style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  />
                  <input
                    type="date"
                    placeholder="End Date"
                    value={newTermEnd}
                    onChange={(e) => setNewTermEnd(e.target.value)}
                    style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => handleAddTerm(year.id)}
                    style={{
                      padding: '0.25rem 1rem',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Add Term
                  </button>
                  <button
                    onClick={() => setShowAddTerm(null)}
                    style={{
                      padding: '0.25rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Year Modal */}
      {showAddYear && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowAddYear(false)}>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90vw'
          }} onClick={(e) => e.stopPropagation()}>
            <h3>Add Academic Year</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Year (e.g., 2024)"
                value={newYearName}
                onChange={(e) => setNewYearName(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
              <input
                type="date"
                placeholder="Start Date"
                value={newYearStart}
                onChange={(e) => setNewYearStart(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
              <input
                type="date"
                placeholder="End Date"
                value={newYearEnd}
                onChange={(e) => setNewYearEnd(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleAddYear}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Year
              </button>
              <button
                onClick={() => setShowAddYear(false)}
                style={{
                  padding: '0.5rem 1.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}