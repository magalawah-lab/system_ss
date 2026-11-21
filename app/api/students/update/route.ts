import { NextResponse } from 'next/server';
import { updateStudentSubjects } from '../../../../server/supabase-db';

export async function POST(request: Request) {
  try {
    const { studentId, subjects, optionalSubjects } = await request.json();
    if (!studentId) {
      return NextResponse.json({ error: 'Missing studentId' }, { status: 400 });
    }
    
    // The revision the write left behind goes back to the caller. The browser
    // has to name it on its next save, and this write moved it.
    const revision = await updateStudentSubjects(studentId, subjects || [], optionalSubjects || []);
    return NextResponse.json({ success: true, revision });
  } catch (error) {
    console.error('Failed to update student subjects:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
