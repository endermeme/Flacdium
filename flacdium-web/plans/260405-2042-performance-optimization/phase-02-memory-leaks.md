---
title: "Phase 02: Memory Leak Prevention"
description: "Fix event listener cleanup, implement proper interval/timeout cleanup, add cleanup for audio contexts and visualization canvases, fix FFmpeg worker memory leaks, add memory monitoring"
status: pending
priority: P1
effort: 4h
branch: main
tags: [performance, memory, cleanup]
created: 2026-04-05
---

# Phase 02: Memory Leak Prevention

## Context Links

- [Research Report](../../reports/researcher-260405-2039-memory-leak-prevention.md)
- [Related Files](#related-code-files)

## Overview

**Priority:** P1 (HIGH PRIORITY)
**Status:** pending
**Est. Time:** 4 hours

Memory leaks in music streaming apps cause performance degradation, crashes, and poor UX. Current implementation likely has leaks in:
- Event listeners not properly cleaned up
- Intervals/timeouts not cancelled
- Audio contexts not closed
- Visualization canvases not cleared
- FFmpeg workers not terminated

## Key Insights from Research

1. Event listeners must be paired with cleanup
2. Audio contexts consume significant memory and must be closed
3. Visualization canvases accumulate memory in animation frames
4. FFmpeg workers leak if not terminated properly
5. Memory monitoring helps catch leaks early

## Requirements

### Functional Requirements

- All event listeners must have cleanup functions
- All intervals/timeouts must be cancelled on unmount
- Audio contexts must be closed when not in use
- Visualization canvases must be cleared and dimensions reset
- FFmpeg workers must be terminated after use

### Non-Functional Requirements

- Zero memory growth after 30min continuous use
- No event listener leaks detected
- Audio context memory properly released
- FFmpeg worker memory properly released

## Architecture

### Cleanup Strategy

```
Component Lifecycle:
Mount → Setup listeners/intervals
Update → Manage active resources
Unmount → Cleanup all resources

Cleanup Pattern:
1. Cancel all AbortControllers
2. Remove all event listeners
3. Clear all intervals/timeouts
4. Cancel all animation frames
5. Close/disconnect all audio nodes
6. Terminate all workers
7. Clear canvas dimensions
```

### Memory Monitoring

```
Monitor Implementation:
- Track active listeners
- Track active intervals
- Track active workers
- Track audio contexts
- Periodic memory snapshots
- Alert on memory growth
```

## Related Code Files

### Files to Modify

1. **`/home/binhtagilla/Desktop/monochrome/js/app.js`**
   - Event listener cleanup (lines 2568-2622)
   - Interval cleanup (line 2519)
   - Window event listeners

2. **`/home/binhtagilla/Desktop/monochrome/js/audio-context.js`**
   - Audio context cleanup
   - Audio node disconnection
   - Audio context closure

3. **`/home/binhtagilla/Desktop/monochrome/js/player.js`**
   - Player event listeners
   - Sleep timer cleanup
   - Preload cache cleanup

4. **`/home/binhtagilla/Desktop/monochrome/js/ffmpeg.js`**
   - Worker termination
   - AbortController cleanup
   - Event listener cleanup

5. **`/home/binhtagilla/Desktop/monochrome/js/visualizer.js`** (if exists)
   - Canvas cleanup
   - Animation frame cancellation
   - Resize observer cleanup

### Files to Create

1. **`/home/binhtagilla/Desktop/monochrome/js/cleanup-manager.js`**
   - Centralized cleanup management
   - Resource tracking
   - Cleanup verification

2. **`/home/binhtagilla/Desktop/monochrome/js/memory-monitor.js`**
   - Memory tracking
   - Leak detection
   - Performance metrics

## Implementation Steps

### Step 1: Create Cleanup Manager (1h)

1.1 Create `js/cleanup-manager.js`:
   ```javascript
   export class CleanupManager {
     private resources = new Map<string, Set<() => void>>();

     register(id: string, cleanup: () => void) {
       if (!this.resources.has(id)) {
         this.resources.set(id, new Set());
       }
       this.resources.get(id).add(cleanup);
     }

     cleanup(id: string) {
       const cleanups = this.resources.get(id);
       if (cleanups) {
         cleanups.forEach(fn => fn());
         this.resources.delete(id);
       }
     }

     cleanupAll() {
       this.resources.forEach((cleanups, id) => {
         cleanups.forEach(fn => fn());
       });
       this.resources.clear();
     }
   }

   export const cleanupManager = new CleanupManager();
   ```

### Step 2: Fix Event Listener Leaks (1h)

2.1 Update `js/app.js` search event listeners:
   ```javascript
   // Store cleanup functions
   const searchCleanup = [];

   // Add listeners with cleanup tracking
   const handleInput = (e) => {
     const query = e.target.value.trim();
     if (!query) return;
     debouncedSearch(query);
   };
   searchInput.addEventListener('input', handleInput);
   searchCleanup.push(() => searchInput.removeEventListener('input', handleInput));

   // Cleanup on navigation
   window.addEventListener('beforeunload', () => {
     searchCleanup.forEach(fn => fn());
   });
   ```

2.2 Implement event delegation where possible:
   ```javascript
   // Instead of multiple listeners
   document.querySelector('.playlist').addEventListener('click', (e) => {
     const songItem = e.target.closest('.song-item');
     if (songItem) {
       handleSongClick(songItem.dataset.id);
     }
   });
   ```

### Step 3: Fix Interval/Timeout Leaks (45m)

3.1 Update interval cleanup in `js/app.js`:
   ```javascript
   // Store interval IDs
   const intervals = [];

   // Create interval with cleanup
   function createInterval(fn, delay, id) {
     const intervalId = setInterval(fn, delay);
     intervals.push({ id, intervalId });
     return intervalId;
   }

   // Clear all intervals
   function clearAllIntervals() {
     intervals.forEach(({ intervalId }) => clearInterval(intervalId));
     intervals.length = 0;
   }
   ```

3.2 Update `js/player.js` sleep timer:
   ```javascript
   clearSleepTimer() {
     if (this.sleepTimer) {
       clearTimeout(this.sleepTimer);
       this.sleepTimer = null;
     }
     if (this.sleepTimerInterval) {
       clearInterval(this.sleepTimerInterval);
       this.sleepTimerInterval = null;
     }
     this.sleepTimerEndTime = null;
   }
   ```

### Step 4: Fix Audio Context Leaks (45m)

4.1 Update `js/audio-context.js`:
   ```javascript
   destroy() {
     // Disconnect all nodes
     try {
       this.source?.disconnect();
       this.analyser?.disconnect();
       this.filters?.forEach(filter => filter.disconnect());
       this.outputNode?.disconnect();
       this.volumeNode?.disconnect();
       this.monoMergerNode?.disconnect();
       this.preampNode?.disconnect();
     } catch (e) {
       console.warn('Error disconnecting nodes:', e);
     }

     // Close audio context
     if (this.audioContext && this.audioContext.state !== 'closed') {
       this.audioContext.close();
     }

     // Clear references
     this.audioContext = null;
     this.source = null;
     this.analyser = null;
     this.filters = [];
     this.outputNode = null;
     this.volumeNode = null;
     this.isInitialized = false;
   }
   ```

4.2 Add cleanup to player:
   ```javascript
   async destroy() {
     audioContextManager.destroy();

     // Clean up all sources
     this.sources.forEach((source, audioElement) => {
       try {
         source.disconnect();
       } catch (e) {
         /* ignore */
       }
     });
     this.sources.clear();
   }
   ```

### Step 5: Fix FFmpeg Worker Leaks (30m)

5.1 Update `js/ffmpeg.js`:
   ```javascript
   // Ensure worker is always terminated
   function ffmpegWorker(/* params */) {
     const worker = new FfmpegWorker();
     let endCategory = null;

     const cleanup = () => {
       if (worker) {
         worker.terminate();
         endCategory?.();
       }
     };

     // Register cleanup
     cleanupManager.register('ffmpeg', cleanup);

     worker.onmessage = (e) => {
       const { type, blob } = e.data;
       if (type === 'complete' || type === 'error') {
         cleanupManager.cleanup('ffmpeg');
         if (type === 'complete') resolve(blob);
         else reject(new FfmpegError(message));
       }
     };

     // Cleanup on abort
     signal?.addEventListener('abort', () => {
       cleanup();
       reject(new FfmpegError('FFMPEG aborted'));
     });
   }
   ```

### Step 6: Add Memory Monitoring (30m)

6.1 Create `js/memory-monitor.js`:
   ```javascript
   export class MemoryMonitor {
     private snapshots: any[] = [];
     private checkInterval: NodeJS.Timeout | null = null;

     startMonitoring(interval = 30000) {
       this.checkInterval = setInterval(() => {
         this.takeSnapshot();
         this.detectLeaks();
       }, interval);
     }

     takeSnapshot() {
       const snapshot = {
         timestamp: Date.now(),
         jsHeapSize: performance.memory?.usedJSHeapSize || 0,
         jsHeapLimit: performance.memory?.jsHeapSizeLimit || 0,
         listenerCount: this.countEventListeners(),
         workerCount: this.countWorkers()
       };
       this.snapshots.push(snapshot);
       return snapshot;
     }

     detectLeaks() {
       if (this.snapshots.length < 2) return;

       const recent = this.snapshots[this.snapshots.length - 1];
       const previous = this.snapshots[this.snapshots.length - 2];

       const growth = recent.jsHeapSize - previous.jsHeapSize;
       if (growth > 10 * 1024 * 1024) { // 10MB growth
         console.warn('Potential memory leak detected:', {
           growth: `${(growth / 1024 / 1024).toFixed(2)}MB`,
           heapUsage: `${(recent.jsHeapSize / recent.jsHeapLimit * 100).toFixed(1)}%`
         });
       }
     }

     stopMonitoring() {
       if (this.checkInterval) {
         clearInterval(this.checkInterval);
         this.checkInterval = null;
       }
     }

     private countEventListeners(): number {
       // Estimate by checking known event targets
       return 0;
     }

     private countWorkers(): number {
       // Count active workers
       return 0;
     }
   }

   export const memoryMonitor = new MemoryMonitor();
   ```

## Testing Strategy

### Memory Profiling

1. Use Chrome DevTools Memory Profiler
2. Take heap snapshot before/after operations
3. Compare snapshots for detached DOM nodes
4. Monitor memory growth over time

### Leak Detection Tests

1. Navigate between pages repeatedly
2. Play/pause multiple tracks
3. Perform searches rapidly
4. Use visualizer with multiple presets
5. Use FFmpeg for conversions

### Manual Cleanup Verification

1. Check event listeners in DevTools
2. Verify intervals are cleared
3. Verify workers are terminated
4. Verify audio contexts are closed

## Success Criteria

- [ ] All event listeners have cleanup functions
- [ ] All intervals/timeouts are cancelled on unmount
- [ ] Audio contexts properly closed
- [ ] FFmpeg workers terminated
- [ ] No memory growth after 30min use
- [ ] No detached DOM nodes
- [ ] Memory monitor alerts on leaks
- [ ] Cleanup functions tested

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Test thoroughly after changes |
| Performance overhead from monitoring | Low | Make monitoring optional/dev-only |
| Audio context closure issues | Medium | Add fallback for iOS |
| Worker termination race conditions | Low | Use proper async handling |

## Security Considerations

- Ensure cleanup doesn't leave sensitive data in memory
- Clear cached audio data on cleanup
- Terminate workers completely (no lingering processes)

## Next Steps

- Complete Phase 03: Bundle Optimization
- Monitor production memory usage
- Address any leaks detected

## Unresolved Questions

1. Should memory monitoring be enabled in production?
2. What's the acceptable memory growth threshold?
3. Should we implement automatic garbage collection triggers?
