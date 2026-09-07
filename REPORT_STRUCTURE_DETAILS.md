# Report Card Structure Overview

## Report Layout (A4 PDF)

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──┐                                                        │
│  │B │  BUSAANA SECONDARY SCHOOL                             │
│  │  │  Email: busaanass2016@gmail.com                       │
│  └──┘  Contacts: +256(0)703877122                           │
│        Education is the Key to Success                       │
├─────────────────────────────────────────────────────────────┤
│         END OF TERM ASSESSMENT REPORT                        │
│                        2026                                  │
├─────────────────────────────────────────────────────────────┤
│ NAME: John Doe        CLASS: S3 A    TERM: TERM 2, 2026     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ SUBJECT │ C1 │ C2 │ 20% │ 80% │100%│GRADE│COMMENTS│INIT.││
│ ├─────────┼────┼────┼─────┼─────┼────┼─────┼─────────┼─────┤│
│ │Mathematics  2   3   16   65   81   A   Outstanding│JK   ││
│ │English      3   2   16   72   88   A   Excellent  │MN   ││
│ │Physics      2   2   13   58   71   B   Good       │OP   ││
│ │Chemistry    1   2   10   45   55   C   Satisfact. │QR   ││
│ │...                                                       ││
│ └──────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ OVERALL PERFORMANCE: 74% - Grade B                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Class Teacher's Comment:                                    │
│ ___________________________                                  │
│                                                              │
│ Signature: _______________    Date: _______________         │
│                                                              │
│ Head Teacher's Comment:                                     │
│ ___________________________                                  │
│                                                              │
│ Signature: _______________    Date: _______________         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Column Calculations

### C1 Column (Test Score 1)
- **Type**: Direct entry (out of 3)
- **Range**: 0-3
- **Entry**: Manual by teacher

### C2 Column (Test Score 2)
- **Type**: Direct entry (out of 3)
- **Range**: 0-3
- **Entry**: Manual by teacher

### 20% Column
- **Formula**: `((C1 + C2) / 2) / 3 × 20`
- **Calculation Example**:
  - C1 = 2, C2 = 3
  - Average = (2 + 3) / 2 = 2.5
  - Out of 20 = (2.5 / 3) × 20 = 16.67 → rounds to 17

### 80% Column
- **Type**: Direct entry (out of 80)
- **Range**: 0-80
- **Entry**: Manual by teacher
- **Conversion**: No conversion needed (already represents 80%)

### 100% Column
- **Formula**: `20% Column + 80% Column`
- **Calculation Example**:
  - 20% = 17
  - 80% = 65
  - 100% = 17 + 65 = 82

## Grading Scale

Based on 100% Total Score:

| Grade | Range | Comment |
|-------|-------|---------|
| **A** | 80-100 | Excellent performance. Outstanding achievement. |
| **B** | 60-79 | Good performance. Well done. |
| **C** | 40-59 | Satisfactory performance. Keep up the good work. |
| **D** | 20-39 | Fair performance. Needs improvement. |
| **E** | 0-19 | Poor performance. Requires immediate attention. |

## Data Mapping

### Assessment Identification

The system automatically identifies assessments by their names:

```
Assessment Name Pattern → Usage
───────────────────────────────
Contains "C1" (case-insensitive) → C1 Scores
Contains "C2" (case-insensitive) → C2 Scores
Contains "TERM" or "EXAM" or "END" or "80%" → 80% Assessment
maxScore = 80 → 80% Assessment (alternative)
```

### Subject-Specific Scoring

For each subject and student:
1. Look for assessment with matching subject name
2. If `subjectScores[subjectName][studentId]` exists → use it
3. Otherwise → fall back to general `scores[studentId]`
4. If score is null/undefined → treat as 0 in calculations

## Example Data Entry Workflow

### Step 1: Create Assessments

Teacher creates three assessments:
- "C1 - Chapter Test" (maxScore: 3)
- "C2 - Chapter Test" (maxScore: 3)
- "End of Term Exam" (maxScore: 80)

### Step 2: Enter Scores

For each student in each subject:
- Enter C1 score (0-3)
- Enter C2 score (0-3)
- Enter End of Term Exam score (0-80)

Example for Mathematics/Student John:
- C1 = 2
- C2 = 3
- End of Term = 65

### Step 3: Generate Report

System calculates automatically:
- 20% = ((2 + 3) / 2) / 3 × 20 = 16.67 → 17
- 80% = 65 (direct)
- 100% = 17 + 65 = 82
- Grade = A (82 ≥ 80)
- Comment = "Excellent performance. Outstanding achievement."

## Field Visibility

### On Report Card:
- ✓ Student Name
- ✓ Class and Stream
- ✓ Term and Year
- ✓ All Subjects
- ✓ C1, C2, 20%, 80%, 100% Columns
- ✓ Grade for Each Subject
- ✓ Comments for Each Subject
- ✓ Teacher Initials
- ✓ Overall Performance
- ✓ Overall Grade
- ✓ Signature Areas

### Not Visible (Data Used Internally):
- Assessment IDs
- Raw assessment scores
- Calculation intermediate values
- User IDs

## Print Settings

### Recommended Printer Settings:
- **Paper Size**: A4 (210mm × 297mm)
- **Orientation**: Portrait
- **Margins**: 0.5cm all sides
- **Color**: Color (or B&W if needed)
- **Scale**: 100% (No scaling)
- **Background Graphics**: Yes (for grey headers)

### Browser Print Dialog:
1. Press Ctrl+P (Windows) or Cmd+P (Mac)
2. Select "Save as PDF" or physical printer
3. Set margins to minimal (0.5cm)
4. Click "Print"

## Customization Points

If you need to modify the report:

### Change Grading Scale:
File: `pdf/page.tsx` → Function `getGrade()`

### Modify Comments:
File: `pdf/page.tsx` → Function `getComment()`

### Adjust Column Widths:
File: `pdf/page.tsx` → CSS class definitions (`.col-*`)

### Change Assessment Names:
File: `pdf/page.tsx` → Assessment finding logic in `useMemo`

### Update School Info:
File: `pdf/page.tsx` → Hardcoded in JSX
```tsx
<h1>BUSAANA SECONDARY SCHOOL</h1>
<p className="contact-info">Email: busaanass2016@gmail.com</p>
<p className="contact-info">Contacts: +256(0)703877122</p>
<p className="motto">Education is the Key to Success</p>
```

## Known Limitations

1. **No Absences Handling**: Missing scores treated as 0
2. **Fixed Grading Scale**: Cannot be changed via UI
3. **No Multiple Assessments**: System picks first matching assessment
4. **Single Language**: Reports only in English
5. **No Batch Processing**: One report at a time
6. **No Signature Support**: Signature areas for manual filling only
