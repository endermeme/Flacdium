// js/memory-monitor.js
/**
 * Memory Monitor - Track memory usage and detect potential leaks
 *
 * Provides tools for monitoring memory, detecting leaks, and
 * reporting performance metrics.
 */
export class MemoryMonitor {
    constructor(options = {}) {
        this.enabled = options.enabled !== false; // Default enabled
        this.snapshots = [];
        this.maxSnapshots = options.maxSnapshots || 50;
        this.memoryGrowthThreshold = options.memoryGrowthThreshold || 10 * 1024 * 1024; // 10MB
        this.checkInterval = options.checkInterval || 30000; // 30 seconds
        this.checkTimer = null;
        this.baselineMemory = null;
    }

    /**
     * Start memory monitoring
     */
    start() {
        if (!this.enabled) {
            console.log('Memory monitoring is disabled');
            return;
        }

        // Take baseline snapshot
        this.takeSnapshot();

        // Set up periodic checks
        this.checkTimer = setInterval(() => {
            this.checkMemoryGrowth();
        }, this.checkInterval);

        console.log('Memory monitoring started');
    }

    /**
     * Stop memory monitoring
     */
    stop() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
        console.log('Memory monitoring stopped');
    }

    /**
     * Take a memory snapshot
     * @returns {Object} Snapshot data
     */
    takeSnapshot() {
        const memoryInfo = this.getMemoryInfo();

        const snapshot = {
            timestamp: Date.now(),
            usedJSHeapSize: memoryInfo.usedJSHeapSize || 0,
            totalJSHeapSize: memoryInfo.totalJSHeapSize || 0,
            jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit || 0,
        };

        // Add to snapshots
        this.snapshots.push(snapshot);

        // Set baseline if this is first snapshot
        if (!this.baselineMemory) {
            this.baselineMemory = snapshot.usedJSHeapSize;
        }

        // Remove old snapshots if we have too many
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }

        return snapshot;
    }

    /**
     * Check for memory growth and potential leaks
     */
    checkMemoryGrowth() {
        const snapshot = this.takeSnapshot();

        // Calculate growth from baseline
        const growth = snapshot.usedJSHeapSize - this.baselineMemory;

        // Alert if memory has grown significantly
        if (growth > this.memoryGrowthThreshold) {
            const growthMB = (growth / (1024 * 1024)).toFixed(2);
            console.warn(`⚠️ Memory growth detected: ${growthMB}MB`, {
                baseline: (this.baselineMemory / (1024 * 1024)).toFixed(2) + 'MB',
                current: (snapshot.usedJSHeapSize / (1024 * 1024)).toFixed(2) + 'MB',
                growth: growthMB + 'MB',
            });

            // Update baseline to current level (to avoid repeated alerts)
            this.baselineMemory = snapshot.usedJSHeapSize;
        }
    }

    /**
     * Get memory information from browser
     * @returns {Object} Memory info if available
     */
    getMemoryInfo() {
        if (window.performance && performance.memory) {
            return performance.memory;
        }
        return {
            usedJSHeapSize: null,
            totalJSHeapSize: null,
            jsHeapSizeLimit: null,
        };
    }

    /**
     * Check if a memory leak might be present
     * @returns {boolean} True if leak detected
     */
    hasPotentialLeak() {
        if (this.snapshots.length < 2) {
            return false;
        }

        const recent = this.snapshots[this.snapshots.length - 1];
        const previous = this.snapshots[this.snapshots.length - 2];

        if (!recent || !previous) {
            return false;
        }

        // Calculate growth between last two snapshots
        const growth = recent.usedJSHeapSize - previous.usedJSHeapSize;

        // Check if memory is growing without good reason
        const isGrowing = growth > this.memoryGrowthThreshold / 10; // Small but consistent growth

        // Check if we have consistent growth over multiple snapshots
        if (this.snapshots.length >= 3) {
            const snapshotsToCheck = this.snapshots.slice(-5); // Last 5 snapshots
            let growthCount = 0;

            for (let i = 1; i < snapshotsToCheck.length; i++) {
                const growth = snapshotsToCheck[i].usedJSHeapSize - snapshotsToCheck[i - 1].usedJSHeapSize;
                if (growth > 0) {
                    growthCount++;
                }
            }

            // If 4 out of 5 intervals show growth, consider it a leak
            return growthCount >= 4;
        }

        return isGrowing;
    }

    /**
     * Get memory statistics
     * @returns {Object} Memory statistics
     */
    getStats() {
        if (this.snapshots.length === 0) {
            return {
                enabled: this.enabled,
                snapshots: 0,
            };
        }

        const currentSnapshot = this.snapshots[this.snapshots.length - 1];
        const totalGrowth = currentSnapshot.usedJSHeapSize - this.baselineMemory;

        return {
            enabled: this.enabled,
            snapshots: this.snapshots.length,
            currentMemoryMB: (currentSnapshot.usedJSHeapSize / (1024 * 1024)).toFixed(2),
            baselineMemoryMB: (this.baselineMemory / (1024 * 1024)).toFixed(2),
            totalGrowthMB: (totalGrowth / (1024 * 1024)).toFixed(2),
            potentialLeak: this.hasPotentialLeak(),
            monitorActive: this.checkTimer !== null,
        };
    }

    /**
     * Generate memory report
     * @returns {string} Formatted report
     */
    generateReport() {
        const stats = this.getStats();

        let report = '📊 Memory Monitor Report\n';
        report += '=' .repeat(50) + '\n\n';
        report += `Status: ${stats.enabled ? '✅ Enabled' : '❌ Disabled'}\n`;
        report += `Snapshots: ${stats.snapshots}\n`;
        report += `Monitor Active: ${stats.monitorActive ? '✅ Yes' : '❌ No'}\n\n`;

        if (stats.snapshots > 0) {
            report += `Current Memory: ${stats.currentMemoryMB} MB\n`;
            report += `Baseline Memory: ${stats.baselineMemoryMB} MB\n`;
            report += `Total Growth: ${stats.totalGrowthMB} MB\n`;
            report += `Potential Leak: ${stats.potentialLeak ? '⚠️ Yes' : '✅ No'}\n\n`;
        }

        report += '=' .repeat(50);

        return report;
    }

    /**
     * Log memory stats to console
     */
    logStats() {
        console.log(this.generateReport());
    }

    /**
     * Force garbage collection (if available)
     * Note: This is a browser-specific feature and may not work in all browsers
     */
    forceGC() {
        if (typeof gc === 'function') {
            gc();
            console.log('Forced garbage collection');
            // Take new snapshot after GC
            setTimeout(() => this.takeSnapshot(), 100);
        } else {
            console.log('Manual GC not available in this browser');
        }
    }
}

// Singleton instance
let memoryMonitorInstance = null;

export function getMemoryMonitor(options) {
    if (!memoryMonitorInstance) {
        memoryMonitorInstance = new MemoryMonitor(options);
    }
    return memoryMonitorInstance;
}

export function resetMemoryMonitor() {
    if (memoryMonitorInstance) {
        memoryMonitorInstance.stop();
        memoryMonitorInstance = null;
    }
}