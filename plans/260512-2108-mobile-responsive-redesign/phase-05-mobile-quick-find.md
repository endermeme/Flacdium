# Phase 5: Mobile Quick Find

## Context Links
- Parent: [plan.md](./plan.md)
- Files: `app/templates/index.html`, `app/static/styles.css`

## Overview
**Priority:** Medium | **Status:** Pending

Redesign quick find popup để form mobile-friendly, compact results, pagination cho sections.

## Key Insights
- Quick find form inputs quá nhỏ
- Results scroll không efficient
- Pagination unclear cho sections
- Close button difficult to tap
- Form fields cramped trên mobile

## Requirements
### Functional
- Compact form layout mobile
- Section-based results với prev/next
- Touch-friendly input fields (44px)
- Large close/dismiss buttons
- Keyboard shortcuts maintained
- Keep original desktop behavior

### Non-Functional
- Touch feedback on inputs
- Smooth overlay transitions
- Loading states cho search
- Result highlighting
- Performance < 200ms

## Architecture

### Mobile Quick Find Structure
```
Quick Find Overlay
├── Card (mobile-sized)
│   ├── Header
│   │   ├── Title
│   │   └── Close Button (44px)
│   ├── Form (Compact)
│   │   ├── Track Search
│   │   ├── Artist Search
│   │   ├── Album Search
│   │   └── Uploader Search
│   └── Results Grid
│       ├── Section: Artists (5 items + pager)
│       ├── Section: Albums (5 items + pager)
│       └── Section: Uploaders (5 items + pager)
```

### Desktop Quick Find Structure
**Giữ nguyên:** Original 4-column grid layout

## Related Code Files

### Files to Modify
- `app/templates/index.html` - Quick find popup
- `app/static/styles.css` - Quick find styling

### Files to Create
- None

### Files to Delete
- None

## Implementation Steps

### Step 1: Form Layout
1. Stack search fields vertically (mobile)
2. Increase input touch targets (44px)
3. Simplified labels
4. Compact submit buttons
5. Optimize spacing

### Step 2: Results Display
1. Section-based layout ( Artists/Albums/Uploaders)
2. Max 5 items per section visible
3. Compact list items styling
4. Prev/Next buttons cho sections
5. "X more" indicators

### Step 3: Input Enhancements
1. Touch-friendly input sizing
2. Placeholder text optimization
3. Focus states visible
4. Autocomplete (nếu applicable)
5. Keyboard accessibility

### Step 4: Navigation UX
1. Section switching easy
2. Clear pagination info
3. Disabled states rõ ràng
4. "Load more" indicators
5. Keyboard navigation support

### Step 5: Mobile Optimization
1. Overlay sizing (90% viewport max)
2. Scroll optimization
3. Touch feedback
4. Performance loading
5. Accessibility improvements

## Todo List
- [ ] Update quick find HTML structure
- [ ] Add section pagination
- [ ] Create mobile form layout
- [ ] Add compact results styling
- [ ] Implement input enhancements
- [ ] Test search functionality
- [ ] Verify desktop unchanged

## Success Criteria
- Form inputs ≥ 44px height
- 5 results visible per section
- Pagination functional
- Search works smoothly
- Overlay fits mobile viewport
- Desktop search unchanged
- Response time < 200ms

## Risk Assessment

### Potential Issues
- Search performance với large datasets
- Pagination complexity
- Mobile keyboard covering inputs
- Section switching UX

### Mitigation Strategies
- Debounced search input
- Simple pagination logic
- Prevent keyboard overlap
- Clear section boundaries

## Security Considerations
- Search input sanitization
- XSS prevention trong results
- CSRF token maintenance
- Rate limiting enforcement
- Query parameter validation

## Next Steps
- Dependencies: Phase 4 (upload panel)
- Follow-up: Phase 6 - Touch Interactions & Animations
- Testing: Test quick find trước khi tiếp tục
