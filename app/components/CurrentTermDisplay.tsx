// app/components/CurrentTermDisplay.tsx
"use client";

import React from 'react';
import { useSchoolData } from '../context/SchoolDataContext';

interface CurrentTermDisplayProps {
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
  showStatus?: boolean;
  statusPosition?: 'inline' | 'below' | 'badge';
}

export default function CurrentTermDisplay({ 
  className = '', 
  showIcon = true,
  compact = false,
  showStatus = false,
  statusPosition = 'inline'
}: CurrentTermDisplayProps) {
  const { academicYears, currentAcademicYearId, currentTermId } = useSchoolData();

  const currentYear = academicYears?.find((y: any) => y.id === currentAcademicYearId);
  const currentTerm = currentYear?.terms?.find((t: any) => t.id === currentTermId);

  if (!currentYear || !currentTerm) {
    return (
      <span className={className}>
        {!compact && 'No active term'}
      </span>
    );
  }

  const displayText = compact 
    ? `${currentTerm.name} ${currentYear.name}`
    : `${currentTerm.name}, ${currentYear.name}`;

  const isActive = currentTerm.isActive && currentYear.isActive;
  const statusText = isActive ? 'Active' : 'Inactive';
  const statusColor = isActive ? '#10b981' : '#ef4444';
  const statusBg = isActive ? '#d1fae5' : '#fee2e2';

  const StatusBadge = () => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.3rem',
      padding: '0.15rem 0.6rem',
      borderRadius: '12px',
      fontSize: '0.65rem',
      fontWeight: '600',
      background: statusBg,
      color: statusColor,
      border: `1px solid ${isActive ? '#6ee7b7' : '#fca5a5'}`
    }}>
      <span style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: statusColor,
        animation: isActive ? 'pulse-dot 2s infinite' : 'none'
      }}></span>
      {statusText}
    </span>
  );

  // Status below the term
  if (statusPosition === 'below' && showStatus) {
    return (
      <div className={className}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {showIcon && <span>📅</span>}
          <span>{displayText}</span>
        </div>
        <div style={{ marginTop: '0.25rem' }}>
          <StatusBadge />
        </div>
      </div>
    );
  }

  // Status as a badge (compact)
  if (statusPosition === 'badge' && showStatus) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className={className}>
          {showIcon && <span style={{ marginRight: '0.25rem' }}>📅</span>}
          {displayText}
        </span>
        <StatusBadge />
      </div>
    );
  }

  // Status inline (default)
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
      {showIcon && <span>📅</span>}
      <span>{displayText}</span>
      {showStatus && <StatusBadge />}
    </span>
  );
}