# Search Performance Optimization for Music Streaming Apps

## 1. Debouncing Strategies

### Optimal Timing for Music Search
- **300ms**: Best for real-time search with instant feedback
  - Use for character-by-character typing
  - Balances responsiveness and performance
- **500ms**: Sweet spot for music search
  - Allows user to finish typing common queries ("Taylor Swift", "Ed Sheeran")
  - Reduces unnecessary API calls for incomplete queries
- **700ms**: Too long for music search, creates perceptible lag

**Recommendation**: Use 500ms debounce for music search with dynamic adjustment:
- 300ms for single-word queries
- 500ms for multi-word queries

### Implementation
```typescript
// Dynamic debounce implementation
class DynamicDebounceSearch {
  private timeoutId: number | null = null;

  async search(query: string, searchFn: (query: string) => Promise<any>) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    const delay = query.includes(' ') ? 500 : 300;
    return new Promise((resolve) => {
      this.timeoutId = window.setTimeout(async () => {
        const results = await searchFn(query);
        resolve(results);
      }, delay);
    });
  }
}
```

## 2. AbortController Implementation

### Pattern for Search Requests
```typescript
class SearchWithAbort {
  private abortController: AbortController | null = null;

  async search(query: string) {
    // Cancel previous request
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const results = await this.fetchSearchResults(query, signal);
      return results;
    } catch (error) {
      if (error.name === 'AbortError') {
        // Request was cancelled, ignore
        return null;
      }
      throw error;
    }
  }

  private async fetchSearchResults(query: string, signal: AbortSignal) {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      signal,
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Search failed');
    }

    return response.json();
  }
}
```

## 3. Smart Caching for Search

### Cache Key Generation
```typescript
// Fast hash function for cache keys
function hashQuery(query: string): string {
  return btoa(query.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0).toString());
}
```

### LRU Cache Implementation
```typescript
class SearchCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private maxSize = 50;
  private ttl = 30 * 60 * 1000; // 30 minutes

  get(query: string): any | null {
    const item = this.cache.get(query);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(query);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(query);
    this.cache.set(query, item);
    return item.data;
  }

  set(query: string, data: any): void {
    if (this.cache.has(query)) {
      this.cache.delete(query);
    }

    if (this.cache.size >= this.maxSize) {
      // Remove oldest
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(query, { data, timestamp: Date.now() });
  }
}
```

### Partial Result Caching
```typescript
class PartialSearchCache {
  private cache = new Map<string, any[]>();

  // Cache partial results to avoid duplicate searches
  getPartialResults(baseQuery: string): any[] | null {
    const partialResults = [];
    for (const [query, results] of this.cache) {
      if (query.startsWith(baseQuery)) {
        partialResults.push(...results);
      }
    }
    return partialResults.length > 0 ? partialResults : null;
  }

  setPartialResults(query: string, results: any[]): void {
    this.cache.set(query, results);
  }
}
```

## 4. Multiple Parallel API Calls

### Optimized Parallel Search
```typescript
class ParallelSearch {
  private abortController: AbortController | null = null;

  async searchAll(query: string) {
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const searchTypes = ['tracks', 'artists', 'albums', 'playlists'];
    const promises = searchTypes.map(type =>
      this.searchType(type, query, signal).catch(err => {
        if (err.name === 'AbortError') return null;
        throw err;
      })
    );

    const results = await Promise.allSettled(promises);
    return this.processResults(results);
  }

  private async searchType(type: string, query: string, signal: AbortSignal) {
    // Check cache first
    const cacheKey = `${type}:${query}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const response = await fetch(`/api/${type}/search?q=${encodeURIComponent(query)}`, {
      signal
    });

    if (!response.ok) throw new Error(`${type} search failed`);

    const data = await response.json();
    this.cache.set(cacheKey, data);
    return data;
  }

  private processResults(results: PromiseSettledResult<any>[]) {
    return results.reduce((acc, result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        acc[searchTypes[index]] = result.value;
      }
      return acc;
    }, {} as Record<string, any>);
  }
}
```

## 5. Search UX Patterns

### Loading States and Skeletons
```typescript
// Search component with skeleton loading
function MusicSearch() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  return (
    <div className="search-container">
      <input
        type="text"
        placeholder="Search tracks, artists, albums..."
        onChange={debouncedSearch}
      />

      {loading && (
        <div className="skeleton-results">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton-item">
              <div className="skeleton-cover"></div>
              <div className="skeleton-info">
                <div className="skeleton-text skeleton-title"></div>
                <div className="skeleton-text skeleton-artist"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="results">
          {results.map(result => (
            <SearchResultItem key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Keyboard Navigation
```typescript
function useKeyboardNavigation(results: any[]) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelectResult(results[selectedIndex]);
          }
          break;
        case 'Escape':
          setSearchQuery('');
          setSelectedIndex(0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex]);

  return selectedIndex;
}
```

### Error Handling
```typescript
function handleSearchError(error: Error) {
  if (error.name === 'AbortError') {
    // Don't show error for cancelled requests
    return;
  }

  if (error.message.includes('Network Error')) {
    showToast('Network error. Please check your connection.');
    return;
  }

  if (error.message.includes('429')) {
    showToast('Too many requests. Please wait before searching again.');
    return;
  }

  showToast('Search failed. Please try again.');
}
```

## Key Recommendations

1. **Debounce**: Use 500ms for most queries with dynamic adjustment
2. **AbortController**: Always cancel previous requests
3. **Caching**: Implement LRU cache with TTL for search results
4. **Parallel API**: Search all types simultaneously with proper error handling
5. **UX**: Show skeleton loaders, implement keyboard navigation
6. **Performance**: Cache both complete and partial results
7. **Error Handling**: Gracefully handle network and API errors

## Sample Implementation

```typescript
// Main search class combining all optimizations
class OptimizedMusicSearch {
  private debounce = new DynamicDebounceSearch();
  private abortController = new SearchWithAbort();
  private cache = new SearchCache();
  private parallelSearch = new ParallelSearch();

  async search(query: string) {
    // Check cache first
    const cached = this.cache.get(query);
    if (cached) return cached;

    // Debounce and search with abort capability
    return this.debounce.search(query, async (q) => {
      const results = await this.parallelSearch.searchAll(q);
      this.cache.set(q, results);
      return results;
    });
  }
}
```