// js/cleanup-manager.js
/**
 * Cleanup Manager - Centralized resource cleanup management
 *
 * Prevents memory leaks by tracking and managing cleanup functions
 * for event listeners, intervals, timeouts, animation frames, and other resources.
 */
export class CleanupManager {
    constructor() {
        this.resources = new Map();
        this.eventListeners = new Map();
        this.intervals = new Set();
        this.timeouts = new Set();
        this.animationFrames = new Set();
        this.abortControllers = new Set();
        this.audioContexts = new Set();
        this.workers = new Set();
    }

    /**
     * Register a cleanup function for a specific resource ID
     * @param {string} id - Unique identifier for the resource
     * @param {Function} cleanupFn - Function to call when cleanup is needed
     */
    register(id, cleanupFn) {
        if (!this.resources.has(id)) {
            this.resources.set(id, new Set());
        }
        this.resources.get(id).add(cleanupFn);
    }

    /**
     * Execute all cleanup functions for a specific resource ID
     * @param {string} id - Unique identifier for the resource
     */
    cleanup(id) {
        const cleanups = this.resources.get(id);
        if (cleanups) {
            cleanups.forEach(fn => {
                try {
                    fn();
                } catch (error) {
                    console.warn(`Cleanup failed for ${id}:`, error);
                }
            });
            this.resources.delete(id);
        }
    }

    /**
     * Cleanup all registered resources
     */
    cleanupAll() {
        // Cleanup all registered resources
        this.resources.forEach((cleanups, id) => {
            cleanups.forEach(fn => {
                try {
                    fn();
                } catch (error) {
                    console.warn(`Cleanup failed for ${id}:`, error);
                }
            });
        });
        this.resources.clear();

        // Cleanup all tracked resources individually
        this.clearEventListeners();
        this.clearIntervals();
        this.clearTimeouts();
        this.clearAnimationFrames();
        this.clearAbortControllers();
        this.clearAudioContexts();
        this.clearWorkers();
    }

    /**
     * Track event listener for cleanup
     * @param {EventTarget} target - Event target (element, window, etc.)
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @returns {Function} Cleanup function
     */
    addEventListener(target, event, handler, options) {
        target.addEventListener(event, handler, options);

        const cleanupFn = () => {
            target.removeEventListener(event, handler, options);
        };

        const key = `${target.constructor.name}-${event}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, new Set());
        }
        this.eventListeners.get(key).add(cleanupFn);

        return cleanupFn;
    }

    /**
     * Clear all tracked event listeners
     */
    clearEventListeners() {
        this.eventListeners.forEach((cleanups, key) => {
            cleanups.forEach(fn => {
                try {
                    fn();
                } catch (error) {
                    console.warn(`Failed to clear event listener ${key}:`, error);
                }
            });
        });
        this.eventListeners.clear();
    }

    /**
     * Track interval for cleanup
     * @param {Function} callback - Interval callback
     * @param {number} delay - Interval delay in ms
     * @returns {number} Interval ID
     */
    setInterval(callback, delay) {
        const id = window.setInterval(callback, delay);
        this.intervals.add(id);
        return id;
    }

    /**
     * Clear specific interval
     * @param {number} id - Interval ID to clear
     */
    clearInterval(id) {
        window.clearInterval(id);
        this.intervals.delete(id);
    }

    /**
     * Clear all tracked intervals
     */
    clearIntervals() {
        this.intervals.forEach(id => {
            window.clearInterval(id);
        });
        this.intervals.clear();
    }

    /**
     * Track timeout for cleanup
     * @param {Function} callback - Timeout callback
     * @param {number} delay - Timeout delay in ms
     * @returns {number} Timeout ID
     */
    setTimeout(callback, delay) {
        const id = window.setTimeout(callback, delay);
        this.timeouts.add(id);
        return id;
    }

    /**
     * Clear specific timeout
     * @param {number} id - Timeout ID to clear
     */
    clearTimeout(id) {
        window.clearTimeout(id);
        this.timeouts.delete(id);
    }

    /**
     * Clear all tracked timeouts
     */
    clearTimeouts() {
        this.timeouts.forEach(id => {
            window.clearTimeout(id);
        });
        this.timeouts.clear();
    }

    /**
     * Track animation frame for cleanup
     * @param {Function} callback - Animation frame callback
     * @returns {number} Animation frame ID
     */
    requestAnimationFrame(callback) {
        const id = window.requestAnimationFrame(callback);
        this.animationFrames.add(id);
        return id;
    }

    /**
     * Cancel specific animation frame
     * @param {number} id - Animation frame ID to cancel
     */
    cancelAnimationFrame(id) {
        window.cancelAnimationFrame(id);
        this.animationFrames.delete(id);
    }

    /**
     * Clear all tracked animation frames
     */
    clearAnimationFrames() {
        this.animationFrames.forEach(id => {
            window.cancelAnimationFrame(id);
        });
        this.animationFrames.clear();
    }

    /**
     * Track AbortController for cleanup
     * @param {AbortController} controller - AbortController to track
     */
    addAbortController(controller) {
        this.abortControllers.add(controller);
    }

    /**
     * Abort specific controller
     * @param {AbortController} controller - AbortController to abort
     */
    abortController(controller) {
        if (this.abortControllers.has(controller)) {
            controller.abort();
            this.abortControllers.delete(controller);
        }
    }

    /**
     * Clear all tracked abort controllers
     */
    clearAbortControllers() {
        this.abortControllers.forEach(controller => {
            try {
                controller.abort();
            } catch (error) {
                console.warn('Failed to abort controller:', error);
            }
        });
        this.abortControllers.clear();
    }

    /**
     * Track AudioContext for cleanup
     * @param {AudioContext} context - AudioContext to track
     */
    addAudioContext(context) {
        this.audioContexts.add(context);
    }

    /**
     * Close specific audio context
     * @param {AudioContext} context - AudioContext to close
     */
    closeAudioContext(context) {
        if (this.audioContexts.has(context)) {
            try {
                if (context.state !== 'closed') {
                    context.close();
                }
            } catch (error) {
                console.warn('Failed to close audio context:', error);
            }
            this.audioContexts.delete(context);
        }
    }

    /**
     * Close all tracked audio contexts
     */
    clearAudioContexts() {
        this.audioContexts.forEach(context => {
            try {
                if (context.state !== 'closed') {
                    context.close();
                }
            } catch (error) {
                console.warn('Failed to close audio context:', error);
            }
        });
        this.audioContexts.clear();
    }

    /**
     * Track Worker for cleanup
     * @param {Worker} worker - Worker to track
     */
    addWorker(worker) {
        this.workers.add(worker);
    }

    /**
     * Terminate specific worker
     * @param {Worker} worker - Worker to terminate
     */
    terminateWorker(worker) {
        if (this.workers.has(worker)) {
            try {
                if (worker.readyState !== 3) { // 3 = Worker terminated
                    worker.terminate();
                }
            } catch (error) {
                console.warn('Failed to terminate worker:', error);
            }
            this.workers.delete(worker);
        }
    }

    /**
     * Terminate all tracked workers
     */
    clearWorkers() {
        this.workers.forEach(worker => {
            try {
                if (worker.readyState !== 3) {
                    worker.terminate();
                }
            } catch (error) {
                console.warn('Failed to terminate worker:', error);
            }
        });
        this.workers.clear();
    }

    /**
     * Get cleanup statistics
     * @returns {Object} Statistics about tracked resources
     */
    getStats() {
        return {
            resources: this.resources.size,
            eventListeners: this.eventListeners.size,
            intervals: this.intervals.size,
            timeouts: this.timeouts.size,
            animationFrames: this.animationFrames.size,
            abortControllers: this.abortControllers.size,
            audioContexts: this.audioContexts.size,
            workers: this.workers.size,
        };
    }
}

// Singleton instance
let cleanupManagerInstance = null;

export function getCleanupManager() {
    if (!cleanupManagerInstance) {
        cleanupManagerInstance = new CleanupManager();
    }
    return cleanupManagerInstance;
}

export function resetCleanupManager() {
    if (cleanupManagerInstance) {
        cleanupManagerInstance.cleanupAll();
        cleanupManagerInstance = null;
    }
}