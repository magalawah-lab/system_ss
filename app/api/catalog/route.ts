import { NextResponse } from 'next/server';
import { getCatalog, replaceCatalog } from '../../../server/supabase-db';
import type { SubjectCategory } from '../../../app/context/SchoolDataContext';

export async function GET() {
  try {
    const catalog = await getCatalog();
    return NextResponse.json(catalog);
  } catch (error) {
    console.error('Catalog GET error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Case 1: Single subject update
    if (body && typeof body === 'object' && 'subject' in body && 'category' in body) {
      const { subject, category } = body as { subject: string; category: SubjectCategory };
      
      if (!subject || !category) {
        return NextResponse.json(
          { error: 'Missing required fields: subject and category' },
          { status: 400 }
        );
      }

      const current = await getCatalog();
      const updated = { ...current, [subject]: category };
      await replaceCatalog(updated);
      
      return NextResponse.json({ 
        success: true, 
        message: `Subject "${subject}" categorized as "${category}"`,
        catalog: updated 
      });
    }

    // Case 2: Full catalog replacement
    if (body && typeof body === 'object') {
      await replaceCatalog(body);
      return NextResponse.json({ 
        success: true, 
        message: 'Catalog updated successfully',
        catalog: getCatalog() 
      });
    }

    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Catalog POST error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE - Remove a subject from catalog
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');

    if (!subject) {
      return NextResponse.json(
        { error: 'Missing required parameter: subject' },
        { status: 400 }
      );
    }

    const current = await getCatalog();
    if (!current[subject]) {
      return NextResponse.json(
        { error: `Subject "${subject}" not found in catalog` },
        { status: 404 }
      );
    }

    const updated = { ...current };
    delete updated[subject];
    await replaceCatalog(updated);

    return NextResponse.json({ 
      success: true, 
      message: `Subject "${subject}" removed from catalog`,
      catalog: updated 
    });
  } catch (error) {
    console.error('Catalog DELETE error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// PUT - Bulk update catalog categories
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Expected format: { "subject1": "compulsory", "subject2": "optional", ... }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected an object with subject-category pairs.' },
        { status: 400 }
      );
    }

    const current = await getCatalog();
    
    // Validate all categories
    const validCategories = ['compulsory', 'optional'];
    const invalidEntries = Object.entries(body).filter(
      ([, category]) => !validCategories.includes(category as string)
    );

    if (invalidEntries.length > 0) {
      return NextResponse.json(
        { 
          error: 'Invalid category values', 
          invalid: invalidEntries.map(([subject, category]) => ({ subject, category }))
        },
        { status: 400 }
      );
    }

    // Update catalog with new values
    const updated = { ...current, ...body };
    await replaceCatalog(updated);

    return NextResponse.json({ 
      success: true, 
      message: `Updated ${Object.keys(body).length} subject(s)`,
      catalog: updated 
    });
  } catch (error) {
    console.error('Catalog PUT error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// PATCH - Update a single subject's category
export async function PATCH(request: Request) {
  try {
    const { subject, category } = await request.json();

    if (!subject || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: subject and category' },
        { status: 400 }
      );
    }

    const validCategories = ['compulsory', 'optional'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const current = await getCatalog();
    const updated = { ...current, [subject]: category };
    await replaceCatalog(updated);

    return NextResponse.json({ 
      success: true, 
      message: `Subject "${subject}" updated to "${category}"`,
      catalog: updated 
    });
  } catch (error) {
    console.error('Catalog PATCH error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// OPTIONS - Return available categories
export async function OPTIONS() {
  return NextResponse.json({
    categories: ['compulsory', 'optional'],
    description: 'Subject categories for O-Level and A-Level subjects'
  });
}