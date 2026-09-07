# Level-Wide Assessments Plan

## Status: In Progress

### Information Gathered
- Assessments currently per-class (ClassItem.assessments[])
- UI at app/class-management/assessments/page.tsx uses addAssessmentToClass
- Reports use class assessments

### Plan
1. SchoolDataContext.tsx: Add `addAssessmentToLevel(level: "O"|"A", assessment)` - loop classes of level, add to each
2. app/class-management/assessments/page.tsx: Add "Add to Level" toggle/button
3. Test

### Dependent Files
- app/context/SchoolDataContext.tsx
- app/class-management/assessments/page.tsx

### Followup
- Installations: None
- Testing: Create level assessment, verify in classes/reports

## Step-by-Step Tasks
- [x] Step 1: read_file app/class-management/assessments/page.tsx
- [x] Step 2: read_file app/context/SchoolDataContext.tsx
- [x] Step 3: Add addAssessmentToLevel to context type
- [x] Step 4: Implement addAssessmentToLevel function
- [ ] Step 5: Update assessments/page.tsx UI
- [ ] Step 6: Test
- [ ] Step 5: Test

