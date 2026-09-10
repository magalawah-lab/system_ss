import { NextResponse } from 'next/server';
import { getTeachers, replaceTeachers } from '../../../server/supabase-db';
import type { Teacher } from '../../../app/context/SchoolDataContext';

export async function GET() {
  try {
    const teachers = await getTeachers() as Teacher[];
    return NextResponse.json(teachers);
  } catch (error) {
    console.error('Teachers GET error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Teacher[] | (Omit<Teacher, 'id'> & { id?: string });

    if (Array.isArray(body)) {
      await replaceTeachers(body);
      return NextResponse.json(await getTeachers(), { status: 200 });
    }

    if (body.id) {
      const next = (await getTeachers()).map((teacher: any) => (
        teacher.id === body.id ? { ...teacher, ...body } : teacher
      ));
      await replaceTeachers(next);
      return NextResponse.json({ success: true });
    }

    const id = crypto.randomUUID().slice(0, 9);
    const next = [...(await getTeachers()), { ...body, id }];
    await replaceTeachers(next);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error('Teachers API error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    const next = (await getTeachers()).filter((teacher: any) => teacher.id !== id);
    await replaceTeachers(next);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Teachers DELETE error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

