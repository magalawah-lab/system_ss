import { NextResponse } from 'next/server';
import { getAcademicYears, saveAcademicYears } from '../../../server/supabase-db';

export async function GET() {
  try {
    const academicYears = await getAcademicYears();
    return NextResponse.json(academicYears);
  } catch (error) {
    console.error('Failed to load academic years:', error);
    return NextResponse.json({ error: 'Failed to load academic years' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const years = Array.isArray(body) ? body : [];
    // Saving the years rewrites the whole school_state row, so it moves the
    // revision on like any other save. The caller is told where it landed;
    // without that its next classes save names a revision the row no longer
    // holds and is refused as if another session had changed the data.
    const revision = await saveAcademicYears(years);
    // Return the payload we just persisted. Calling getAcademicYears() here
    // issued a third full read of the ~900 KB school_state row to fetch back
    // data the caller already holds.
    return NextResponse.json({ revision, years }, { status: 200 });
  } catch (error) {
    console.error('Failed to save academic years:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      error: 'Failed to save academic years',
      details: message
    }, { status: 400 });
  }
}
