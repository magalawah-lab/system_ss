// app/components/LoadingFallback.tsx
import React from 'react';

interface LoadingFallbackProps {
  message?: string;
  minHeight?: string;
}

export default function LoadingFallback({ 
  message = 'Loading...', 
  minHeight = '60vh' 
}: LoadingFallbackProps) {
  return (
    <div style={{ 
      display: 'flex', 
      minHeight, 
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
        <p style={{ color: '#6b7280' }}>{message}</p>
        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}