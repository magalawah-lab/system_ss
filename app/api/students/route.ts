import { NextResponse } from 'next/server';
import { getStudents } from '../../../server/supabase-db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('streamId');
    const students = await getStudents(streamId || undefined);
    return NextResponse.json(students);
  } catch (error) {
    console.error('Students GET error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}

// POST, PUT, DELETE similar to teachers...

