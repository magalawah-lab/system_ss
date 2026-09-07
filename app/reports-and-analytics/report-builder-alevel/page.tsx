// app/reports-and-analytics/report-builder-alevel/page.tsx
"use client";

import React, { Suspense } from 'react';
import ALevelReportBuilderContent from './ALevelReportBuilderContent';

export default function ALevelReportBuilderPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        minHeight: '60vh', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <p>Loading A-Level report builder...</p>
      </div>
    }>
      <ALevelReportBuilderContent />
    </Suspense>
  );
}