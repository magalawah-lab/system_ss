"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSchoolData } from './SchoolDataContext';

export interface Term {
  id: string;
  name: string;
  number: 1 | 2 | 3;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  terms: Term[];
}

interface AcademicYearContextType {
  academicYears: AcademicYear[];
  currentAcademicYear: AcademicYear | null;
  currentTerm: Term | null;
  setCurrentAcademicYear: (yearId: string) => void;
  setCurrentTerm: (termId: string) => void;
  addAcademicYear: (year: Omit<AcademicYear, 'id'>) => void;
  updateAcademicYear: (id: string, updates: Partial<AcademicYear>) => void;
  deleteAcademicYear: (id: string) => void;
  addTerm: (yearId: string, term: Omit<Term, 'id'>) => void;
  updateTerm: (yearId: string, termId: string, updates: Partial<Term>) => void;
  deleteTerm: (yearId: string, termId: string) => void;
  getTermsForYear: (yearId: string) => Term[];
  getActiveYear: () => AcademicYear | null;
  getActiveTerm: (yearId: string) => Term | null;
}

// Create the context
const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

// Provider component - THIS IS WHAT NEEDS TO BE EXPORTED
export function AcademicYearProvider({ children }: { children: React.ReactNode }) {
  const { 
    academicYears, 
    setAcademicYears, 
    currentAcademicYearId, 
    setCurrentAcademicYearId, 
    currentTermId, 
    setCurrentTermId 
  } = useSchoolData();

  const [currentAcademicYear, setCurrentAcademicYearState] = useState<AcademicYear | null>(null);
  const [currentTerm, setCurrentTermState] = useState<Term | null>(null);

  // Set current academic year and term when IDs change
  useEffect(() => {
    if (academicYears.length > 0 && currentAcademicYearId) {
      const year = academicYears.find(y => y.id === currentAcademicYearId);
      setCurrentAcademicYearState(year || null);
      
      if (year) {
        const term = year.terms.find(t => t.id === currentTermId) || year.terms[0] || null;
        setCurrentTermState(term);
      }
    }
  }, [academicYears, currentAcademicYearId, currentTermId]);

  const setCurrentAcademicYear = useCallback((yearId: string) => {
    setCurrentAcademicYearId(yearId);
    const year = academicYears.find(y => y.id === yearId);
    if (year) {
      const term = year.terms.find(t => t.isActive) || year.terms[0];
      if (term) setCurrentTermId(term.id);
    }
  }, [academicYears, setCurrentAcademicYearId, setCurrentTermId]);

  const setCurrentTerm = useCallback((termId: string) => {
    setCurrentTermId(termId);
  }, [setCurrentTermId]);

  const addAcademicYear = useCallback((year: Omit<AcademicYear, 'id'>) => {
    const newYear: AcademicYear = {
      ...year,
      id: 'year-' + Date.now(),
    };
    setAcademicYears([...academicYears, newYear]);
  }, [academicYears, setAcademicYears]);

  const updateAcademicYear = useCallback((id: string, updates: Partial<AcademicYear>) => {
    setAcademicYears(academicYears.map(year => 
      year.id === id ? { ...year, ...updates } : year
    ));
  }, [academicYears, setAcademicYears]);

  const deleteAcademicYear = useCallback((id: string) => {
    if (confirm('Delete this academic year and all its terms?')) {
      setAcademicYears(academicYears.filter(year => year.id !== id));
      if (currentAcademicYear?.id === id) {
        const nextYear = academicYears.find(y => y.id !== id);
        if (nextYear) setCurrentAcademicYear(nextYear.id);
      }
    }
  }, [academicYears, currentAcademicYear, setAcademicYears]);

  const addTerm = useCallback((yearId: string, term: Omit<Term, 'id'>) => {
    const newTerm: Term = {
      ...term,
      id: 'term-' + Date.now(),
    };
    setAcademicYears(academicYears.map(year => 
      year.id === yearId 
        ? { ...year, terms: [...year.terms, newTerm] }
        : year
    ));
  }, [academicYears, setAcademicYears]);

  const updateTerm = useCallback((yearId: string, termId: string, updates: Partial<Term>) => {
    setAcademicYears(academicYears.map(year => 
      year.id === yearId 
        ? { ...year, terms: year.terms.map(term => term.id === termId ? { ...term, ...updates } : term) }
        : year
    ));
  }, [academicYears, setAcademicYears]);

  const deleteTerm = useCallback((yearId: string, termId: string) => {
    if (confirm('Delete this term?')) {
      setAcademicYears(academicYears.map(year => 
        year.id === yearId 
          ? { ...year, terms: year.terms.filter(term => term.id !== termId) }
          : year
      ));
    }
  }, [academicYears, setAcademicYears]);

  const getTermsForYear = useCallback((yearId: string) => {
    const year = academicYears.find(y => y.id === yearId);
    return year ? year.terms : [];
  }, [academicYears]);

  const getActiveYear = useCallback(() => {
    return academicYears.find(y => y.isActive) || null;
  }, [academicYears]);

  const getActiveTerm = useCallback((yearId: string) => {
    const year = academicYears.find(y => y.id === yearId);
    return year ? year.terms.find(t => t.isActive) || null : null;
  }, [academicYears]);

  return (
    <AcademicYearContext.Provider value={{
      academicYears,
      currentAcademicYear,
      currentTerm,
      setCurrentAcademicYear,
      setCurrentTerm,
      addAcademicYear,
      updateAcademicYear,
      deleteAcademicYear,
      addTerm,
      updateTerm,
      deleteTerm,
      getTermsForYear,
      getActiveYear,
      getActiveTerm,
    }}>
      {children}
    </AcademicYearContext.Provider>
  );
}

// Hook for using the context - ALSO EXPORT THIS
export function useAcademicYear() {
  const context = useContext(AcademicYearContext);
  if (!context) {
    throw new Error('useAcademicYear must be used within an AcademicYearProvider');
  }
  return context;
}

// Default export (optional but can help with some import patterns)
export default AcademicYearProvider;