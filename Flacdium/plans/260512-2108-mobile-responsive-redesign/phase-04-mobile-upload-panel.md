# Phase 4: Mobile Upload Panel

## Context Links
- Parent: [plan.md](./plan.md)
- Files: `app/templates/index.html`, `app/static/styles.css`, `app/static/app.js`

## Overview
**Priority:** Medium | **Status:** Pending

Redesign upload panel để form mobile-friendly, large touch targets, progress indication tốt.

## Key Insights
- Upload form không mobile-optimized
- File inputs khó select trên mobile
- Progress bar không clear
- Validation feedback không visible
- Upload button quá nhỏ cho touch

## Requirements
### Functional
- Simplified upload form mobile
- Large file selection touch targets
- Clear progress indication
- Inline validation feedback
- Error states visible
- Keep original desktop behavior

### Non-Functional
- Drag-drop mobile support
- File type indicators rõ ràng
- Upload cancellation support
- Progress estimation
- Performance uploads

## Architecture

### Mobile Upload Form Structure
```
Upload Panel
├── Header (Title + Progress)
├── Form
│   ├── File Selection (48px touch targets)
│   │   ├── FLAC Input (stacked)
│   │   └── ZIP Input (stacked)
│   ├── Rights Checkbox (48px)
│   └── Submit Button (48px)
└── Footer
    ├── Limits Info (compact)
    └── Requirements (collapsible)
```

### Desktop Upload Form Structure
**Giữ nguyên:** Original 3-column layout

## Related Code Files

### Files to Modify
- `app/templates/index.html` - Upload form structure
- `app/static/styles.css` - Upload styling
- `app/static/app.js` - Upload progress enhancement

### Files to Create
- None

### Files to Delete
- None

## Implementation Steps

### Step 1: Form Layout
1. Stack file inputs vertically (mobile)
2. Increase touch target sizes (48px minimum)
3. Simplified label/input structure
4. Collapsible requirements section
5. Compact header with progress

### Step 2: File Inputs
1. Custom file picker styling
2. Large touch areas
3. File type indicators
4. Selected file names display
5. Clear/remove buttons

### Step 3: Progress Indication
1. Inline progress bar
2. Percentage display
3. Current file name
4. Time remaining estimate
5. Error status indicators

### Step 4: Validation Feedback
1. Inline error messages
2. Real-time validation
3. Field-level error indicators
4. Success confirmation
5. Retry mechanism

### Step 5: Touch Optimizations
1. Prevent zoom on focus
2. Prevent scroll on inputs
3. Visual press feedback
4. Long-press context menus
5. Swipe gestures (nếu có thể)

## Todo List
- [ ] Update upload form HTML
- [ ] Add mobile-specific styling
- [ ] Implement file picker enhancements
- [ ] Add progress indicators
- [ ] Create validation feedback
- [ ] Test upload flow on mobile
- [ ] Verify desktop unchanged

## Success Criteria
- Form fits mobile viewport
- Touch targets ≥ 48px
- File selection works smoothly
- Progress updates in real-time
- Errors clear and actionable
- Desktop form unchanged
- Upload speed không giảm

## Risk Assessment

### Potential Issues
- File picker browser limitations
- Progress sync delay
- Network interruption handling
- File size validation conflicts

### Mitigation Strategies
- Fallback to native file picker
- Optimistic progress updates
- Robust error handling
- Client-side validation

## Security Considerations
- File type validation (client + server)
- CSRF token maintenance
- File size limits enforcement
- Rights confirmation tracking
- Virus scan integration (nếu có)

## Next Steps
- Dependencies: Phase 3 (track list)
- Follow-up: Phase 5 - Mobile Quick Find
- Testing: Test upload flow trước khi tiếp tục
