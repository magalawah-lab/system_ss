import { NextResponse } from 'next/server';
import { serializeClasses } from '../../../server/supabase-db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const classes = await serializeClasses();
    const selectedClass = classes.find((item: any) => item.id === classId || item.name === classId);
    const assessments = selectedClass?.assessments || classes.flatMap((item: any) => item.assessments || []);
    return NextResponse.json(assessments);
  } catch (error) {
    console.error('Assessments GET error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}

// POST etc...

