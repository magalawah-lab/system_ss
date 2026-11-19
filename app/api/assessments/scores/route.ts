import { NextResponse } from 'next/server';
import { upsertAssessmentScores, type ScoreMark } from '../../../../server/supabase-db';

// Release 2's mark endpoint. Accepts a batch and writes one row per mark into
// public.scores.
//
// It used to take a single mark and rewrite the entire ~900 KB school_state
// blob to store it. A batch is what makes the client's queue worth having: one
// request per debounce window instead of one per keystroke, and - because every
// mark in the batch is its own row - two teachers entering marks at the same
// time no longer touch the same row, so neither one loses their save.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawMarks = Array.isArray(body?.marks) ? body.marks : null;

    if (!rawMarks || rawMarks.length === 0) {
      return NextResponse.json({ error: 'Missing marks array' }, { status: 400 });
    }

    const marks: ScoreMark[] = [];
    for (const raw of rawMarks) {
      const { type, assessmentId, studentId, score, subjectName, paperName } = raw || {};

      if (!assessmentId || !studentId) {
        return NextResponse.json({ error: 'Each mark requires assessmentId and studentId' }, { status: 400 });
      }
      if (type !== 'general' && type !== 'subject' && type !== 'paper') {
        return NextResponse.json({ error: 'Each mark requires a type of general, subject or paper' }, { status: 400 });
      }
      if (type !== 'general' && !subjectName) {
        return NextResponse.json({ error: 'Subject and paper marks require subjectName' }, { status: 400 });
      }
      if (type === 'paper' && !paperName) {
        return NextResponse.json({ error: 'Paper marks require paperName' }, { status: 400 });
      }

      marks.push({
        assessmentId,
        studentId,
        type,
        score: score === undefined ? null : score,
        subjectName,
        paperName,
      });
    }

    const report = await upsertAssessmentScores(marks);

    // A mark whose student or assessment has no relational row cannot be written
    // without creating an orphan no read path would ever see, so the database
    // leaves it out and names it here. That is not a success, and it is not a
    // transient failure either: the usual cause is a student created since the
    // last structural sync, which the Release 1 gate is supposed to prevent.
    // Reported as 409 so the client keeps the batch queued and it cannot pass
    // silently. Marks that did resolve are already committed.
    if (report.unmappedStudents.length > 0 || report.unmappedAssessments.length > 0) {
      return NextResponse.json(
        { ...report, error: 'Some marks have no matching student or assessment row' },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    console.error('Score Update API error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
