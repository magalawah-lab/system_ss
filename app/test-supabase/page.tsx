"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '../lib/supabase/client';

const supabase = createClient();

export default function TestSupabase() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setStatus('loading');
    setError(null);
    
    try {
      // Check if we have the URL and key
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      setConfig({
        url: url ? `${url.substring(0, 20)}...` : 'missing',
        key: key ? `${key.substring(0, 10)}...` : 'missing'
      });
      
      console.log('🔍 Testing Supabase connection...');
      console.log('URL:', url);
      console.log('Key:', key ? 'Present' : 'Missing');
      
      if (!url || !key) {
        setStatus('error');
        setError('Missing Supabase credentials in environment variables');
        return;
      }
      
      // Try to get the server status (ping)
      const { data, error } = await supabase.from('academic_years').select('count', { count: 'exact', head: true });
      
      if (error) {
        console.error('❌ Connection test failed:', error);
        setStatus('error');
        setError(`Connection failed: ${error.message}`);
        return;
      }
      
      console.log('✅ Connection successful!');
      setStatus('connected');
      
      // Try to get some data
      const { data: years, error: yearsError } = await supabase.from('academic_years').select('*').limit(3);
      if (yearsError) {
        console.warn('Could not fetch academic years:', yearsError);
      } else {
        console.log('📊 Academic years found:', years);
      }
      
      setTestResults({
        connected: true,
        years: years || [],
        tables: ['academic_years', 'user_profiles', 'classes', 'students']
      });
      
    } catch (err: any) {
      console.error('💥 Connection error:', err);
      setStatus('error');
      setError(err.message || 'Unknown error connecting to Supabase');
    }
  };

  const testAuth = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@school.com',
        password: 'admin123'
      });
      
      console.log('Auth test result:', { data, error });
      setTestResults((prev: any) => ({
        ...prev,
        authTest: { data, error }
      }));
      
    } catch (err: any) {
      console.error('Auth test error:', err);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🔍 Supabase Connection Test</h1>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
        <h3>Configuration Status</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <strong>URL:</strong> 
            <span style={{ color: config?.url ? '#16a34a' : '#dc2626' }}>
              {config?.url || 'Missing'}
            </span>
          </div>
          <div>
            <strong>Anon Key:</strong>
            <span style={{ color: config?.key ? '#16a34a' : '#dc2626' }}>
              {config?.key || 'Missing'}
            </span>
          </div>
        </div>
      </div>
      
      <div style={{ 
        padding: '1rem', 
        marginBottom: '1rem', 
        borderRadius: '8px',
        background: status === 'loading' ? '#fef3c7' : status === 'connected' ? '#dcfce7' : '#fee2e2',
        border: `1px solid ${status === 'loading' ? '#fde68a' : status === 'connected' ? '#bbf7d0' : '#fecaca'}`
      }}>
        <h3>Connection Status: 
          <span style={{ 
            color: status === 'loading' ? '#d97706' : status === 'connected' ? '#16a34a' : '#dc2626',
            fontWeight: 'bold'
          }}>
            {status === 'loading' ? '⏳ Testing...' : status === 'connected' ? '✅ Connected!' : '❌ Error'}
          </span>
        </h3>
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      </div>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={testConnection}
          style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          🔄 Test Connection
        </button>
        <button 
          onClick={testAuth}
          style={{ padding: '0.5rem 1rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          🔐 Test Auth
        </button>
      </div>
      
      {testResults && (
        <div style={{ 
          padding: '1rem', 
          background: '#1e293b', 
          borderRadius: '8px',
          color: '#e2e8f0',
          overflow: 'auto',
          maxHeight: '400px'
        }}>
          <h3 style={{ color: 'white' }}>📊 Test Results</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </div>
      )}
      
      <div style={{ marginTop: '2rem', padding: '1rem', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
        <h4>📝 Troubleshooting Steps:</h4>
        <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
          <li>Check that Supabase project is active</li>
          <li>Verify the URL and Anon Key in .env.local</li>
          <li>Check that CORS is configured in Supabase</li>
          <li>Verify that the tables exist in Supabase</li>
          <li>Check network connectivity/firewall</li>
        </ol>
      </div>
    </div>
  );
}