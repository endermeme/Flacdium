---
title: "Phase 01: Search Performance Optimization"
description: "Implement AbortController, optimize debounce timing, add LRU cache with fast key generation, improve parallel API calls, add loading states"
status: pending
priority: P1
effort: 4h
branch: main
tags: [performance, search, optimization]
created: 2026-04-05
---

# Phase 01: Search Performance Optimization

## Context Links

- [Research Report](../../reports/researcher-260405-2039-search-performance-optimization.md)
- [Related Files](#related-code-files)

## Overview

**Priority:** P1 (HIGHEST PRIORITY)
**Status:** pending
**Est. Time:** 4 hours

Search is the most frequently used feature in Monochrome. Current implementation suffers from:
- Missing AbortController for race conditions
- Suboptimal debounce timing (300ms)
- Slow cache key generation (JSON.stringify)
- No loading states or skeleton screens
- Potential parallel API call inefficiencies

## Key Insights from Research

1. Debouncing at 500ms reduces API calls by 40% vs 300ms
2. LRU cache with string concatenation is 3x faster than JSON.stringify
3. AbortController prevents race conditions and wasted bandwidth
4. Progressive rendering improves perceived performance
5. Skeleton screens reduce bounce rate by 15%

## Requirements

### Functional Requirements

- All search functions must use AbortController
- Search debounce delay: 500ms
- LRU cache with fast key generation
- Loading states for all async operations
- Skeleton screens for search results
- Proper cleanup on component unmount

### Non-Functional Requirements

- Search response time < 500ms (cached) / 2s (uncached)
- Zero memory leaks in search components
- Responsive UI during search operations
- Graceful degradation on network failure

## Architecture

### Search Optimization Stack

```
User Input (500ms debounce)
    ↓
AbortController (cancels previous requests)
    ↓
LRU Cache Check (fast key generation)
    ↓
API Call (parallel with error handling)
    ↓
Progressive Rendering (batches of 20)
    ↓
UI Update (with skeleton states)
```

### Cache Strategy

```
LRU Cache Implementation:
- Max entries: 100
- TTL: 30 minutes
- Key generation: String concatenation (not JSON.stringify)
- Eviction: Least Recently Used
```

## Related Code Files

### Files to Modify

1. **`/home/binhtagilla/Desktop/monochrome/js/app.js`**
   - Search event listeners (lines 2568-2612)
   - Debounce timing adjustment
   - Add AbortController

2. **`/home/binhtagilla/Desktop/monochrome/js/cache.js`**
   - Implement fast LRU cache
   - Replace JSON.stringify with string concatenation
   - Add cache statistics

3. **`/home/binhtagilla/Desktop/monochrome/js/api.js`**
   - Add AbortController to fetchWithRetry
   - Implement parallel API call optimization
   - Add loading state management

4. **`/home/binhtagilla/Desktop/monochrome/styles.css`**
   - Add skeleton screen styles
   - Loading state animations

### Files to Create

1. **`/home/binhtagilla/Desktop/monochrome/js/search-optimizer.js`**
   - SearchAbortController class
   - SearchLRUCache class
   - SearchPerformanceMonitor class

2. **`/home/binhtagilla/Desktop/monochrome/js/search-utils.js`**
   - Fast cache key generation
   - Search result batching utilities
   - Progressive rendering helpers

## Implementation Steps

### Step 1: Create Search Utility Classes (1h)

1.1 Create `js/search-optimizer.js`:
   ```javascript
   export class SearchAbortController {
     private controller: AbortController | null = null;
     private pendingRequest: Promise<SearchResult[]> | null = null;

     abortCurrent() {
       this.controller?.abort();
       this.controller = new AbortController();
       return this.controller.signal;
     }
   }
   ```

1.2 Create `SearchLRUCache` in same file:
   ```javascript
   export class SearchLRUCache {
     private cache = new Map<string, SearchResult[]>();
     private lruQueue: string[] = [];
     private maxCacheSize = 100;

     // Fast key generation without JSON.stringify
     generateKey(query: string, type: string): string {
       return `${type}:${query.toLowerCase().trim()}`;
     }
   }
   ```

1.3 Add performance monitoring:
   ```javascript
   export class SearchPerformanceMonitor {
     recordSearch(duration: number) {
       // Track search metrics
     }
   }
   ```

### Step 2: Implement Fast Cache Key Generation (30m)

2.1 Update `js/cache.js`:
   ```javascript
   // Replace JSON.stringify with fast string concatenation
   generateKey(type, params) {
     if (typeof params === 'string') {
       return `${type}:${params.toLowerCase().trim()}`;
     }
     if (params.query) {
       return `${type}:${params.query.toLowerCase().trim()}`;
     }
     // Fallback for complex objects
     return `${type}:${JSON.stringify(params)}`;
   }
   ```

2.2 Implement LRU eviction:
   ```javascript
   updateLRU(key) {
     const index = this.lruQueue.indexOf(key);
     if (index > -1) {
       this.lruQueue.splice(index, 1);
     }
     this.lruQueue.push(key);
   }
   ```

### Step 3: Update Search Implementation (1h)

3.1 Modify `js/app.js` search debounce:
   ```javascript
   // Change from 300ms to 500ms
   const debouncedSearch = debounce((query) => {
     performSearch(query);
   }, 500);
   ```

3.2 Add AbortController:
   ```javascript
   const searchAbortController = new SearchAbortController();

   async function performSearch(query) {
     const signal = searchAbortController.abortCurrent();
     try {
       const results = await api.search(query, { signal });
       // Render results
     } catch (error) {
       if (error.name !== 'AbortError') {
         console.error('Search failed:', error);
       }
     }
   }
   ```

3.3 Add loading states:
   ```javascript
   function setLoadingState(isLoading) {
     const searchResults = document.getElementById('search-results');
     if (isLoading) {
       searchResults.innerHTML = '<div class="skeleton-loader"></div>';
     }
   }
   ```

### Step 4: Optimize API Calls (45m)

4.1 Update `js/api.js` fetchWithRetry:
   ```javascript
   async fetchWithRetry(relativePath, options = {}) {
     const controller = new AbortController();
     const timeout = setTimeout(() => controller.abort(), 10000);

     try {
       const response = await fetch(url, {
         signal: controller.signal,
         ...options
       });
       clearTimeout(timeout);
       return response;
     } catch (error) {
       clearTimeout(timeout);
       if (error.name === 'AbortError') {
         throw new Error('Request timeout');
       }
       throw error;
     }
   }
   ```

4.2 Implement parallel API optimization:
   ```javascript
   async search(query, options) {
     const signal = options?.signal;
     const [artists, albums, tracks] = await Promise.allSettled([
       this.searchArtists(query, { signal }),
       this.searchAlbums(query, { signal }),
       this.searchTracks(query, { signal })
     ]);
     // Combine results
   }
   ```

### Step 5: Add Skeleton Screens (45m)

5.1 Create CSS in `styles.css`:
   ```css
   .skeleton-loader {
     background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
     background-size: 200% 100%;
     animation: skeleton-loading 1.5s infinite;
   }

   @keyframes skeleton-loading {
     0% { background-position: 200% 0; }
     100% { background-position: -200% 0; }
   }

   .skeleton-item {
     height: 60px;
     margin: 10px 0;
     border-radius: 8px;
   }
   ```

5.2 Update UI renderer:
   ```javascript
   renderSkeletonResults(count = 5) {
     return Array(count).fill(0).map(() =>
       '<div class="skeleton-item skeleton-loader"></div>'
     ).join('');
   }
   ```

## Testing Strategy

### Unit Tests

- Test SearchLRUCache key generation performance
- Test SearchAbortController cancellation
- Test debounce timing accuracy

### Integration Tests

- Test search with rapid input changes
- Test search cancellation on navigation
- Test cache hit/miss scenarios

### Performance Tests

- Measure search response time (cached/uncached)
- Measure cache hit rate over time
- Profile memory usage during search

## Success Criteria

- [ ] All search functions use AbortController
- [ ] Debounce timing set to 500ms
- [ ] LRU cache with fast key generation implemented
- [ ] Loading states display correctly
- [ ] Skeleton screens implemented
- [ ] Search response time < 500ms (cached)
- [ ] Search response time < 2s (uncached)
- [ ] No race conditions in search results
- [ ] Cache hit rate > 30%

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Increased debounce time may feel sluggish | Medium | Implement optimistic UI updates |
| Cache key collisions | Low | Include search type in key |
| AbortController compatibility | Low | Add fallback for older browsers |
| Skeleton screen performance | Low | Use CSS animations, not JS |

## Security Considerations

- Sanitize search queries before caching
- Limit cache size to prevent memory exhaustion
- Implement cache TTL to prevent stale data

## Next Steps

- Complete Phase 02: Memory Leak Prevention
- Then proceed to Phase 03: Bundle Optimization

## Unresolved Questions

1. Should we implement fuzzy search for better UX?
2. What's the optimal cache size for different device types?
3. Should we preload popular search terms?
