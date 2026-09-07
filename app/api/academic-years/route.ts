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
    await saveAcademicYears(years);
    return NextResponse.json(await getAcademicYears(), { status: 200 });
  } catch (error) {
    console.error('Failed to save academic years:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      error: 'Failed to save academic years',
      details: message
    }, { status: 400 });
  }
}
