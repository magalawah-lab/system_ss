import { NextResponse } from 'next/server';
import { serializeClassesWithRevision, upsertClasses } from '../../../server/supabase-db';
import type { ClassItem } from '../../../app/context/SchoolDataContext';

export async function GET() {
  try {
    // `revision` rides along with the classes: it is the version of the school
    // the browser is now holding, and the POST below expects it back.
    const payload = await serializeClassesWithRevision();
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to serialize classes:', error);
    return NextResponse.json({ error: 'Serialization failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { revision?: number; classes?: ClassItem[] } | ClassItem[];

    // A tab that was already open when this deployed is still running the older
    // client, and that client posts the classes as a bare array. Reading both
    // shapes means such a tab keeps saving exactly as it does today instead of
    // failing with a 400 until its user happens to reload - and teachers keep
    // their tabs open all day. It carries no revision, so it saves unguarded,
    // which is what it did before.
    const classes = Array.isArray(body) ? body : body?.classes;
    const expectedRevision = Array.isArray(body) ? undefined : body?.revision;

    if (!Array.isArray(classes)) {
      return NextResponse.json({ error: 'Expected { revision, classes }' }, { status: 400 });
    }

    // The caller's revision is the guard: it names the version of the school its
    // classes were edited from. A save that names an older one is refused rather
    // than allowed to overwrite whatever was written in the meantime.
    const revision = await upsertClasses(classes, false, expectedRevision);
    // Do not re-read the full state here. The caller already holds the exact
    // payload it just sent, and an extra read of the whole blob doubles the
    // disk IO of every save. The revision is the one exception: the caller needs
    // it to be able to save again.
    return NextResponse.json({ success: true, revision }, { status: 200 });
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
