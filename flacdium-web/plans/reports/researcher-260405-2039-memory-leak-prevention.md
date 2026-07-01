# Memory Leak Prevention Patterns for Music Streaming Apps

## 1. Event Listener Cleanup

### Component Lifecycle Management
```typescript
class MusicPlayer {
  private audio: HTMLAudioElement;
  private progressHandler: (e: Event) => void;

  constructor() {
    this.audio = document.getElementById('audio-player') as HTMLAudioElement;
    this.progressHandler = this.handleProgress.bind(this);
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.audio.addEventListener('timeupdate', this.progressHandler);
    this.audio.addEventListener('ended', this.handleEnded);
    window.addEventListener('beforeunload', this.cleanup.bind(this));
  }

  cleanup() {
    this.audio.removeEventListener('timeupdate', this.progressHandler);
    this.audio.removeEventListener('ended', this.handleEnded);
    window.removeEventListener('beforeunload', this.cleanup);
  }
}
```

### Event Delegation Pattern
```typescript
// Efficient event handling for playlists
class PlaylistManager {
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.container.addEventListener('click', this.handleClick);
  }

  handleClick = (e: Event) => {
    const songElement = (e.target as HTMLElement).closest('.song-item');
    if (songElement) {
      const songId = songElement.dataset.songId;
      this.playSong(songId);
    }
  };

  destroy() {
    this.container.removeEventListener('click', this.handleClick);
  }
}
```

## 2. Interval/Timeout Cleanup

### Automatic Cleanup Pattern
```typescript
class MusicVisualizer {
  private animationFrame: number;
  private interval: NodeJS.Timeout;

  start() {
    this.interval = setInterval(() => {
      this.updateWaveform();
    }, 1000/60); // 60fps

    this.animate();
  }

  animate() {
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  stop() {
    cancelAnimationFrame(this.animationFrame);
    clearInterval(this.interval);
  }
}
```

### AbortController Pattern (React)
```typescript
useEffect(() => {
  const controller = new AbortController();

  const fetchAlbums = async () => {
    try {
      const response = await fetch('/api/albums', {
        signal: controller.signal
      });
      const data = await response.json();
      setAlbums(data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch albums:', error);
      }
    }
  };

  fetchAlbums();

  return () => {
    controller.abort();
  };
}, []);
```

## 3. Object Pooling for Music Apps

### Audio Buffer Pool
```typescript
class AudioBufferPool {
  private pool: AudioBuffer[] = [];
  private maxPoolSize = 10;
  private minPoolSize = 5;

  async getBuffer(): Promise<AudioBuffer> {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }

    return this.createBuffer();
  }

  releaseBuffer(buffer: AudioBuffer) {
    if (this.pool.length < this.maxPoolSize) {
      // Reset buffer state if needed
      buffer.copyToChannel(new Float32Array(buffer.length), 0);
      this.pool.push(buffer);
    }
  }

  private async createBuffer(): Promise<AudioBuffer> {
    const audioContext = new AudioContext();
    const response = await fetch('/sample-buffer');
    const arrayBuffer = await response.arrayBuffer();
    return audioContext.decodeAudioData(arrayBuffer);
  }
}
```

### Song Metadata Pool
```typescript
class SongMetadataPool {
  private metadataCache = new Map<string, SongMetadata>();
  private lruQueue: string[] = [];
  private maxCacheSize = 100;

  get(songId: string): SongMetadata | null {
    if (this.metadataCache.has(songId)) {
      this.updateLRU(songId);
      return this.metadataCache.get(songId)!;
    }
    return null;
  }

  set(songId: string, metadata: SongMetadata) {
    if (this.metadataCache.size >= this.maxCacheSize) {
      const oldestId = this.lruQueue.shift()!;
      this.metadataCache.delete(oldestId);
    }

    this.metadataCache.set(songId, metadata);
    this.lruQueue.push(songId);
  }

  private updateLRU(songId: string) {
    const index = this.lruQueue.indexOf(songId);
    if (index > -1) {
      this.lruQueue.splice(index, 1);
    }
    this.lruQueue.push(songId);
  }
}
```

## 4. Memory Profiling Techniques

### Chrome DevTools Patterns
```javascript
// Take heap snapshot
function takeHeapSnapshot() {
  const profile = console.profile('Memory Profile');
  // Perform actions to profile
  setTimeout(() => {
    console.profileEnd();
    // Take snapshot after operations
    if (window.performance && performance.memory) {
      console.log('JS Heap Size:', (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB');
    }
  }, 1000);
}
```

### Memory Leak Detection
```typescript
class MemoryMonitor {
  private snapshots: any[] = [];

  takeSnapshot() {
    if (typeof gc === 'function') {
      gc();
    }

    const snapshot = {
      timestamp: Date.now(),
      objects: performance.memory?.usedJSHeapSize || 0,
      listeners: this.countEventListeners(),
      intervals: this.countIntervals()
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  detectLeaks() {
    if (this.snapshots.length < 2) return;

    const recent = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[this.snapshots.length - 2];

    const growth = {
      objects: recent.objects - previous.objects,
      listeners: recent.listeners - previous.listeners,
      intervals: recent.intervals - previous.intervals
    };

    if (growth.objects > 10 * 1024 * 1024) { // 10MB growth
      console.warn('Potential memory leak detected:', growth);
    }
  }

  private countEventListeners(): number {
    // Count active event listeners
    // Implementation depends on your framework
    return 0;
  }
}
```

## 5. Music Player Specific Patterns

### Audio Element Cleanup
```typescript
class AudioManager {
  private audio: HTMLAudioElement;
  private source: MediaElementAudioSourceNode;
  private analyser: AnalyserNode;

  constructor() {
    this.audio = new Audio();
    this.setupAudioContext();
  }

  private setupAudioContext() {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.source = audioContext.createMediaElementSource(this.audio);
    this.analyser = audioContext.createAnalyser();

    this.source.connect(this.analyser);
    this.analyser.connect(audioContext.destination);
  }

  destroy() {
    this.audio.pause();
    this.audio.src = '';
    this.audio.remove();

    if (this.source) {
      this.source.disconnect();
    }

    if (this.analyser) {
      this.analyser.disconnect();
    }

    // Close audio context
    (this.source as any).context?.close();
  }
}
```

### Visualization Canvas Cleanup
```typescript
class WaveformVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
  }

  draw() {
    this.animationId = requestAnimationFrame(() => this.draw());
    // Drawing logic here
  }

  clear() {
    cancelAnimationFrame(this.animationId);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy() {
    this.clear();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
```

## Prevention Checklist

1. ✅ Always clean up event listeners
2. ✅ Cancel intervals and timeouts
3. ✅ Use AbortController for fetch requests
4. ✅ Clean up audio contexts and nodes
5. ✅ Implement object pooling for frequently created objects
6. ✅ Monitor memory usage with regular snapshots
7. ✅ Use weak references for temporary data
8. ✅ Clean up DOM elements when destroyed

## Key Takeaways

- Always pair addEventListener with removeEventListener
- Use useEffect cleanup in React components
- Implement pooling for audio buffers and metadata
- Regular memory profiling to catch leaks early
- Proper cleanup of audio contexts and Web Audio API nodes
