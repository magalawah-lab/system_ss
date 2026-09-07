import { NextResponse } from 'next/server';
import { updateAssessmentScore, updateAssessmentSubjectScore, updateAssessmentPaperScore } from '../../../../server/supabase-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, assessmentId, studentId, score, subjectName, paperName } = body;

    if (!assessmentId || !studentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type === 'general') {
      await updateAssessmentScore(assessmentId, studentId, score);
    } else if (type === 'subject') {
      if (!subjectName) return NextResponse.json({ error: 'Missing subjectName' }, { status: 400 });
      await updateAssessmentSubjectScore(assessmentId, subjectName, studentId, score);
    } else if (type === 'paper') {
      if (!subjectName || !paperName) return NextResponse.json({ error: 'Missing subjectName or paperName' }, { status: 400 });
      await updateAssessmentPaperScore(assessmentId, subjectName, paperName, studentId, score);
    } else {
      return NextResponse.json({ error: 'Invalid update type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Score Update API error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
