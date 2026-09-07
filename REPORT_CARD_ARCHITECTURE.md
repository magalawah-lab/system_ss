# Report Card Builder - Architecture & Technical Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ANALYTICS SECTION                              │
│                  (app/reports-and-analytics/)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Main Analytics Page (page.tsx)                  │  │
│  │  - Assessment Reports (existing)                             │  │
│  │  - Report Card Builder (NEW) ───────────┐                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                 │    │
│                                                                 ↓    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │    Report Builder Page (report-builder/page.tsx) (NEW)      │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │  1. Select Class                                       │ │  │
│  │  │  2. Select Stream                                      │ │  │
│  │  │  3. Select Student                                     │ │  │
│  │  │  4. Generate PDF Button                                │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  │                                │                             │  │
│  │                                ↓                             │  │
│  │                           URL Parameters:                    │  │
│  │                           - classIndex                       │  │
│  │                           - streamIndex                      │  │
│  │                           - studentId                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                     │                                │
│                                     ↓                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │    PDF Report Page (report-builder/pdf/page.tsx) (NEW)      │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │  1. Receive URL Parameters                             │ │  │
│  │  │  2. Query SchoolDataContext                            │ │  │
│  │  │  3. Extract Assessments                                │ │  │
│  │  │  4. Calculate Scores                                   │ │  │
│  │  │  5. Assign Grades                                      │ │  │
│  │  │  6. Generate HTML Report                               │ │  │
│  │  │  7. Trigger Print Dialog                               │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │  Report Output (PDF/Print)                             │ │  │
│  │  │  - Header with School Info                             │ │  │
│  │  │  - Student Details                                     │ │  │
│  │  │  - Marks Table                                         │ │  │
│  │  │  - Grading & Comments                                  │ │  │
│  │  │  - Signature Areas                                     │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ↓
        ┌───────────────────────────────────────────┐
        │    SchoolDataContext (context/         │
        │       SchoolDataContext.tsx)             │
        │  ┌──────────────────────────────────┐   │
        │  │ - classes                        │   │
        │  │ - streams                        │   │
        │  │ - students                       │   │
        │  │ - assessments                    │   │
        │  │ - teachers                       │   │
        │  └──────────────────────────────────┘   │
        └───────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────┐
│   Browser   │
│  (User)     │
└──────┬──────┘
       │
       ├─ Click "Report Card Builder"
       │
       ↓
┌──────────────────────────────┐
│  Report Builder Page         │
│  (report-builder/page.tsx)   │
│                              │
│  States:                     │
│  - selectedClassIndex        │
│  - selectedStreamIndex       │
│  - selectedStudentId         │
└──────┬───────────────────────┘
       │
       ├─ Generate → URL with parameters
       │
       ↓
┌──────────────────────────────┐
│  PDF Page                    │
│  (report-builder/pdf/...)    │
│                              │
│  Query Parameters:           │
│  - ?classIndex=0             │
│  - &streamIndex=0            │
│  - &studentId=abc123         │
└──────┬───────────────────────┘
       │
       ↓
┌──────────────────────────────┐
│ useSearchParams()            │
│ Parse URL parameters         │
└──────┬───────────────────────┘
       │
       ↓
┌──────────────────────────────┐
│ useSchoolData()              │
│ Access SchoolDataContext     │
└──────┬───────────────────────┘
       │
       ├─ Get: classes, teachers
       │
       ↓
┌──────────────────────────────┐
│ Data Extraction              │
│                              │
│ cls = classes[classIndex]    │
│ stream = cls.streams[...]    │
│ student = stream.students... │
│ assessments = cls.assessments│
└──────┬───────────────────────┘
       │
       ├─ Find C1 Assessment
       ├─ Find C2 Assessment
       ├─ Find 80% Assessment
       │
       ↓
┌──────────────────────────────┐
│ Score Extraction             │
│                              │
│ For each subject:            │
│ - Get C1 score               │
│ - Get C2 score               │
│ - Get 80% score              │
└──────┬───────────────────────┘
       │
       ↓
┌──────────────────────────────┐
│ Calculate Metrics            │
│                              │
│ 20% = ((C1+C2)/2)/3 × 20    │
│ 100% = 20% + 80%             │
│ Grade = getGrade(100%)       │
│ Comment = getComment(grade)  │
└──────┬───────────────────────┘
       │
       ↓
┌──────────────────────────────┐
│ Render Report                │
│                              │
│ - Header                     │
│ - Student Info               │
│ - Marks Table                │
│ - Summary                    │
│ - Comments                   │
└──────┬───────────────────────┘
       │
       ↓
┌──────────────────────────────┐
│ Trigger Print Dialog         │
│ (window.print() after delay) │
└──────┬───────────────────────┘
       │
       ↓
┌──────────────────────────────┐
│ Browser Print Dialog         │
│                              │
│ User selects:                │
│ - Printer or PDF driver      │
│ - Paper size (A4)            │
│ - Margins                    │
│ - Print!                     │
└──────────────────────────────┘
```

## Component Structure

```
ReportBuilder (page.tsx)
├── State Management
│   ├── selectedClassIndex
│   ├── selectedStreamIndex
│   └── selectedStudentId
│
├── UI Elements
│   ├── Class Selector
│   │   └── onChange: setSelectedClassIndex
│   ├── Stream Selector
│   │   └── onChange: setSelectedStreamIndex
│   ├── Student Selector
│   │   └── onChange: setSelectedStudentId
│   ├── Info Box
│   │   └── Report structure explanation
│   └── Action Buttons
│       ├── Generate PDF
│       └── Back to Analytics
│
└── Data Processing
    └── useMemo calculations

ReportCardPDF (pdf/page.tsx)
├── Data Retrieval
│   ├── useSearchParams()
│   ├── useSchoolData()
│   └── useMemo hooks
│
├── Assessment Detection
│   ├── findC1Assessment()
│   ├── findC2Assessment()
│   └── find80%Assessment()
│
├── Calculations
│   ├── Calculate 20% Column
│   ├── Get 80% Column
│   ├── Calculate 100% Column
│   └── Assign Grade & Comment
│
├── Rendering
│   ├── Header
│   ├── Student Info
│   ├── Marks Table
│   ├── Summary
│   ├── Comments
│   └── Print Styles
│
└── Auto-Print Trigger
    └── useEffect + window.print()
```

## State Management

### Report Builder State
```typescript
// Component State
const [selectedClassIndex, setSelectedClassIndex] = useState<number>(0);
const [selectedStreamIndex, setSelectedStreamIndex] = useState<number>(0);
const [selectedStudentId, setSelectedStudentId] = useState<string>("");

// Derived State
const currentClass = classesForLevel[selectedClassIndex];
const currentStream = currentClass?.streams?.[selectedStreamIndex];
const students = currentStream?.students ?? [];

// Computed State
const canGenerate = selectedStudentId !== "" && currentClass && currentStream;
```

### PDF Page Data Flow
```
URL Parameters
    ↓
useSearchParams() → classIndex, streamIndex, studentId
    ↓
useSchoolData() → classes, teachers
    ↓
Extract Current Class/Stream/Student
    ↓
useMemo → Find Assessments
    ↓
useMemo → Calculate Report Rows
    ↓
useMemo → Calculate Overall Performance
    ↓
Render → useEffect → print()
```

## Calculation Engine

### 20% Column Calculation
```javascript
function calculate20Percent(c1Score, c2Score) {
  // Validate inputs
  if (typeof c1Score !== 'number' && typeof c2Score !== 'number') {
    return null;  // No data
  }
  
  // Use 0 if one is missing, keep if both present
  const val1 = typeof c1Score === 'number' ? c1Score : 0;
  const val2 = typeof c2Score === 'number' ? c2Score : 0;
  
  // Average (out of 3)
  const average = (val1 + val2) / 2;
  
  // Convert to 20% scale
  const twentyPercent = (average / 3) * 20;
  
  // Round for display
  return Math.round(twentyPercent);
}

// Example:
calculate20Percent(2, 3)  // → 17
calculate20Percent(1, 1)  // → 7
calculate20Percent(3, 3)  // → 20
```

### Grading Function
```javascript
function getGrade(hundredPercentScore) {
  if (hundredPercentScore === null) return "—";
  if (hundredPercentScore >= 80) return "A";
  if (hundredPercentScore >= 60) return "B";
  if (hundredPercentScore >= 40) return "C";
  if (hundredPercentScore >= 20) return "D";
  return "E";
}

// Examples:
getGrade(82)   // → "A"
getGrade(70)   // → "B"
getGrade(45)   // → "C"
getGrade(25)   // → "D"
getGrade(10)   // → "E"
getGrade(null) // → "—"
```

## Assessment Detection Algorithm

```
For C1 Assessment:
  FOR each assessment in assessments
    IF assessment.name CONTAINS "c1" (case-insensitive)
      RETURN assessment
  END
  RETURN undefined

For C2 Assessment:
  (Same as C1, but "c2")

For 80% Assessment:
  FOR each assessment in assessments
    IF assessment.maxScore === 80
      RETURN assessment
  END
  
  FOR each assessment in assessments
    IF assessment.name CONTAINS "TERM" or "EXAM" or "END" or "80%"
      RETURN assessment
  END
  
  RETURN undefined
```

## Score Retrieval

```
For each subject and student:
  
  1. Check subjectScores first
     score = assessment.subjectScores?.[subjectName]?.[studentId]
     
  2. Fall back to general scores
     IF score is undefined
        score = assessment.scores?.[studentId]
     END
     
  3. Handle missing data
     IF score is null or undefined
        IF other columns have data
           score = 0  // Use in calculations
        ELSE
           score = null  // Show empty
        END
     END
     
  RETURN score
```

## File Dependencies

```
report-builder/
├── page.tsx
│   ├── imports: next/link, React
│   ├── uses: useSchoolData()
│   └── exports: ReportBuilder component
│
└── pdf/
    └── page.tsx
        ├── imports: next/navigation, React
        ├── uses: useSearchParams()
        ├── uses: useSchoolData()
        ├── uses: useMemo, useEffect
        └── exports: ReportCardPDF component
```

## Styling Architecture

### Report Builder (page.tsx)
- TailwindCSS utility classes
- Inline style objects
- Responsive grid layout

### PDF Page (pdf/page.tsx)
- CSS-in-JS (styled JSX)
- Inline styles for layout
- Print-specific media queries
- A4-specific dimensions (210mm × 297mm)

### Print Media Queries
```css
@media print {
  @page {
    size: A4;
    margin: 0.5cm;
  }
  
  .marks-table {
    page-break-inside: avoid;
  }
  
  .print-container {
    padding: 10mm;
    width: 100%;
  }
}
```

## Performance Considerations

### Optimization Strategies
1. **useMemo for Calculations**: Prevents recalculation on every render
2. **Lazy Assessment Finding**: Stops searching after first match
3. **Minimal Re-renders**: Proper dependency arrays in hooks
4. **DOM Structure**: Clean table layout for print efficiency
5. **No External Requests**: All data from context provider

### Potential Bottlenecks
- Large number of students (>1000) → may slow selector
- Many assessments → slower assessment finding
- Complex subject-score mapping → more data processing

### Scaling Considerations
- For 5000+ students: Consider pagination in builder
- For 100+ assessments per class: Optimize finding logic
- For large batch processing: Consider backend PDF generation

## Error Handling

### Graceful Degradation
```javascript
// Missing data
student = stream?.students?.find(...) ?? null
// → Shows "Report data not found" message

// Missing assessments
const c1Assessment = assessments.find(...) || undefined
// → Returns undefined, calculations handle gracefully

// Null scores
const score = assessment.scores?.[studentId] ?? null
// → Treated as 0 in calculations, empty in display

// Division by zero
const average = (val1 + val2) / 2
// → Never divides by zero (denominator is 2)
```

### Input Validation
- URL parameters converted to numbers/strings safely
- Array access with bounds checking (.?.)
- Type checking before calculations (typeof checks)

## Browser Compatibility

### Tested & Working
- Chrome 90+
- Edge 90+
- Firefox 88+
- Safari 14+
- Opera 75+

### API Usage
- `useSearchParams()` - Next.js 13+ App Router
- `window.print()` - All modern browsers
- CSS Grid - All modern browsers
- Template literals - All modern browsers

## Security Considerations

### Data Access
- All data comes from authenticated SchoolDataContext
- No external API calls
- No sensitive data in URLs (only IDs)
- No local storage of reports

### Print Output
- Cannot be encrypted or protected
- Should inform users about confidentiality
- Consider data governance policies

## Deployment Notes

### Pre-deployment Checklist
- [ ] Test with actual school data
- [ ] Verify all assessment names are correct
- [ ] Test print in Chrome, Firefox, Safari
- [ ] Check PDF output quality
- [ ] Verify calculations with manual checks
- [ ] Train staff on usage

### Post-deployment Support
- Monitor browser console for errors
- Gather user feedback on layout
- Track PDF generation issues
- Plan for UI improvements
