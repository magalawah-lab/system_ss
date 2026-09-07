# 🔧 Report Card Builder - API & Integration Quick Reference

## File Locations

```
app/
├── reports-and-analytics/
│   ├── page.tsx                           [Main Analytics page with nav]
│   └── report-builder/
│       ├── page.tsx                       [Main builder UI]
│       ├── pdf/
│       │   └── page.tsx                   [Single report PDF generation]
│       └── print/
│           └── page.tsx                   [Batch printing page]
```

---

## Key Functions & Methods

### 1. Report Builder Page (`report-builder/page.tsx`)

#### State Variables
```typescript
const selectedClassIndex = 0;           // Selected class index
const selectedStreamIndex = 0;          // Selected stream index
const selectedStudentId = '';           // Selected student ID
const printPromptOpen = false;          // Print dialog visibility
const printMode = 'current' | 'all';    // Print type
```

#### Main Handlers
```typescript
// View single report
const handleGeneratePDF = (): void

// Open print dialog
const handlePrintPrompt = (): void

// Print current student report
const handlePrintCurrent = (): void

// Print all student reports
const handlePrintAll = (): void

// Select student from list
const handleSelectStudent = (studentId: string): void
```

#### Data Fetching
```typescript
// From useSchoolData context
const classes = schoolData.classes;
const streams = schoolData.streams;
const students = schoolData.students;
const assessments = schoolData.assessments;
const teachers = schoolData.teachers;
```

---

### 2. Single Report PDF (`report-builder/pdf/page.tsx`)

#### URL Parameters
```typescript
const params = useSearchParams();
const classIndex = Number(params.get('classIndex') ?? 0);
const streamIndex = Number(params.get('streamIndex') ?? 0);
const studentId = params.get('studentId') ?? '';
const mode = params.get('mode') ?? 'single';  // 'single' for this page
```

#### Key Functions
```typescript
// Assign grade based on 100% score
function getGrade(mark: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (mark >= 80) return 'A';      // 80-100
  if (mark >= 60) return 'B';      // 60-79
  if (mark >= 40) return 'C';      // 40-59
  if (mark >= 20) return 'D';      // 20-39
  return 'E';                       // 0-19
}

// Auto-comment based on grade
function getComment(grade: 'A' | 'B' | 'C' | 'D' | 'E'): string

// Get teacher initials
function getTeacherInitials(teacherId: string): string

// Generate report data for subject
function generateReportRows(): Array<{
  subject: string;
  c1: number;
  c2: number;
  percentage20: number;
  percentage80: number;
  total: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  comment: string;
}>
```

#### Calculation Formulas
```typescript
// 20% calculation
c1_c2_average = (c1 + c2) / 2;
percentage_20 = (c1_c2_average / 3) * 20;

// 100% total
total = percentage_20 + percentage_80;

// Rounding
Math.round(value * 100) / 100  // 2 decimal places
```

---

### 3. Batch Print Page (`report-builder/print/page.tsx`)

#### URL Parameters
```typescript
const params = useSearchParams();
const classIndex = Number(params.get('classIndex') ?? 0);
const streamIndex = Number(params.get('streamIndex') ?? 0);
// NO studentId - generates all students
const mode = params.get('mode') ?? 'all';  // 'all' for this page
```

#### Logic
```typescript
// Loop through all students in stream
students.forEach(student => {
  // Generate report for each student
  // Apply page-break-after: always
});

// Auto-open print dialog
useEffect(() => {
  window.print();  // Triggers browser print dialog
}, []);
```

#### CSS for Printing
```css
@media print {
  @page {
    size: A4;
    margin: 0.5cm;
  }
  
  .page-break-after {
    page-break-after: always;
  }
}
```

---

## Workflow Diagrams

### URL Navigation Pattern

```
Main Builder Page:
/reports-and-analytics/report-builder
├── classIndex=0
├── streamIndex=0
└── (no studentId initially)

Single Report PDF:
/reports-and-analytics/report-builder/pdf
├── classIndex={selected}
├── streamIndex={selected}
├── studentId={selected}
└── mode=single

Batch Print Page:
/reports-and-analytics/report-builder/print
├── classIndex={selected}
├── streamIndex={selected}
├── mode=all
└── (no studentId)
```

### Data Flow

```
SchoolDataContext
    ↓
[Class Selected] → [Stream Selected]
    ↓                 ↓
[Student List]  [Stream Students]
    ↓
[Student Selected]
    ↓
    ├─→ [View Report] → Opens PDF generation
    └─→ [Print Dialog]
         ├─→ Current → PDF with single student
         └─→ All → Print page with all students
```

---

## Integration Points

### 1. Context Integration
```typescript
import { useSchoolData } from '@/app/context/SchoolDataContext';

// Usage in component
const { schoolData } = useSchoolData();
const classes = schoolData.classes;
```

### 2. Navigation Integration
```typescript
// From app/reports-and-analytics/page.tsx
import Link from 'next/link';

<Link href="/reports-and-analytics/report-builder">
  Report Card Builder
</Link>
```

### 3. Assessment Detection
```typescript
// Automatically finds assessments by naming convention
const c1Assessment = assessments.find(a => 
  a.name.toLowerCase().includes('c1')
);

const percentage80 = assessments.find(a => 
  a.maxScore === 80 || 
  a.name.toLowerCase().includes('end') ||
  a.name.toLowerCase().includes('exam')
);
```

---

## Print Preview Details

### Desktop (1024px+)
```
Left Sidebar (33%):
- Class selector
- Stream selector
- Student list
- View/Print buttons

Right Panel (67%):
- Selected student info
- Mini report preview
- Status indicator
```

### Mobile (<768px)
```
Full Width Stacked:
- Class selector
- Stream selector
- Student list
- Mini report preview
- View/Print buttons
```

---

## Error Handling

### Common Scenarios

#### No Class Selected
```typescript
if (!selectedClassIndex) {
  return <div>Please select a class</div>;
}
```

#### No Stream Selected
```typescript
if (selectedStreamIndex === null) {
  return <div>Please select a stream</div>;
}
```

#### No Students in Stream
```typescript
if (streamStudents.length === 0) {
  return <div>No students in this stream</div>;
}
```

#### No Student Selected (Print)
```typescript
const handlePrintCurrent = () => {
  if (!selectedStudentId) {
    alert('Please select a student first');
    return;
  }
  // Proceed with print
};
```

#### Missing Assessments
```typescript
// Shows dashes in report instead of crashing
const score = assessment ? assessment.score : '-';
```

---

## Performance Optimization

### Memoization
```typescript
const reportRows = useMemo(() => {
  return generateReportRows();
}, [selectedStudentId, assessments]);
```

### Lazy Loading
```typescript
// Student list items rendered with key prop
{streamStudents.map(student => (
  <div key={student.id}>{student.name}</div>
))}
```

### Print Optimization
```typescript
// Page breaks reduce rendering load
<div style={{ pageBreakAfter: 'always' }}>
  {/* Report content */}
</div>
```

---

## Testing Checklist

### Unit Tests
- [ ] `getGrade()` returns correct grades for all ranges
- [ ] `getComment()` returns appropriate comments
- [ ] Score calculations match formula
- [ ] Assessment detection works by name

### Integration Tests
- [ ] Context provides correct data
- [ ] URL parameters pass correctly
- [ ] Student selection updates UI
- [ ] Print dialog opens properly

### UI Tests
- [ ] Responsive layout on all sizes
- [ ] Buttons disabled when appropriate
- [ ] Student list scrolls correctly
- [ ] Preview updates when student changes

### Print Tests
- [ ] Single report prints on 1 page
- [ ] Batch reports print on separate pages
- [ ] Page breaks appear correctly
- [ ] Styles print correctly (no overflow)
- [ ] Headers/footers display properly

### Edge Cases
- [ ] Empty stream handling
- [ ] Missing assessment scores
- [ ] Very long student names
- [ ] Large class sizes (50+ students)
- [ ] Network errors/timeouts

---

## Configuration Options

### Grades & Comments
```typescript
// In PDF generation:
const gradeScale = {
  'A': { min: 80, max: 100, comment: 'Excellent performance' },
  'B': { min: 60, max: 79, comment: 'Good performance' },
  'C': { min: 40, max: 59, comment: 'Satisfactory' },
  'D': { min: 20, max: 39, comment: 'Needs improvement' },
  'E': { min: 0, max: 19, comment: 'Poor performance' },
};
```

### Print Settings
```css
/* A4 Paper sizing */
@page {
  size: A4;           /* 210mm × 297mm */
  margin: 0.5cm;     /* Margins all sides */
}

/* Page breaks */
.page-break-after {
  page-break-after: always;
}

/* Print colors */
@media print {
  body { color: #000; }  /* Black text */
  .no-print { display: none; }
}
```

---

## Future Enhancement Ideas

```
Potential Additions:
├── Email reports directly
├── Digital signatures
├── Comments editing UI
├── Bulk grade import
├── Report filtering
├── Custom columns
├── Multi-term reports
├── Performance trends
├── Export to Excel
└── Report templates
```

---

## Related Files to Review

```
Supporting Files:
├── app/context/SchoolDataContext.tsx    [Data provider]
├── app/context/AuthContext.tsx          [Auth provider]
├── app/components/Navigation.tsx        [Navigation bar]
├── app/globals.css                      [Global styles]
└── next.config.ts                       [Next.js config]

Similar Features:
├── app/reports-and-analytics/assessments.tsx     [Reference pattern]
├── app/reports-and-analytics/assessments/page.tsx [Print reference]
└── app/student-management/page.tsx               [Data structure reference]
```

---

## Deployment Checklist

- [ ] All files created/updated
- [ ] No console errors
- [ ] Responsive design tested
- [ ] Print output verified
- [ ] Performance acceptable
- [ ] Error handling working
- [ ] Navigation working
- [ ] Data loading correctly
- [ ] Calculations verified
- [ ] Comments displaying
- [ ] Grades assigning correctly
- [ ] Batch printing working
- [ ] Single printing working
- [ ] Mobile layout working
- [ ] Documentation complete

---

**Document Version**: 1.0  
**Last Updated**: January 30, 2026  
**Created For**: Report Card Builder - Phase 2 Integration  
**Status**: ✅ Complete & Ready for Reference
