# Report Card Builder Improvements

## Status: Planning

**Requirements:**
- Prompt inputs: Report title, Period (Term), Year
- Automated class teacher/headteacher comments

**Current:**
- app/reports-and-analytics/report-builder/page.tsx: PDF generation UI
- Uses class data, assessments, scores
- No term/year/title inputs or automated comments

**Plan:**
1. Update report-builder/page.tsx: Add form inputs for title/term/year
2. Add auto-comment generation: Based on avg scores/attendance (class teacher), overall (headteacher)
3. Store in context/state, use in PDF
4. Update PDF template with fields

**Dependent Files:**
- app/reports-and-analytics/report-builder/page.tsx
- app/context/SchoolDataContext.tsx (comments state/helper?)
- PDF components

**Followup:** Test PDF generation with inputs/comments

## Step-by-Step Tasks
- [x] Step 1: read_file report-builder/page.tsx & pdf/page.tsx
- [x] Step 2: Update report-builder/page.tsx - add form inputs (title, term, year)
- [x] Step 4: Pass to PDF, update template (title/term/year display, fixed duplicate year var + cleanup)
- [x] Step 3: Add auto-comment logic (class teacher/headteacher based on avg scores)
- [ ] Step 5: Test
- [ ] Step 5: Test

- [ ] Step 5: Test
- [ ] Step 5: Test

