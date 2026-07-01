// js/lazy-loads.js
/**
 * Lazy Loading Utilities - Manage dynamic imports and loading states
 *
 * Provides utilities for lazy loading heavy dependencies like FFmpeg,
 * butterchurn, and other resource-intensive modules.
 */
export class LazyLoadManager {
    constructor() {
        this.loadedModules = new Map();
        this.loadingPromises = new Map();
    }

    /**
     * Lazy load FFmpeg module
     * @returns {Promise<any>} FFmpeg module
     */
    async loadFFmpeg() {
        const moduleName = 'ffmpeg';

        // Return cached module if already loaded
        if (this.loadedModules.has(moduleName)) {
            return this.loadedModules.get(moduleName);
        }

        // Return existing promise if currently loading
        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }

        // Start loading
        const loadingPromise = this.loadModule(moduleName, async () => {
            try {
                // Dynamic import FFmpeg module
                const ffmpegModule = await import('./ffmpeg.js');

                // Verify FFmpeg is loaded properly
                if (ffmpegModule && ffmpegModule.loadFfmpeg) {
                    await ffmpegModule.loadFfmpeg();
                    return ffmpegModule;
                }

                throw new Error('FFmpeg module loaded but loadFfmpeg function not found');
            } catch (error) {
                console.error('Failed to load FFmpeg:', error);
                throw error;
            }
        });

        this.loadingPromises.set(moduleName, loadingPromise);

        try {
            const module = await loadingPromise;
            this.loadedModules.set(moduleName, module);
            return module;
        } finally {
            this.loadingPromises.delete(moduleName);
        }
    }

    /**
     * Lazy load butterchurn visualizer
     * @returns {Promise<any>} Butterchurn module
     */
    async loadButterchurn() {
        const moduleName = 'butterchurn';

        // Return cached module if already loaded
        if (this.loadedModules.has(moduleName)) {
            return this.loadedModules.get(moduleName);
        }

        // Return existing promise if currently loading
        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }

        // Start loading
        const loadingPromise = this.loadModule(moduleName, async () => {
            try {
                // Check if butterchurn is available
                const { default: butterchurn } = await import('butterchurn');
                return butterchurn;
            } catch (error) {
                console.error('Failed to load butterchurn:', error);
                throw error;
            }
        });

        this.loadingPromises.set(moduleName, loadingPromise);

        try {
            const module = await loadingPromise;
            this.loadedModules.set(moduleName, module);
            return module;
        } finally {
            this.loadingPromises.delete(moduleName);
        }
    }

    /**
     * Lazy load Shaka Player (video streaming)
     * @returns {Promise<any>} Shaka Player module
     */
    async loadShakaPlayer() {
        const moduleName = 'shaka-player';

        // Return cached module if already loaded
        if (this.loadedModules.has(moduleName)) {
            return this.loadedModules.get(moduleName);
        }

        // Return existing promise if currently loading
        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }

        // Start loading
        const loadingPromise = this.loadModule(moduleName, async () => {
            try {
                const shakaModule = await import('shaka-player/dist/shaka-player.ui.js');
                return shakaModule;
            } catch (error) {
                console.error('Failed to load Shaka Player:', error);
                throw error;
            }
        });

        this.loadingPromises.set(moduleName, loadingPromise);

        try {
            const module = await loadingPromise;
            this.loadedModules.set(moduleName, module);
            return module;
        } finally {
            this.loadingPromises.delete(moduleName);
        }
    }

    /**
     * Generic module loader with error handling
     * @private
     * @param {string} moduleName - Name of the module for tracking
     * @param {Function} loaderFn - Function to load the module
     * @returns {Promise<any>} Loaded module
     */
    async loadModule(moduleName, loaderFn) {
        const startTime = performance.now();

        try {
            const module = await loaderFn();
            const loadTime = performance.now() - startTime;

            console.log(`✅ Loaded module "${moduleName}" in ${loadTime.toFixed(0)}ms`);

            return module;
        } catch (error) {
            const loadTime = performance.now() - startTime;
            console.error(`❌ Failed to load module "${moduleName}" after ${loadTime.toFixed(0)}ms:`, error);

            // Provide helpful error messages
            throw new Error(`Failed to load ${moduleName}: ${error.message}`);
        }
    }

    /**
     * Check if a module is currently loading
     * @param {string} moduleName - Name of the module
     * @returns {boolean} True if currently loading
     */
    isLoading(moduleName) {
        return this.loadingPromises.has(moduleName);
    }

    /**
     * Check if a module is already loaded
     * @param {string} moduleName - Name of the module
     * @returns {boolean} True if already loaded
     */
    isLoaded(moduleName) {
        return this.loadedModules.has(moduleName);
    }

    /**
     * Get loading status for all modules
     * @returns {Object} Status of all tracked modules
     */
    getStatus() {
        return {
            loaded: Array.from(this.loadedModules.keys()),
            loading: Array.from(this.loadingPromises.keys()),
            totalModules: this.loadedModules.size + this.loadingPromises.size,
        };
    }

    /**
     * Preload specific modules
     * @param {string[]} moduleNames - Array of module names to preload
     */
    async preloadModules(moduleNames) {
        console.log(`Preloading modules: ${moduleNames.join(', ')}`);

        const loadPromises = moduleNames.map(moduleName => {
            switch (moduleName) {
                case 'ffmpeg':
                    return this.loadFFmpeg();
                case 'butterchurn':
                    return this.loadButterchurn();
                case 'shaka-player':
                    return this.loadShakaPlayer();
                default:
                    console.warn(`Unknown module for preloading: ${moduleName}`);
                    return Promise.resolve(null);
            }
        });

        try {
            await Promise.all(loadPromises);
            console.log(`✅ Preloaded ${moduleNames.length} modules`);
        } catch (error) {
            console.error(`❌ Failed to preload modules:`, error);
            throw error;
        }
    }

    /**
     * Clear all loaded modules (for testing/reset)
     */
    clearCache() {
        this.loadedModules.clear();
        this.loadingPromises.clear();
        console.log('🗑️ Cleared all lazy-loaded modules cache');
    }
}

// Singleton instance
let lazyLoadManagerInstance = null;

export function getLazyLoadManager() {
    if (!lazyLoadManagerInstance) {
        lazyLoadManagerInstance = new LazyLoadManager();
    }
    return lazyLoadManagerInstance;
}

export function resetLazyLoadManager() {
    if (lazyLoadManagerInstance) {
        lazyLoadManagerInstance.clearCache();
    }
}