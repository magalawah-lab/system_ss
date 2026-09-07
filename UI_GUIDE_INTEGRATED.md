# 📊 Report Card Builder - Integrated UI Guide

## New Layout Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     REPORT CARD BUILDER                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Class: [Senior 3 ▼]    Stream: [Stream A ▼]                      │
│                                                                     │
├──────────────────────────┬──────────────────────────────────────────┤
│                          │                                          │
│  STUDENTS IN S3 A        │  REPORT PREVIEW                         │
│  ────────────────────    │  ──────────────────────────────────     │
│                          │                                          │
│  ◻ 1. John Doe          │  Selected: John Doe                     │
│  ◻ 2. Jane Smith         │  Class: S3 A                            │
│ ▣ 3. Bob Johnson ✓ ◄───┤                                          │
│  ◻ 4. Alice Brown        │  ┌────────────────────────────────────┐ │
│  ◻ 5. Charlie Davis      │  │ BUSAANA SECONDARY SCHOOL           │ │
│  ◻ 6. Eve Williams       │  │ End of Term Assessment Report 2026 │ │
│  ◻ 7. Frank Martinez     │  │                                    │ │
│  ◻ 8. Grace Lee          │  │ Name: Bob Johnson                  │ │
│  ◻ 9. Henry Brown        │  │ Class: S3 A                        │ │
│  ...                     │  │ Term: Term 2, 2026                 │ │
│                          │  │                                    │ │
│  [View Report]           │  │ [Mini Table Preview]               │ │
│  [Print Reports]  ◄─────┼─►│ Subject │C1│C2│20%│80%│100%│Grade│ │
│                          │  │ Math    │ 2│ 3│ 17│ 65│ 82 │ A   │ │
│                          │  │ English │ 3│ 2│ 17│ 72│ 89 │ A   │ │
│                          │  │ Physics │ 2│ 2│ 13│ 58│ 71 │ B   │ │
│                          │  │ ...                                │ │
│                          │  │                                    │ │
│                          │  │ ✓ Ready to generate and print     │ │
│                          │  └────────────────────────────────────┘ │
│                          │                                          │
└──────────────────────────┴──────────────────────────────────────────┘

Legend:
  ◻ = Unselected student
  ▣ = Selected student (highlighted)
```

---

## Print Dialog

```
┌─────────────────────────────────────────────┐
│                                             │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│  ┃  Print Reports                     ┃ │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                             │
│  Choose what to print for S3 A:            │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │ ► Current Report                    │  │
│  │   Print report for Bob Johnson      │  │
│  └─────────────────────────────────────┘  │
│       ▲ Active (highlighted in blue)       │
│       └─ Disabled if no student selected   │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │ ► All Reports                       │  │
│  │   Print all 12 student reports      │  │
│  └─────────────────────────────────────┘  │
│       ▲ Always active if class selected    │
│       └─ Shows total student count         │
│                                             │
│                 [Cancel]                   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Button States

### View Report Button
```
Normal (Enabled):
┌──────────────────┐
│ View Report      │ ← Blue background
└──────────────────┘

Disabled:
┌──────────────────┐
│ View Report      │ ← Gray background
└──────────────────┘
```

### Print Reports Button
```
Active:
┌──────────────────┐
│ Print Reports    │ ← Green background
└──────────────────┘

Disabled (no students):
┌──────────────────┐
│ Print Reports    │ ← Gray background
└──────────────────┘
```

---

## Responsive Behavior

### Desktop (1024px+) - 3 Column Layout
```
┌─────────────────────────────────────┐
│   Info Box                          │
├────────┬────────────────────────────┤
│        │                            │
│  List  │    Preview                 │
│  1/3   │    2/3                     │
│        │                            │
│        │                            │
└────────┴────────────────────────────┘
```

### Tablet (768px) - Still 3 Columns (Narrower)
```
┌──────────────────────────────┐
│   Info Box                   │
├────────┬─────────────────────┤
│  List  │    Preview          │
│  1/3   │    2/3              │
│        │                     │
└────────┴─────────────────────┘
```

### Mobile (<768px) - Single Column
```
┌──────────────────┐
│   Info Box       │
├──────────────────┤
│   Class/Stream   │
├──────────────────┤
│   Student List   │
│   (Scrollable)   │
├──────────────────┤
│   Report Preview │
│   (Below list)   │
└──────────────────┘
```

---

## Student Selection Flow

### Step 1: Initial State
```
No class/stream selected
┌─────────────────────────┐
│ Select a class and      │
│ stream to view student  │
│ reports                 │
└─────────────────────────┘
```

### Step 2: Class/Stream Selected
```
List appears, no student selected
┌─────────────────────────┐
│ 1. John Doe             │
│ 2. Jane Smith           │ ← Click to select
│ 3. Bob Johnson          │
│ ...                     │
└─────────────────────────┘

"Select a student from the list to preview their report"
```

### Step 3: Student Selected
```
List with selection, preview populated
┌──────────────┐  ┌─────────────────┐
│ 1. John      │  │ Selected: John  │
│ 2. Jane      │  │ Class: S3 A     │
│▣3. Bob ✓     │  │                 │
│ 4. Alice     │  │ [Table Preview] │
│ ...          │  │                 │
│              │  │ ✓ Ready         │
└──────────────┘  └─────────────────┘
```

---

## Workflow Diagrams

### Print Current Report Workflow
```
User Interface         Action                 Result
──────────────────────────────────────────────────────

[Select Student]  ──► Check if selected  ──► Student highlighted
                                              in list

[View Report]     ──► Open PDF           ──► Single report opens
                      in new tab              in new browser tab

[Print Reports]   ──► Open dialog        ──► Print dialog shows
                      modal                  2 options

User chooses
"Current Report"  ──► Call              ──► Same PDF opens
                      handlePrintCurrent() 
                      → handleGeneratePDF()   Print dialog opens
                                             in browser

User prints       ──► Send to printer    ──► Single report
                      or "Save as PDF"       printed/saved
```

### Print All Reports Workflow
```
User Interface         Action                 Result
──────────────────────────────────────────────────────

[Print Reports]   ──► Open dialog        ──► Print dialog shows
                      modal                  2 options

User chooses
"All Reports"     ──► Call              ──► Batch print page
                      handlePrintAll()       opens in new tab
                      → Open /print route    (all students)

System processes  ──► Generate           ──► All student reports
                      all reports            rendered with
                      dynamically            page breaks

Browser opens     ──► Auto-opens         ──► Print dialog
print dialog          window.print()         appears

User prints       ──► Send to printer    ──► All reports printed/
                      or "Save as PDF"       saved as one PDF
```

---

## Print Dialog Decision Tree

```
                    ┌─────────────────────┐
                    │  Print Reports      │
                    │   Button Clicked    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Is student        │
                    │  selected?         │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
               YES                           NO
                │                             │
    ┌───────────▼────────────┐    ┌────────────▼──────────┐
    │ Both options enabled   │    │ "Current Report"      │
    │ - Current Report ✓     │    │ option DISABLED       │
    │ - All Reports ✓        │    │ - All Reports ✓       │
    └───────────┬────────────┘    └────────────┬──────────┘
                │                             │
     ┌──────────┴──────────┐    ┌────────────┴──────────┐
     │                     │    │                       │
  Click               Click │    │                    Click
"Current"            "All"  │    │                   "All"
  │                  │      │    │                     │
  ▼                  ▼      │    │                     ▼
Single          Batch Print │    │                 Batch Print
Report          All Students │    │                 All Students
PDF            in new tab   │    │                 in new tab
Opens          Auto-prints  │    │                 Auto-prints
                            │    │
                 ┌──────────┴────┴──┐
                 │   No student    │
                 │   selection     │
                 │   avoids crash  │
                 └─────────────────┘
```

---

## Color Scheme

### UI Elements
```
Text/Borders:
├── Primary: #000 (black)
├── Secondary: #666 (dark gray)
├── Tertiary: #999 (medium gray)
└── Light: #f9f9f9 (light gray)

Backgrounds:
├── Normal: #fff (white)
├── Hover: #f5f5f5 (light gray)
├── Selected: #e3f2fd (light blue)
└── Info: #e3f2fd (light blue)

Buttons:
├── Primary: #2563eb (blue)
├── Success: #16a34a (green)
├── Disabled: #d1d5db (gray)
└── Hover: darker shade

Status Messages:
├── Info: #1e40af (dark blue)
├── Success: #166534 (dark green)
└── Warning: #b45309 (orange)
```

---

## Print Output Visualization

### Current Report (Single)
```
┌─────────────────────────────────┐
│                                 │
│  [REPORT 1 - BOB JOHNSON]       │
│                                 │
│  Full Report Card               │
│  ├── Header                     │
│  ├── Student Info               │
│  ├── Marks Table                │
│  ├── Summary                    │
│  └── Comments                   │
│                                 │
└─────────────────────────────────┘

Output: 1 Page PDF
```

### All Reports (Batch)
```
┌─────────────────────────────────┐
│                                 │
│  [REPORT 1 - JOHN DOE]          │ Page 1
│                                 │
│  Full Report Card               │
├─────────────────────────────────┤
│                                 │
│  [REPORT 2 - JANE SMITH]        │ Page 2
│                                 │
│  Full Report Card               │
├─────────────────────────────────┤
│                                 │
│  [REPORT 3 - BOB JOHNSON]       │ Page 3
│                                 │
│  Full Report Card               │
├─────────────────────────────────┤
│  ... more reports ...           │ Pages 4+
│                                 │
└─────────────────────────────────┘

Output: N Page PDF (one page per student)
```

---

## Accessibility Features

```
Keyboard Navigation:
├── Tab: Move between elements
├── Shift+Tab: Move backward
├── Enter: Activate buttons/links
├── Arrow Keys: Navigate lists
└── Escape: Close dialogs

Screen Reader Support:
├── Buttons labeled clearly
├── Form fields have labels
├── Lists announced properly
└── Dialog roles defined

Color Contrast:
├── Text: WCAG AA compliant
├── Buttons: Sufficient contrast
└── Disabled states: Visible

Mobile Touch:
├── Buttons large enough (44x44px+)
├── Spacing adequate
└── Scroll-friendly lists
```

---

## Performance Indicators

```
Single Report:
┌─────────────────┐
│ ████████████░░░ │ < 1 second
└─────────────────┘

Batch Report (24 students):
┌─────────────────┐
│ ████████░░░░░░░ │ 2-3 seconds
└─────────────────┘

Batch Report (50 students):
┌─────────────────┐
│ ██████░░░░░░░░░ │ 5-6 seconds
└─────────────────┘

Print Dialog:
┌─────────────────┐
│ ██████████████░ │ Instant
└─────────────────┘
```

---

## Error States

### No Students in Stream
```
┌───────────────────────────┐
│ No students in this       │
│ stream                    │
│                           │
│ [Print Reports] DISABLED  │
└───────────────────────────┘
```

### Missing Assessments
```
Report Preview:
┌───────────────────────────┐
│ [Mini Table]              │
│ Subject │—│—│—│—│—│—     │
│ Math    │—│—│—│—│—│—     │
│ English │—│—│—│—│—│—     │
│                           │
│ (Shows dashes, not error) │
└───────────────────────────┘
```

### Network/Server Error
```
┌───────────────────────────┐
│ Report data not found.    │
│                           │
│ Please refresh or try     │
│ selecting different class │
└───────────────────────────┘
```

---

## Summary of Visual Changes

**Old UI:**
- Simple form with dropdowns
- No preview
- Single action button

**New UI:**
- 3-column responsive layout
- Student list sidebar
- Report preview panel
- Print dialog with options
- Better visual feedback
- Clearer workflow
- More professional appearance

**Result**: More intuitive, efficient, and user-friendly! ✨

---

**Created**: January 30, 2026  
**UI Version**: 2.0 (Enhanced with Integration)  
**Status**: Production Ready ✅
