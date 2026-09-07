// app/reports-and-analytics/marksheets/page.tsx
"use client";

import React, { Suspense } from 'react';
import MarksheetsContent from './MarksheetsContent';

export default function MarksheetsPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        minHeight: '60vh', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <p>Loading...</p>
      </div>
    }>
      <MarksheetsContent />
    </Suspense>
  );
}