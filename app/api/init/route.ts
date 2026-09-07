import { NextResponse } from 'next/server';
import { seedDefaults } from '../../../server/supabase-db';

export async function GET() {
  try {
    await seedDefaults();
    return NextResponse.json({ success: true, message: 'Persistence initialized/seeded' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Init failed' }, { status: 500 });
  }
}

