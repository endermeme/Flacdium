# Phase 3: Mobile Track List Display

## Context Links
- Parent: [plan.md](./plan.md)
- Files: `app/templates/index.html`, `app/static/styles.css`

## Overview
**Priority:** High | **Status:** Pending

Redesign track list để card-based layout, compact metadata, dễ selection cho bulk actions.

## Key Insights
- Table layout không mobile-friendly
- Metadata quá chi tiết cho mobile
- Selection checkboxes khó bấm
- Cover images quá lớn
- Action buttons không accessible

## Requirements
### Functional
- Card-based layout (thay vì table)
- Compact nhưng sufficient metadata
- Easy selection cho bulk actions
- Cover images compact (32-36px)
- Swipe gestures cho actions (nếu có thể)
- Keep original table trên desktop

### Non-Functional
- Touch-friendly selections (44px targets)
- Loading states
- Empty states
- Performance < 100ms per 100 items
- Smooth card animations

## Architecture

### Mobile Track Card Structure
```
Track Card
├── Header
│   ├── Checkbox (44px touch target)
│   └── Spec (sample rate/bit depth)
├── Body (flex row)
│   ├── Cover (32x36px)
│   └── Content
│       ├── Title (14px)
│       ├── Artist/Album (11px)
│       └── Uploader (10px)
└── Footer
    ├── Badges (Year, Duration, Size)
    └── Actions (Download, Preview, Spectrum)
```

### Desktop Table Structure
**Giữ nguyên:** Original table layout

## Related Code Files

### Files to Modify
- `app/templates/index.html` - Mobile track list
- `app/static/styles.css` - Card styling

### Files to Create
- None

### Files to Delete
- None

## Implementation Steps

### Step 1: Card Layout
1. Create mobile track card structure
2. Use flexbox thay vì table
3. Vertical stacking
4. Max-width constraints
5. Gap-based spacing

### Step 2: Metadata Display
1. Priority: Title > Artist/Album > Other info
2. Font sizing hierarchy (14px > 11px > 10px)
3. Truncate long text with ellipsis
4. Hide non-essential metadata
5. Progressive disclosure (tap để xem thêm)

### Step 3: Selection UX
1. Large touch targets (44px minimum)
2. Visual selection feedback
3. Bulk selection status indicator
4. Select all functionality
5. Quick actions dock

### Step 4: Action Buttons
1. Compact button sizing (32px height)
2. Full-width layout cho actions
3. Accessibility labels
4. Disabled states rõ ràng
5. Loading indicators

### Step 5: Cover Images
1. Compact sizing (32-36px)
2. Object-fit: cover
3. Lazy loading
4. Placeholder styling
5. Rounded corners (4px)

## Todo List
- [ ] Create mobile track card HTML
- [ ] Add card CSS styling
- [ ] Implement selection UX
- [ ] Add action buttons
- [ ] Optimize metadata display
- [ ] Test card performance
- [ ] Verify desktop table unchanged

## Success Criteria
- Cards display 10-20 items viewport
- Touch targets ≥ 44px
- Selection works smoothly
- Metadata readable
- Cover images load fast
- Actions accessible
- Desktop table unchanged
- Render time < 100ms/100 items

## Risk Assessment

### Potential Issues
- Performance với nhiều cards
- Memory usage với images
- Scroll performance
- Selection state complexity

### Mitigation Strategies
- Virtual scrolling (nếu cần)
- Image lazy loading
- Debounced selection updates
- Efficient state management

## Security Considerations
- Sanitize track metadata
- Validate selection inputs
- Maintain download security
- Preserve CSRF tokens

## Next Steps
- Dependencies: Phase 2 (navigation)
- Follow-up: Phase 4 - Mobile Upload Panel
- Testing: Test track list trước khi tiếp tục
