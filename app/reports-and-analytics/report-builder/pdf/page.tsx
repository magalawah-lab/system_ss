"use client";

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the PDF component with SSR disabled
const ReportCardPDF = dynamic(
  () => import('../ReportCardPDF'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem auto'
          }}></div>
          <p style={{ color: '#6b7280' }}>Generating PDF...</p>
          <style jsx>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }
);

export default function PDFPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReportCardPDF />
    </Suspense>
  );
}