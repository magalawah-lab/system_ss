# Report Card Builder Implementation Guide

## Overview
A comprehensive Report Card Builder feature has been integrated into the analytics section of the school management system. This allows teachers and administrators to generate professional PDF report cards for individual students.

## Features Implemented

### 1. Report Builder Page
**Location:** `/reports-and-analytics/report-builder`

#### Functionality:
- **Class Selection**: Choose from all available classes
- **Stream Selection**: Select the appropriate stream within the class
- **Student Selection**: Pick individual students for report generation
- **Report Generation**: Generate PDF report cards with a single click

#### UI Components:
- Dropdown selectors for intuitive navigation
- Information box explaining the report structure
- Real-time availability indicator showing which student is ready for PDF generation
- Back navigation to main analytics page

### 2. Report Card PDF Page
**Location:** `/reports-and-analytics/report-builder/pdf`

#### Report Card Layout & Design:
The PDF report includes the following sections:

**A. Header Section:**
- School logo placeholder (60x60px box with "B")
- School name: BUSAANA SECONDARY SCHOOL
- Contact information (email and phone)
- School motto: "Education is the Key to Success"

**B. Report Title:**
- END OF TERM ASSESSMENT REPORT
- Current year

**C. Student Information:**
- Student name
- Class and stream
- Term and year

**D. Marks Table with Columns:**

| Column | Description | Calculation |
|--------|-------------|-------------|
| **Subject** | Subject name | Direct from curriculum |
| **C1** | Test score out of 3 | Direct entry |
| **C2** | Test score out of 3 | Direct entry |
| **20%** | Converted average score | Formula: ((C1 + C2) / 2) / 3 × 20 |
| **80%** | Assessment score | Entered directly (out of 80) |
| **100%** | Total percentage | 20% + 80% |
| **Grade** | Letter grade | Based on 100% score |
| **Comments** | Performance remarks | Based on grade |
| **T. Initials** | Teacher initials | From teacher database |

**E. Grading Scale:**
- **A** (80-100%): Excellent performance. Outstanding achievement.
- **B** (60-79%): Good performance. Well done.
- **C** (40-59%): Satisfactory performance. Keep up the good work.
- **D** (20-39%): Fair performance. Needs improvement.
- **E** (0-19%): Poor performance. Requires immediate attention.

**F. Summary Section:**
- Overall performance percentage
- Overall grade

**G. Comments Section:**
Two comment boxes with signature lines:
1. Class Teacher's Comment
2. Head Teacher's Comment

Each includes spaces for:
- Teacher comment/remark
- Signature line
- Date line

### 3. Score Calculation Logic

#### 20% Column Calculation:
```
20% = ((C1 + C2) / 2) / 3 × 20
```
- Takes average of C1 and C2 (both out of 3)
- Normalizes to a 20-point scale
- Rounded to nearest integer for display

#### 80% Column:
- Entered directly as an assessment score (typically out of 80)
- Rounded to nearest integer for display

#### 100% Column:
```
100% = 20% Column + 80% Column
```
- Simple sum of the two percentages
- Represents total performance score

### 4. Data Integration

#### Assessment Mapping:
The system automatically identifies assessments by name:
- **C1 Assessment**: Named with "C1" (case-insensitive)
- **C2 Assessment**: Named with "C2" (case-insensitive)
- **80% Assessment**: 
  - Has maxScore of 80, OR
  - Named with "TERM", "EXAM", "END", or "80%"

#### Subject-Specific Scores:
- Uses `subjectScores` from assessments when available
- Falls back to general scores if subject-specific scores aren't recorded
- Supports both formats seamlessly

### 5. Navigation Integration

#### Main Analytics Page:
Updated `/reports-and-analytics/page.tsx` with:
- Navigation tabs showing:
  - Assessment Reports (current tab)
  - Report Card Builder (new tab)
- Quick access link to report builder
- Maintains existing assessment reporting functionality

### 6. Print Optimization

#### Print Styles:
- A4 page format (210mm × 297mm)
- Professional styling with:
  - 10mm padding
  - Proper borders and spacing
  - Readable font sizes (11-12pt for body text)
  - Print-friendly colors and backgrounds

#### Print Features:
- Auto-opens print dialog when PDF page loads
- Prevents unwanted page breaks in tables
- Removes digital UI elements in print mode
- Optimized margins for A4 paper

## Files Created

1. **[app/reports-and-analytics/report-builder/page.tsx](app/reports-and-analytics/report-builder/page.tsx)**
   - Main report builder interface
   - Class, stream, and student selection
   - PDF generation trigger

2. **[app/reports-and-analytics/report-builder/pdf/page.tsx](app/reports-and-analytics/report-builder/pdf/page.tsx)**
   - PDF report card generation and display
   - Complete report layout and styling
   - Score calculations and grading logic

3. **Modified: [app/reports-and-analytics/page.tsx](app/reports-and-analytics/page.tsx)**
   - Added Link import from next/link
   - Added navigation tabs
   - Added link to report builder

## Usage Instructions

### Generating a Report Card:

1. Navigate to **Reports & Analytics > Report Card Builder**
2. Select the desired **Class**
3. Select the **Stream** within that class
4. Select the **Student** from the dropdown
5. Click **"Generate Report PDF"** button
6. The report will open in a new tab
7. Print dialog will automatically appear
8. Review and print to PDF or physical printer

### System Requirements:

- All students must be added to their respective streams
- C1 and C2 assessments must exist and be named with "C1" and "C2"
- 80% assessment must either:
  - Have maxScore set to 80, OR
  - Be named containing "TERM", "EXAM", "END", or "80%"
- Teachers must have initials set in their profile for display on report card

### Data Entry:

- **For C1 and C2**: Enter scores out of 3
- **For 80%**: Enter scores out of 80
- Leave scores as null if student was absent or didn't take assessment
- System handles missing values gracefully (treats as 0 in calculations)

## Technical Details

### Technologies Used:
- **Next.js 16**: App router and server/client components
- **React 19**: UI components and state management
- **TailwindCSS**: Styling (for builder page)
- **CSS-in-JS**: Inline styles and styled JSX (for PDF page)
- **Browser Print API**: PDF generation and printing

### Data Flow:
1. User selects class/stream/student in builder page
2. URL parameters passed to PDF page
3. PDF page fetches data from SchoolDataContext
4. Calculations performed in useMemo hooks
5. Report rendered with CSS Grid/Table layout
6. Print dialog triggered automatically

### Performance Considerations:
- Uses useMemo for expensive calculations
- Lazy loading of student list
- Efficient DOM structure for printing
- Minimal re-renders through proper dependency tracking

## Future Enhancements

Potential improvements for future versions:
1. Email report cards directly to parents
2. Store generated reports in database for archive
3. Bulk report generation for entire class
4. Customizable comment templates
5. Signature capture for teachers
6. Multi-term comparison reports
7. Export to Excel format
8. Student portal to view own reports
9. Progress tracking over multiple terms
10. Customizable grading scales and weightings

## Troubleshooting

### Report Shows Blank Scores:
- Verify assessments are named correctly (C1, C2, TERM/EXAM/END)
- Check that scores have been entered for the student
- Ensure the student is assigned to the stream with subjects

### Grades Not Appearing:
- Check that assessment names match the system conventions
- Verify C1 and C2 assessments have maxScore of 3 (or can be converted)
- Ensure 80% assessment exists and has scores entered

### Print Dialog Not Appearing:
- May be blocked by browser settings
- Try manually pressing Ctrl+P or Cmd+P
- Check browser console for any errors

### Column Calculations Wrong:
- Verify assessment mapping is correct
- Check score values in assessments
- Clear browser cache and reload
- Verify teacher has entered scores correctly

## Support

For issues or questions about the Report Card Builder:
1. Check that all assessments are properly named and configured
2. Verify student data is complete in the system
3. Ensure teachers have entered all required scores
4. Contact system administrator for data reconciliation issues
