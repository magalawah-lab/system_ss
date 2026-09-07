import { NextResponse } from 'next/server';
import { getStudents } from '../../../server/supabase-db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const streamId = searchParams.get('streamId');
  const students = await getStudents(streamId || undefined);
  return NextResponse.json(students);
}

// POST, PUT, DELETE similar to teachers...

