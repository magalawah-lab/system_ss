import { connection } from 'next/server'
import AssessmentsReportsContent from './AssessmentsReportsContent'
import { Suspense } from 'react'

export default async function AssessmentsReportsPage() {
  await connection()
  
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        minHeight: '60vh', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <p>Loading assessments...</p>
      </div>
    }>
      <AssessmentsReportsContent />
    </Suspense>
  )
}