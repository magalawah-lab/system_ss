"use client";

import React from 'react';
import { useSchoolData } from '../context/SchoolDataContext';

interface AcademicYearSelectorProps {
  showLabels?: boolean;
  onYearChange?: (yearId: string) => void;
  onTermChange?: (termId: string) => void;
  compact?: boolean;
}

export default function AcademicYearSelector({ 
  showLabels = true, 
  onYearChange, 
  onTermChange,
  compact = false
}: AcademicYearSelectorProps) {
  const { 
    academicYears, 
    currentAcademicYearId, 
    currentTermId,
    setCurrentAcademicYearId,
    setCurrentTermId
  } = useSchoolData();

  // Handle loading state - if academicYears is not yet available or empty
  if (!academicYears || !Array.isArray(academicYears) || academicYears.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        gap: '0.3rem', 
        alignItems: 'center',
        padding: compact ? '0.25rem 0.5rem' : '0.5rem 1rem',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
        background: '#f9fafb'
      }}>
        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          {compact ? '📅' : 'Loading academic years...'}
        </span>
        {!compact && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>No years configured</span>}
      </div>
    );
  }

  const currentYear = academicYears.find((y: any) => y.id === currentAcademicYearId);
  const terms = currentYear?.terms || [];

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const yearId = e.target.value;
    setCurrentAcademicYearId(yearId);
    const year = academicYears.find((y: any) => y.id === yearId);
    if (year && year.terms && year.terms.length > 0) {
      const activeTerm = year.terms.find((t: any) => t.isActive) || year.terms[0];
      setCurrentTermId(activeTerm.id);
      if (onTermChange) onTermChange(activeTerm.id);
    }
    if (onYearChange) onYearChange(yearId);
  };

  const handleTermChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const termId = e.target.value;
    setCurrentTermId(termId);
    if (onTermChange) onTermChange(termId);
  };

  if (compact) {
    return (
      <div style={{ 
        display: 'flex', 
        gap: '0.3rem', 
        alignItems: 'center',
        background: '#f9fafb',
        padding: '0.25rem 0.5rem',
        borderRadius: '6px',
        border: '1px solid #e5e7eb'
      }}>
        {showLabels && (
          <span style={{ 
            fontSize: '0.7rem', 
            color: '#6b7280',
            fontWeight: '500',
            whiteSpace: 'nowrap'
          }}>
            📅
          </span>
        )}
        <select
          value={currentAcademicYearId || ''}
          onChange={handleYearChange}
          style={{
            padding: '0.2rem 0.4rem',
            borderRadius: '4px',
            border: '1px solid #d1d5db',
            background: 'white',
            fontSize: '0.75rem',
            minWidth: '60px',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          {academicYears.map((year: any) => (
            <option key={year.id} value={year.id}>
              {year.name} {year.isActive ? '⭐' : ''}
            </option>
          ))}
        </select>
        {currentYear && terms.length > 0 && (
          <select
            value={currentTermId || ''}
            onChange={handleTermChange}
            style={{
              padding: '0.2rem 0.4rem',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              background: 'white',
              fontSize: '0.75rem',
              minWidth: '55px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {terms.map((term: any) => (
              <option key={term.id} value={term.id}>
                {term.name === 'Term 1' ? 'T1' : term.name === 'Term 2' ? 'T2' : 'T3'}
                {term.isActive ? '⭐' : ''}
              </option>
            ))}
          </select>
        )}
        {currentYear && terms.length === 0 && (
          <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>No terms</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      gap: '1rem', 
      alignItems: 'center',
      flexWrap: 'wrap',
      background: '#f9fafb',
      padding: '0.5rem 1rem',
      borderRadius: '8px',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {showLabels && (
          <label style={{ 
            fontWeight: '600', 
            fontSize: '0.875rem',
            color: '#374151',
            whiteSpace: 'nowrap'
          }}>
            📅 Year:
          </label>
        )}
        <select
          value={currentAcademicYearId || ''}
          onChange={handleYearChange}
          style={{
            padding: '0.35rem 0.6rem',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            background: 'white',
            fontSize: '0.875rem',
            minWidth: '100px',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          {academicYears.map((year: any) => (
            <option key={year.id} value={year.id}>
              {year.name} {year.isActive ? '⭐' : ''}
            </option>
          ))}
        </select>
      </div>

      {currentYear && terms.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {showLabels && (
            <label style={{ 
              fontWeight: '600', 
              fontSize: '0.875rem',
              color: '#374151',
              whiteSpace: 'nowrap'
            }}>
              📚 Term:
            </label>
          )}
          <select
            value={currentTermId || ''}
            onChange={handleTermChange}
            style={{
              padding: '0.35rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              background: 'white',
              fontSize: '0.875rem',
              minWidth: '100px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {terms.map((term: any) => (
              <option key={term.id} value={term.id}>
                {term.name} {term.isActive ? '⭐' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {currentYear && terms.length === 0 && (
        <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>No terms configured for this year</span>
      )}
    </div>
  );
}