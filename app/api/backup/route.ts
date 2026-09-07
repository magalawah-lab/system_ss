import { exportBackup, restoreBackup } from '../../../server/supabase-db';

export async function GET() {
  try {
    const payload = await exportBackup();
    const datePart = payload.exportedAt.slice(0, 10);
    const fileName = `school-backup-${datePart}.json`;

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Backup export error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    await restoreBackup(payload);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Backup restore error:', error);
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
