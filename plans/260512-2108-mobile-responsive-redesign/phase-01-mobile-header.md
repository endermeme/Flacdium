# Phase 1: Mobile Header Responsive

## Context Links
- Parent: [plan.md](./plan.md)
- Files: `app/templates/base.html`, `app/static/styles.css`

## Overview
**Priority:** High | **Status:** Pending

Redesign header để gọn, responsive trên mobile và tích hợp navigation hợp lý.

## Key Insights
- Header hiện tại quá lớn trên mobile
- Navigation ẩn hoàn toàn trên mobile
- Brand icon/mark không responsive sizing
- Utility tools không mobile-friendly

## Requirements
### Functional
- Hamburger menu icon gọn (28x28px)
- Navigation dropdown/horizontal trên mobile
- Responsive brand sizing (40px trên mobile)
- Compact utility tools
- Language và account tools accessible

### Non-Functional
- Smooth transitions
- Touch-friendly sizing (44px minimum)
- Consistent với style hiện tại
- Performance < 200ms animations

## Architecture

### Mobile Header Structure
```
Header (flex row)
├── Brand (left, flex)
│   ├── Menu Icon (28x28px)
│   └── Brand Lockup
│       ├── Icon (40px mobile)
│       └── Mark (14px font)
└── Actions (right, auto)
    ├── Navigation (dropdown/tabs)
    ├── Language Switch (compact)
    └── Account Pill (compact)
```

### Navigation Modes
**Mobile:** Dropdown từ hamburger icon
**Tablet:** Horizontal tabs với overflow
**Desktop:** Giữ nguyên hiện tại

## Related Code Files

### Files to Modify
- `app/templates/base.html` - Header structure
- `app/static/styles.css` - Mobile header styles

### Files to Create
- None

### Files to Delete
- None

## Implementation Steps

### Step 1: Header Structure Update
1. Add hamburger menu button (hidden desktop)
2. Update brand sizing cho mobile
3. Restructure topbar-tools để mobile-friendly
4. Add navigation dropdown container

### Step 2: Mobile Navigation Menu
1. Create dropdown menu với sections
2. Add navigation links
3. Include quickfind và language switch
4. Add account section

### Step 3: CSS Styling
1. Mobile-specific breakpoint styles (<760px)
2. Hamburger icon animation
3. Dropdown transition effects
4. Touch target sizing (44px minimum)
5. Responsive brand scaling

### Step 4: JavaScript Enhancement
1. Menu toggle functionality
2. Close on outside click
3. Close on navigation link click
4. Accessibility (ARIA, keyboard)

### Step 5: Utility Tools Optimization
1. Compact language switch
2. Account pill mobile layout
3. Show/hide logic cho mobile
4. Login/signup accessibility

## Todo List
- [ ] Update base.html header structure
- [ ] Add hamburger menu button
- [ ] Create navigation dropdown
- [ ] Add mobile CSS for header
- [ ] Implement menu toggle JS
- [ ] Test touch interactions
- [ ] Test accessibility

## Success Criteria
- Header gọn trên mobile (< 60px height)
- Navigation accessible qua hamburger
- Brand scaled appropriate cho mobile
- All links functional
- Smooth transitions < 200ms
- Touch targets ≥ 44px
- WCAG AA contrast ratios
- Works iOS Safari và Chrome Mobile

## Risk Assessment

### Potential Issues
- Dropdown overflow trên small screens
- Animation performance trên low-end devices
- Touch event conflicts với scroll

### Mitigation Strategies
- Max-height với internal scroll
- CSS-only transitions (no JS animations)
- Proper event delegation
- Test trên actual devices

## Security Considerations
- Maintain CSRF tokens
- No XSS trong dynamic content
- Preserve auth state
- Same CSP policies

## Next Steps
- Dependencies: None
- Follow-up: Phase 2 - Mobile Navigation System
- Testing: Test header trước khi tiếp tục
