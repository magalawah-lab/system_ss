import { NextResponse } from 'next/server';
import { updateTeacherAssignment } from '../../../../server/supabase-db';

export async function POST(request: Request) {
  try {
    const { type, className, streamName, teacherId, subjectName, initials } = await request.json();
    
    if (type === 'subject') {
      if (!subjectName) return NextResponse.json({ error: 'Missing subjectName' }, { status: 400 });
      await updateTeacherAssignment(className, streamName, 'subject', teacherId, subjectName, initials);
    } else if (type === 'class') {
      await updateTeacherAssignment(className, streamName, 'class', teacherId);
    } else {
      return NextResponse.json({ error: 'Invalid update type' }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update teacher assignment:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
