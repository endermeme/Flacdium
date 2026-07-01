# Search Performance Optimization for Music Streaming Apps

## 1. Search Input Optimization

### Debouncing and Throttling
```typescript
class SearchOptimizer {
  private searchTimeout: NodeJS.Timeout;
  private searchQueue: string[] = [];
  private isSearching = false;

  debounceSearch(query: string, delay = 300) {
    this.searchTimeout = setTimeout(() => {
      this.performSearch(query);
    }, delay);
  }

  throttleSearch(query: string, limit = 200) {
    if (this.isSearching) return;

    this.isSearching = true;
    this.performSearch(query);

    setTimeout(() => {
      this.isSearching = false;
    }, limit);
  }

  private async performSearch(query: string) {
    // Cancel previous search if still running
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchQueue.push(query);

    // Process the latest query
    const latestQuery = this.searchQueue[this.searchQueue.length - 1];
    this.searchQueue = [latestQuery]; // Keep only the latest

    try {
      const results = await this.searchAPI(latestQuery);
      this.onSearchResults(results);
    } finally {
      this.searchTimeout = undefined;
    }
  }

  private async searchAPI(query: string): Promise<SearchResult[]> {
    // Implementation with caching
    return fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => data.results);
  }
}
```

### Progressive Search Results
```typescript
class ProgressiveSearch {
  private currentResults: SearchResult[] = [];
  private displayedResults: SearchResult[] = [];
  private batchSize = 20;
  private displayTimeout: NodeJS.Timeout;

  constructor() {
    this.setupIntersectionObserver();
  }

  async search(query: string) {
    this.currentResults = await this.fetchSearchResults(query);
    this.displayedResults = [];
    this.renderNextBatch();
  }

  private async fetchSearchResults(query: string): Promise<SearchResult[]> {
    const response = await fetch(`/api/search?q=${query}&batch=0`);
    return response.json();
  }

  private renderNextBatch() {
    const nextBatch = this.currentResults.slice(
      this.displayedResults.length,
      this.displayedResults.length + this.batchSize
    );

    this.displayedResults = [...this.displayedResults, ...nextBatch];
    this.renderResults(this.displayedResults);
  }

  private setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        this.renderNextBatch();
      }
    }, { threshold: 0.1 });

    // Attach to load more element
    const loadMoreElement = document.getElementById('load-more');
    if (loadMoreElement) {
      observer.observe(loadMoreElement);
    }
  }
}
```

## 2. Search Indexing Strategies

### Full-text Search with IndexDB
```typescript
class SearchIndex {
  private db: IDBDatabase;
  private indexReady = false;

  async initialize() {
    const request = indexedDB.open('MusicSearchDB', 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('songs')) {
        const store = db.createObjectStore('songs', { keyPath: 'id' });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('artist', 'artist', { unique: false });
        store.createIndex('album', 'album', { unique: false });
        store.createIndex('fullText', ['title', 'artist', 'album', 'genre'], { unique: false });
      }
    };

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      this.indexReady = true;
    };
  }

  async indexSong(song: Song) {
    if (!this.indexReady) return;

    const transaction = this.db.transaction(['songs'], 'readwrite');
    const store = transaction.objectStore('songs');

    await store.put({
      ...song,
      fullText: `${song.title} ${song.artist} ${song.album} ${song.genre}`.toLowerCase()
    });
  }

  async search(query: string): Promise<Song[]> {
    if (!this.indexReady) return [];

    const normalizedQuery = query.toLowerCase();
    const transaction = this.db.transaction(['songs'], 'readonly');
    const store = transaction.objectStore('songs');
    const index = store.index('fullText');

    const results: Song[] = [];
    let cursor = await index.openCursor();

    while (cursor) {
      const song = cursor.value;
      if (song.fullText.includes(normalizedQuery)) {
        results.push(song);
      }
      cursor = await cursor.continue();
    }

    return results;
  }
}
```

### Search Cache with LRU
```typescript
class SearchCache {
  private cache = new Map<string, SearchResult[]>();
  private lruKeys: string[] = [];
  private maxCacheSize = 100;

  get(query: string): SearchResult[] | null {
    if (this.cache.has(query)) {
      this.updateLRU(query);
      return this.cache.get(query)!;
    }
    return null;
  }

  set(query: string, results: SearchResult[]) {
    if (this.cache.size >= this.maxCacheSize) {
      const oldest = this.lruKeys.shift()!;
      this.cache.delete(oldest);
    }

    this.cache.set(query, results);
    this.lruKeys.push(query);
  }

  private updateLRU(query: string) {
    const index = this.lruKeys.indexOf(query);
    if (index > -1) {
      this.lruKeys.splice(index, 1);
    }
    this.lruKeys.push(query);
  }

  clear() {
    this.cache.clear();
    this.lruKeys = [];
  }
}
```

## 3. Search Performance Optimization

### Batch Processing
```typescript
class BatchSearchProcessor {
  private batchSize = 50;
  private processingQueue: SearchResult[][] = [];
  private currentBatch: SearchResult[] = [];

  addToQueue(results: SearchResult[]) {
    this.processingQueue.push(results);
    this.processNextBatch();
  }

  private async processNextBatch() {
    if (this.currentBatch.length > 0) return;

    const batch = this.processingQueue.shift();
    if (!batch) return;

    this.currentBatch = batch;
    this.processBatch();
  }

  private async processBatch() {
    const batch = [...this.currentBatch];
    this.currentBatch = [];

    // Process batch with timeout to prevent blocking
    await new Promise(resolve => setTimeout(resolve, 0));

    // Update UI for this batch
    this.updateUI(batch);

    // Process next batch
    this.processNextBatch();
  }

  private updateUI(results: SearchResult[]) {
    // Implement batch UI updates
    const fragment = document.createDocumentFragment();

    results.forEach(result => {
      const element = this.createResultElement(result);
      fragment.appendChild(element);
    });

    const container = document.getElementById('search-results');
    if (container) {
      container.appendChild(fragment);
    }
  }

  private createResultElement(result: SearchResult): HTMLElement {
    // Create and return element for search result
    const div = document.createElement('div');
    div.className = 'search-result';
    div.innerHTML = `
      <div class="song-title">${result.title}</div>
      <div class="song-artist">${result.artist}</div>
    `;
    return div;
  }
}
```

### Preload Frequently Searched Terms
```typescript
class SearchPreloader {
  private commonTerms = ['rock', 'pop', 'jazz', 'classical', 'electronic'];
  private preloadedData = new Map<string, SearchResult[]>();

  constructor() {
    this.preloadCommonTerms();
  }

  private async preloadCommonTerms() {
    for (const term of this.commonTerms) {
      try {
        const results = await this.fetchSearchResults(term);
        this.preloadedData.set(term, results);
      } catch (error) {
        console.warn(`Failed to preload search results for ${term}:`, error);
      }
    }
  }

  getPreloadedResults(term: string): SearchResult[] | null {
    return this.preloadedData.get(term) || null;
  }

  private async fetchSearchResults(term: string): Promise<SearchResult[]> {
    const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
    return response.json();
  }
}
```

## 4. Advanced Search Techniques

### Fuzzy Search Implementation
```typescript
class FuzzySearch {
  private searchIndex: Map<string, Song[]> = new Map();

  buildIndex(songs: Song[]) {
    songs.forEach(song => {
      const tokens = this.tokenize(song.title + ' ' + song.artist);
      tokens.forEach(token => {
        if (!this.searchIndex.has(token)) {
          this.searchIndex.set(token, []);
        }
        this.searchIndex.get(token)!.push(song);
      });
    });
  }

  search(query: string): SearchResult[] {
    const queryTokens = this.tokenize(query);
    const results = new Map<string, number>();

    queryTokens.forEach(token => {
      const matchingSongs = this.searchIndex.get(token) || [];
      matchingSongs.forEach(song => {
        const score = results.get(song.id) || 0;
        results.set(song.id, score + 1);
      });
    });

    return Array.from(results.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id, score]) => {
        const song = this.findSongById(id);
        return { song, score };
      });
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  private findSongById(id: string): Song | undefined {
    // Implementation to find song by ID
    return undefined;
  }
}
```

## 5. Performance Monitoring

```typescript
class SearchPerformanceMonitor {
  private metrics = {
    searchCount: 0,
    totalTime: 0,
    averageTime: 0,
    lastSearchTime: 0
  };

  recordSearch(duration: number) {
    this.metrics.searchCount++;
    this.metrics.totalTime += duration;
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.searchCount;
    this.metrics.lastSearchTime = duration;

    this.logPerformance();
  }

  private logPerformance() {
    console.log('Search Performance Metrics:', {
      totalSearches: this.metrics.searchCount,
      averageTime: this.metrics.averageTime.toFixed(2) + 'ms',
      lastSearchTime: this.metrics.lastSearchTime.toFixed(2) + 'ms'
    });

    // Report to analytics if needed
    this.reportToAnalytics();
  }

  private reportToAnalytics() {
    // Send metrics to analytics service
    // Example: track search performance
  }
}
```

## Optimization Checklist

1. ✅ Implement search debouncing (300-500ms)
2. ✅ Use progressive loading for large result sets
3. ✅ Implement caching with LRU strategy
4. ✅ Build search indices for faster lookups
5. ✅ Process search results in batches
6. ✅ Preload common search terms
7. ✅ Implement fuzzy search for better UX
8. ✅ Monitor search performance metrics
9. ✅ Use Web Workers for heavy search operations
10. ✅ Implement search result pagination

## Key Recommendations

- Start with simple debouncing and caching
- Implement IndexedDB for offline search capabilities
- Use progressive loading for large datasets
- Monitor search performance and optimize bottlenecks
- Consider server-side search for complex queries
- Implement search analytics to improve relevance