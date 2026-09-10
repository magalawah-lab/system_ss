import { NextResponse } from 'next/server';
import { getStorageDiagnostics } from '../../../../server/supabase-db';
import { createClient } from '../../../lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(await getStorageDiagnostics(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Storage diagnostics error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 }
    );
  }
}