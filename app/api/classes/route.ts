import { NextResponse } from 'next/server';
import { serializeClasses, upsertClasses } from '../../../server/supabase-db';
import type { ClassItem } from '../../../app/context/SchoolDataContext';

export async function GET() {
  try {
    const classes = await serializeClasses();
    return NextResponse.json(classes);
  } catch (error) {
    console.error('Failed to serialize classes:', error);
    return NextResponse.json({ error: 'Serialization failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const classesData = await request.json() as ClassItem[];
    await upsertClasses(classesData);
    // Return fresh data
    const updatedClasses = await serializeClasses();
    return NextResponse.json(updatedClasses, { status: 200 });
  } catch (error) {
    console.error('Failed to upsert classes:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      error: 'Database update failed', 
      details: message 
    }, { status: 400 });
  }
}

// DELETE all classes (for full reset)
export async function DELETE() {
  try {
    await upsertClasses([], true);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete classes:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

