# Report Card Builder - Quick Start Guide

## What's New

A complete **Report Card Builder** has been added to your school management system. This feature generates professional PDF report cards for individual students with automatic calculations and grading.

## New Files Created

1. **`app/reports-and-analytics/report-builder/page.tsx`**
   - Report builder interface where users select class, stream, and student
   - Provides information about the report structure
   - Button to generate PDF

2. **`app/reports-and-analytics/report-builder/pdf/page.tsx`**
   - Generates the actual PDF report card
   - Contains all calculations and formatting
   - Auto-opens print dialog

## How It Works

### Navigation
- Go to **Reports & Analytics**
- Click on **Report Card Builder** tab (new)
- Select Class → Stream → Student
- Click **"Generate Report PDF"**
- Report opens in new tab → Print dialog appears automatically

### Report Card Includes

| Component | Details |
|-----------|---------|
| **Header** | School logo, name, contacts, motto |
| **Student Info** | Name, class, stream, term |
| **Scores Table** | Subject, C1, C2, 20%, 80%, 100%, Grade, Comments |
| **Summary** | Overall percentage and grade |
| **Comments** | Signature areas for class teacher and headteacher |

### Column Formulas

| Column | Calculation |
|--------|-------------|
| C1 | Direct entry (0-3) |
| C2 | Direct entry (0-3) |
| 20% | `((C1 + C2) / 2) / 3 × 20` |
| 80% | Direct entry (0-80) |
| 100% | `20% + 80%` |

### Grading

| Grade | Range | Comment |
|-------|-------|---------|
| A | 80-100 | Excellent performance. Outstanding achievement. |
| B | 60-79 | Good performance. Well done. |
| C | 40-59 | Satisfactory performance. Keep up the good work. |
| D | 20-39 | Fair performance. Needs improvement. |
| E | 0-19 | Poor performance. Requires immediate attention. |

## Assessment Setup

For the system to work correctly, you need to create these assessments:

### 1. C1 Assessment
- **Name**: Should contain "C1" (e.g., "C1 - Chapter Test")
- **Max Score**: 3
- **Frequency**: Once per term

### 2. C2 Assessment
- **Name**: Should contain "C2" (e.g., "C2 - Chapter Test")
- **Max Score**: 3
- **Frequency**: Once per term

### 3. End of Term Assessment
- **Name**: Should contain one of: "END", "EXAM", "TERM", or "80%"
- **Max Score**: 80
- **Frequency**: Once per term

## Quick Test

To test the report card builder:

1. **Setup Data** (if not already done)
   - Create assessments with correct names and max scores
   - Enter some test scores for a student in a class

2. **Generate Report**
   - Navigate to Reports & Analytics
   - Click "Report Card Builder"
   - Select Class, Stream, Student
   - Click "Generate Report PDF"

3. **Verify Output**
   - Check that scores are calculated correctly
   - Verify grades are assigned based on 100% column
   - Print to PDF or printer

## Integration Points

### SchoolDataContext
The system uses the existing `SchoolDataContext` to access:
- Classes
- Streams
- Students
- Assessments
- Teachers

### No Additional Dependencies
- Uses only built-in React and Next.js
- No external PDF library needed (browser print API)
- Browser's native print dialog handles PDF generation

## Customization

### To Change School Name
Edit `app/reports-and-analytics/report-builder/pdf/page.tsx`:
```tsx
<h1>YOUR SCHOOL NAME</h1>
```

### To Change Grading Scale
Edit the `getGrade()` function:
```tsx
function getGrade(mark: number | null): string {
  if (mark === null) return "—";
  if (mark >= 85) return "A";  // Change threshold
  if (mark >= 65) return "B";  // Change threshold
  // ... etc
}
```

### To Add More Comments
Edit the `getComment()` function:
```tsx
function getComment(grade: string): string {
  const gradeComments: Record<string, string> = {
    A: "Your custom comment for A",
    B: "Your custom comment for B",
    // ... etc
  };
  return gradeComments[grade] || "";
}
```

## Troubleshooting

### "No scores showing in report"
- Check that assessments are named with C1, C2, or 80%
- Verify scores have been entered for that student
- Ensure student is in the selected stream

### "Grades showing as —"
- Verify 20% and 80% assessments exist
- Check that scores have been entered for all columns
- Make sure assessment names match system conventions

### "Print dialog not showing"
- Browser may be blocking print dialog
- Try Ctrl+P (Windows) or Cmd+P (Mac)
- Check browser settings for print blocking

### "Calculations look wrong"
- C1 and C2 max score should be 3
- 80% max score should be 80
- Verify the formula: ((C1 + C2) / 2) / 3 × 20

## Feature Highlights

✅ **Automatic Calculations** - No manual math needed
✅ **Professional Layout** - Print-ready PDF design
✅ **Grade Assignment** - Automatic based on 100% score
✅ **Teacher Initials** - Pulls from teacher database
✅ **Customizable Comments** - Based on grade level
✅ **Overall Performance** - Calculates class average
✅ **Clean Interface** - Intuitive class/stream/student selection
✅ **No Extra Software** - Uses browser's print functionality

## Files Modified

Only one existing file was modified:
- **`app/reports-and-analytics/page.tsx`**
  - Added `import Link from "next/link"`
  - Added navigation tab for "Report Card Builder"
  - Added link to `/reports-and-analytics/report-builder`

All other functionality remains unchanged.

## Data Flow

```
User Selects Student
         ↓
Builder Page Collects Selection
         ↓
PDF Page Receives URL Parameters
         ↓
Fetches Data from SchoolDataContext
         ↓
Finds C1, C2, 80% Assessments
         ↓
Retrieves Scores for Student & Subject
         ↓
Calculates 20%, 80%, 100%
         ↓
Assigns Grade & Comment
         ↓
Renders Complete Report
         ↓
Auto-Opens Print Dialog
         ↓
User Prints to PDF or Printer
```

## Next Steps

1. **Test with existing data** - Generate a report for current students
2. **Verify calculations** - Check a few reports manually
3. **Customize appearance** - Adjust colors, fonts if needed
4. **Train staff** - Show teachers how to generate reports
5. **Plan improvements** - Collect feedback for future enhancements

## Support Documents

For detailed information, see:
- **REPORT_CARD_BUILDER_GUIDE.md** - Complete feature guide
- **REPORT_STRUCTURE_DETAILS.md** - Detailed structure and calculations

## Browser Support

Works with all modern browsers:
- ✅ Chrome/Edge (Chromium-based)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

No additional plugins or extensions needed.

---

**Implementation Date**: January 30, 2026
**Status**: ✅ Ready to Use
**Testing Required**: Generate a test report to verify
