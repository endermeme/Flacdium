# Phase 2: Mobile Navigation System

## Context Links
- Parent: [plan.md](./plan.md)
- Files: `app/templates/index.html`, `app/static/styles.css`

## Overview
**Priority:** High | **Status:** Pending

Redesign navigation để Artists/Albums/Uploaders có prev/next buttons gọn, không che nội dung.

## Key Insights
- Scroll không hiệu quả trên mobile
- Buttons hiện tại quá lớn (36px min-height)
- Pagination không rõ ràng cho sections
- Không có active states cho sections

## Requirements
### Functional
- Prev/Next buttons cho từng section
- Compact button sizing (28px min-height)
- Page info display
- Section switching dễ dàng
- Keep original scroll behavior trên desktop

### Non-Functional
- Touch-friendly interactions
- Smooth transitions
- Loading states
- Disabled states rõ ràng
- Performance < 150ms

## Architecture

### Mobile Navigation Structure
```
Mobile Panel
├── Header (Title + Close)
├── Stack (Scrollable)
│   ├── Section: Artists
│   │   ├── Items (max 5 visible)
│   │   └── Pager (Prev/Page/Next)
│   ├── Section: Albums
│   │   ├── Items (max 5 visible)
│   │   └── Pager (Prev/Page/Next)
│   └── Section: Uploaders
│       ├── Items (max 5 visible)
│       └── Pager (Prev/Page/Next)
└── Footer
    ├── Language Switch
    └── Account Info
```

### Desktop Navigation Structure
**Giữ nguyên:** Scroll-based sidebar với full items

## Related Code Files

### Files to Modify
- `app/templates/index.html` - Mobile panel structure
- `app/static/styles.css` - Navigation styling

### Files to Create
- None

### Files to Delete
- None

## Implementation Steps

### Step 1: Structure Update
1. Simplify mobile panel sections
2. Add prev/next buttons cho từng section
3. Limit items per section (5-10 max)
4. Compact pagination display

### Step 2: Button Styling
1. Reduce button size (28px vs 36px)
2. Minimize padding (4px vs 6px)
3. Reduce font size (10px vs 11px)
4. Ensure 44px touch targets overall

### Step 3: Layout Optimization
1. Vertical stacking cho mobile
2. Compact spacing (4-8px gaps)
3. Max-height sections với scroll
4. Prevent content overflow

### Step 4: Pagination Logic
1. Page info display (1/5, 2/5, etc.)
2. Disabled states cho first/last pages
3. URL generation cho page changes
4. Preserve current filters

### Step 5: Interaction Design
1. Active states cho current section
2. Hover/active feedback cho buttons
3. Touch press effects
4. Smooth transitions

## Todo List
- [ ] Update mobile panel HTML structure
- [ ] Add prev/next button HTML
- [ ] Reduce button sizes in CSS
- [ ] Add pagination info display
- [ ] Implement button styling
- [ ] Test navigation flow
- [ ] Verify desktop unaffected

## Success Criteria
- Buttons ≤ 30px height
- Touch targets ≥ 44px overall
- 5-10 items visible per section
- Pagination functional
- No content overflow
- Smooth transitions
- Desktop scroll unchanged
- Performance < 150ms

## Risk Assessment

### Potential Issues
- Pagination complexity với backend data
- Section switching UX
- URL state management
- Mobile panel animation performance

### Mitigation Strategies
- Reuse existing pagination logic
- Keep simple first/next navigation
- Preserve query params
- CSS-only transitions

## Security Considerations
- Validate pagination parameters
- Sanitize URL parameters
- Maintain same-page navigation security
- Preserve CSRF tokens

## Next Steps
- Dependencies: Phase 1 (header)
- Follow-up: Phase 3 - Mobile Track List Display
- Testing: Test navigation trước khi tiếp tục
