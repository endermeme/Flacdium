---
title: "Phase 03: Code Splitting & Bundle Optimization"
description: "Implement lazy loading for FFmpeg, add manual chunks for vendor libraries, optimize icon loading with tree shaking, configure bundle size thresholds, set up bundle analysis"
status: pending
priority: P2
effort: 4h
branch: main
tags: [performance, bundle, optimization]
created: 2026-04-05
---

# Phase 03: Code Splitting & Bundle Optimization

## Context Links

- [Research Report](../../reports/researcher-260405-2039-bundle-optimization.md)
- [Related Files](#related-code-files)

## Overview

**Priority:** P2 (MEDIUM PRIORITY)
**Status:** pending
**Est. Time:** 4 hours

Current bundle size impacts initial load time and user experience. FFmpeg, icons, and vendor libraries contribute significantly to bundle size. Optimization needed for:
- Lazy loading FFmpeg (25MB+)
- Manual chunk splitting for vendor libraries
- Icon tree shaking
- Bundle size thresholds
- Bundle analysis tools

## Key Insights from Research

1. FFmpeg can be lazy-loaded to reduce initial bundle by 25MB
2. Manual chunks improve caching strategies
3. Icon tree shaking reduces unused icon imports
4. Bundle analysis identifies optimization opportunities
5. Performance budgets prevent regressions

## Requirements

### Functional Requirements

- FFmpeg lazy-loaded on demand
- Vendor libraries split into separate chunks
- Icons tree-shaken to only used icons
- Bundle size thresholds enforced
- Bundle analysis available on build

### Non-Functional Requirements

- Initial bundle < 500KB gzipped
- Time to interactive < 3s
- 95+ Lighthouse performance score
- Bundle analysis report generated

## Architecture

### Bundle Structure

```
Initial Load (< 500KB):
├── vendor.js (frameworks: Vue, Vue Router, Pinia)
├── app.js (core app code)
├── icons.js (tree-shaken icons only)
└── common.js (shared utilities)

Lazy Loaded:
├── ffmpeg.js (25MB - on demand)
├── visualizer.js (2MB - on demand)
├── audio.js (1MB - on demand)
└── download.js (500KB - on demand)
```

### Loading Strategy

```
App Load:
1. Load initial bundle (< 500KB)
2. Initialize core UI
3. Start playback with basic audio
4. Lazy load FFmpeg when user downloads
5. Lazy load visualizer when user enables it
```

## Related Code Files

### Files to Modify

1. **`/home/binhtagilla/Desktop/monochrome/vite.config.ts`**
   - Add manual chunks configuration
   - Configure bundle size limits
   - Add bundle analysis plugin

2. **`/home/binhtagilla/Desktop/monochrome/js/ffmpeg.js`**
   - Already lazy-loaded (verify implementation)
   - Ensure worker is also lazy-loaded

3. **`/home/binhtagilla/Desktop/monochrome/js/icons.js`**
   - Implement tree-shakeable imports
   - Only import used icons

4. **`/home/binhtagilla/Desktop/monochrome/package.json`**
   - Add bundle analysis script
   - Update build script

### Files to Create

1. **`/home/binhtagilla/Desktop/monochrome/js/lazy-loads.js`**
   - Centralized lazy loading utilities
   - Loading state management
   - Error handling

2. **`/home/binhtagilla/Desktop/monochrome/budget.json`**
   - Bundle size budgets
   - Chunk size limits
   - Performance budgets

## Implementation Steps

### Step 1: Configure Manual Chunks (1h)

1.1 Update `vite.config.ts`:
   ```typescript
   import { defineConfig } from 'vite';
   import { visualizer } from 'rollup-plugin-visualizer';

   export default defineConfig({
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             // Core framework
             'vendor-framework': ['vue', 'vue-router', 'pinia'],
             // Audio processing
             'vendor-audio': ['howler', 'wavesurfer.js', 'hls.js', 'shaka-player'],
             // Media processing
             'vendor-media': ['@ffmpeg/ffmpeg', '@ffmpeg/core', 'butterchurn'],
             // Icons
             'vendor-icons': ['lucide-static', 'simple-icons'],
             // Utilities
             'vendor-utils': ['eventemitter3', 'fuse.js', 'uuid'],
           }
         }
       },
       chunkSizeWarningLimit: 1000, // 1MB
       reportSizeChange: true
     },
     plugins: [
       visualizer({
         open: false,
         gzipSize: true,
         brotliSize: true
       })
     ]
   });
   ```

1.2 Optimize deps configuration:
   ```typescript
   optimizeDeps: {
     include: [
       'lucide-static/icons',
       'simple-icons/icons'
     ],
     exclude: [
       'pocketbase',
       '@ffmpeg/ffmpeg',
       '@ffmpeg/core'
     ]
   }
   ```

### Step 2: Lazy Load FFmpeg (45m)

2.1 Verify current FFmpeg lazy loading in `js/ffmpeg.js`:
   ```javascript
   // Current implementation (verify this works)
   export function loadFfmpeg() {
     return (
       loadFfmpeg.promise ||
       (loadFfmpeg.promise = (async () => {
         const data = {
           coreURL: await coreJs(),
           wasmURL: await coreWasm(),
         };
         return data;
       })())
     );
   }
   ```

2.2 Ensure FFmpeg worker is also lazy:
   ```javascript
   // In ffmpeg.worker.js
   // This should already be lazy-loaded via ?worker suffix
   ```

2.3 Add loading state management:
   ```javascript
   export async function loadFFmpegWithProgress(onProgress) {
     onProgress?.({ stage: 'loading', progress: 0 });
     try {
       const data = await loadFfmpeg();
       onProgress?.({ stage: 'loading', progress: 100 });
       return data;
     } catch (error) {
       onProgress?.({ stage: 'error', error });
       throw error;
     }
   }
   ```

### Step 3: Optimize Icon Loading (1h)

3.1 Audit icon usage:
   ```bash
   # Find all icon imports
   grep -r "SVG_" js/ | grep import | sort -u
   ```

3.2 Create optimized icon imports in `js/icons.js`:
   ```javascript
   // Instead of importing all icons, import only used ones
   import {
     Search as SVG_SEARCH,
     Play as SVG_PLAY,
     Pause as SVG_PAUSE,
     // ... only used icons
   } from 'lucide-static/icons';

   import {
     Spotify as ICON_SPOTIFY,
     // ... only used icons
   } from 'simple-icons';

   export {
     SVG_SEARCH,
     SVG_PLAY,
     SVG_PAUSE,
     ICON_SPOTIFY,
     // ... only used exports
   };
   ```

3.3 Implement dynamic icon loading:
   ```javascript
   // For rare icons, load on demand
   export async function loadIcon(name) {
     const iconModule = await import(`!lucide/${name}.svg`);
     return iconModule.default;
   }
   ```

3.4 Update vite alias for icon optimization:
   ```typescript
   resolve: {
     alias: {
       '!lucide': '/node_modules/lucide-static/icons',
       '!simpleicons': '/node_modules/simple-icons/icons',
     }
   }
   ```

### Step 4: Configure Bundle Thresholds (30m)

4.1 Create `budget.json`:
   ```json
   {
     "total": {
       "warning": "500KB",
       "error": "1000KB"
     },
     "chunks": {
       "vendor-framework": {
         "warning": "200KB",
         "error": "400KB"
       },
       "vendor-audio": {
         "warning": "150KB",
         "error": "300KB"
       },
       "vendor-icons": {
         "warning": "50KB",
         "error": "100KB"
       },
       "app": {
         "warning": "100KB",
         "error": "200KB"
       }
     }
   }
   ```

4.2 Add bundle size check to build:
   ```javascript
   // Create scripts/check-bundle-size.js
   import fs from 'fs';
   import gzipSize from 'gzip-size';

   const budgets = JSON.parse(fs.readFileSync('./budget.json', 'utf8'));
   const distFiles = fs.readdirSync('./dist/assets')
     .filter(f => f.endsWith('.js'));

   let failed = false;

   for (const file of distFiles) {
     const buffer = fs.readFileSync(`./dist/assets/${file}`);
     const size = gzipSize.sync(buffer);
     const sizeKB = (size / 1024).toFixed(2) + 'KB';

     console.log(`${file}: ${sizeKB}`);

     // Check against budget
     // ... budget checking logic
   }

   if (failed) process.exit(1);
   ```

4.3 Update package.json scripts:
   ```json
   {
     "scripts": {
       "build": "vite build && node scripts/check-bundle-size.js && vite-bundle-visualizer",
       "analyze": "vite-bundle-visualizer"
     }
   }
   ```

### Step 5: Add Bundle Analysis (45m)

5.1 Configure bundle visualizer:
   ```typescript
   import { visualizer } from 'rollup-plugin-visualizer';

   plugins: [
     visualizer({
       filename: './dist/assets/bundle-stats.html',
       open: false,
       gzipSize: true,
       brotliSize: true,
       template: 'treemap'
     })
   ]
   ```

5.2 Create analysis report script:
   ```javascript
   // scripts/analyze-bundle.js
   import { readFileSync } from 'fs';
   import { gzipSize } from 'gzip-size';

   function analyzeBundle() {
     const stats = JSON.parse(readFileSync('./dist/assets/bundle-stats.json', 'utf8'));

     const report = {
       totalSize: 0,
       totalGzip: 0,
       chunks: []
     };

     for (const chunk of stats.chunks) {
       const gzip = gzipSize.sync(chunk.code);
       report.chunks.push({
         name: chunk.name,
         size: chunk.code.length,
         gzip,
         modules: chunk.modules.length
       });
       report.totalSize += chunk.code.length;
       report.totalGzip += gzip;
     }

     console.table(report.chunks);
     console.log(`Total: ${formatBytes(report.totalGzip)}`);
   }

   analyzeBundle();
   ```

5.3 Add performance monitoring:
   ```javascript
   // Add to app initialization
   if (import.meta.env.PROD) {
     const perfData = {
       bundleLoadTime: performance.now(),
       timeToInteractive: null
     };

     window.addEventListener('load', () => {
       perfData.timeToInteractive = performance.now();
       // Send to analytics
     });
   }
   ```

## Testing Strategy

### Bundle Analysis

1. Build app and review bundle visualizer
2. Identify largest chunks
3. Check for duplicate dependencies
4. Verify code splitting is working

### Performance Testing

1. Measure initial load time with DevTools
2. Test on slow 3G network
3. Verify lazy loading works
4. Check cache hit rates

### Regression Testing

1. Run bundle size check on every build
2. Alert on size increases > 10%
3. Review bundle changes weekly

## Success Criteria

- [ ] Initial bundle < 500KB gzipped
- [ ] FFmpeg lazy-loaded on demand
- [ ] Icons tree-shaken
- [ ] Vendor chunks properly split
- [ ] Bundle size thresholds enforced
- [ ] Bundle analysis report generated
- [ ] Time to interactive < 3s
- [ ] Lighthouse performance > 90

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Lazy loading adds complexity | Medium | Provide clear loading states |
| Chunk splitting breaks caching | Low | Use stable chunk names |
| Tree shaking removes needed code | Medium | Test thoroughly after optimization |
| Bundle size increases unexpectedly | Low | Automate size checks |

## Security Considerations

- Lazy-loaded chunks must be authenticated
- Check bundle integrity on load
- Prevent injection attacks in dynamic imports

## Next Steps

- Deploy optimized bundle to staging
- Monitor production bundle sizes
- Iterate based on real-world metrics

## Unresolved Questions

1. Should we implement service worker caching for chunks?
2. What's the optimal chunk size for caching?
3. Should we preload critical chunks?
4. How to handle bundle updates in PWA?
