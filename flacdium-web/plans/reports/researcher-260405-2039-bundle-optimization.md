# Bundle Optimization Research Report

## 1. Dynamic Imports & Lazy Loading

### Vite Code Splitting Strategies

```javascript
// Route-based splitting
const Dashboard = () => import('./views/Dashboard.vue')
const Player = () => import('./views/Player.vue')

// Component-based splitting
const FFmpegProcessor = () => import('./components/FFmpegProcessor.vue')
const ButterchurnVisualizer = () => import('./components/ButterchurnVisualizer.vue')

// Conditional loading
const loadFeature = async (feature) => {
  switch(feature) {
    case 'ffmpeg':
      return import('./features/ffmpeg.js')
    case 'butterchurn':
      return import('./features/butterchurn.js')
  }
}
```

### Implementation Patterns

```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Group vendor libraries
          vendor: ['vue', 'pinia'],
          // Group heavy dependencies
          media: ['ffmpeg.js', 'butterchurn'],
          // Group icons
          icons: ['lucide-static', 'simple-icons']
        }
      }
    }
  }
})
```

## 2. FFmpeg Lazy Loading

### Web Worker Implementation

```javascript
// worker.js - Heavy processing in worker
self.importScripts('ffmpeg-core.js')

self.onmessage = async (e) => {
  const { type, data } = e.data
  switch(type) {
    case 'process':
      const result = await FFmpeg.run(...data.args)
      self.postMessage({ result })
      break
  }
}

// Component usage
let ffmpegWorker = null

const loadFFmpeg = async () => {
  if (!ffmpegWorker) {
    const workerModule = await import('./workers/ffmpeg.js')
    ffmpegWorker = new Worker(workerModule.default)

    workerModule.onmessage = (e) => {
      handleFFmpegResult(e.data)
    }
  }
  return ffmpegWorker
}
```

### Progress Indicators

```javascript
const loadWithProgress = (importFn) => {
  return new Promise((resolve, reject) => {
    const loadingPromise = importFn()
    loadingPromise.then(resolve).catch(reject)
  })
}
```

## 3. Icon Optimization

### Tree Shaking Configuration

```javascript
// vite.config.js
export default defineConfig({
  optimizeDeps: {
    include: ['lucide-static/icons'],
    exclude: ['lucide-static/all'] // Avoid importing all icons
  }
})

// Usage - tree shakeable imports
import { Play, Pause, Volume2 } from 'lucide-static/icons'
```

### SVG Sprite vs Individual Icons

```javascript
// Option 1: Dynamic icon loading
const Icon = ({ name }) => {
  const icon = require(`@/icons/${name}.svg`)
  return img({ src: icon })
}

// Option 2: Icon preloading
const preloadIcons = (iconNames) => {
  iconNames.forEach(name => {
    const icon = new Image()
    icon.src = require(`@/icons/${name}.svg`)
  })
}
```

### Custom Icon Builds

```bash
# Generate only required icons
npx lucide-static --output ./src/icons --icons play,pause,stop,volume
```

## 4. Bundle Measurement

### vite-bundle-visualizer Usage

```bash
npm install --save-dev vite-bundle-visualizer
```

```javascript
// vite.config.js
import { visualize } from 'vite-bundle-visualizer'

export default defineConfig({
  plugins: [
    visualize({ open: true, brotliSize: true })
  ]
})
```

### Bundle Size Thresholds

```javascript
// vite.config.js
export default defineConfig({
  build: {
    reportSizeChange: true,
    chunkSizeWarningLimit: 1000 // kB
  }
})
```

### Performance Budgets

```javascript
// budget.json
{
  "total": {
    "warning": "500kB",
    "error": "1000kB"
  },
  "chunks": {
    "vendor": {
      "warning": "200kB",
      "error": "400kB"
    },
    "ffmpeg": {
      "warning": "300kB",
      "error": "600kB"
    }
  }
}
```

## 5. Dead Code Elimination

### Vite Tree Shaking Configuration

```javascript
// vite.config.js
export default defineConfig({
  optimizeDeps: {
    include: [],
    exclude: ['debug-tools']
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
})
```

### ES Module Imports

```javascript
// Use named imports for better tree-shaking
import { debounce, throttle } from 'lodash-es' // instead of lodash
import { createFFmpeg } from '@ffmpeg/ffmpeg' // ES module version
```

### Plugin Configuration

```javascript
// vite.config.js
import { splitVendorPlugin } from 'vite-plugin-split-vendor'

export default defineConfig({
  plugins: [
    splitVendorPlugin({
      include: ['vue', 'vue-router', 'pinia'],
      exclude: ['@ffmpeg/ffmpeg']
    })
  ]
})
```

## Music Streaming App Recommendations

### Critical Configuration

```javascript
// vite.config.js - Music streaming optimized
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core framework
          framework: ['vue', 'vue-router', 'pinia'],
          // Audio processing
          audio: ['howler', 'wavesurfer.js'],
          // Heavy dependencies
          media: ['@ffmpeg/ffmpeg', '@ffmpeg/core', 'butterchurn'],
          // Icons
          icons: ['lucide-static/icons'],
          // UI components
          ui: ['element-plus', '@vueuse/core']
        }
      }
    }
  }
})
```

### Loading Strategy

```javascript
// Progressive loading for music app
const loadMediaFeatures = async () => {
  // Load core features immediately
  const core = await import('./core.js')

  // Load FFmpeg on demand for processing
  const ffmpeg = await import('./ffmpeg.js')

  // Load visualizer when needed
  const visualizer = await import('./visualizer.js')

  return { core, ffmpeg, visualizer }
}
```

### Bundle Size Targets

- **Initial load**: < 500KB
- **Critical CSS**: < 100KB
- **Media features**: < 1MB (lazy loaded)
- **FFmpeg bundle**: < 3MB (chunked and lazy loaded)

### Next Steps

1. Implement dynamic imports for media processing features
2. Configure FFmpeg to load in Web Worker
3. Set up bundle analyzer with size thresholds
4. Implement icon tree shaking
5. Add performance budgets to CI pipeline
6. Test lazy loading with network throttling