// app/reports-and-analytics/report-builder/page.tsx
"use client";

import React, { Suspense } from 'react';
import ReportBuilderContent from './ReportBuilderContent';

export default function ReportBuilderPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        minHeight: '60vh', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <p>Loading report builder...</p>
      </div>
    }>
      <ReportBuilderContent />
    </Suspense>
  );
}