'use client';

// app/not-found.tsx
import React, { Suspense } from 'react';
import Link from 'next/link';

function NotFoundContent() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
      background: '#f9fafb'
    }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '0.5rem', color: '#1f2937' }}>404</h1>
      <h2 style={{ marginBottom: '1rem', color: '#374151' }}>Page Not Found</h2>
      <p style={{ color: '#6b7280', marginBottom: '2rem', maxWidth: '400px' }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link 
        href="/" 
        style={{
          padding: '0.6rem 1.5rem',
          background: '#2563eb',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: '500',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
      >
        Go Home
      </Link>
    </div>
  );
}

export default function NotFound() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
      <NotFoundContent />
    </Suspense>
  );
}