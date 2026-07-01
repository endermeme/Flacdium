import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import authGatePlugin from './vite-plugin-auth-gate.js';
import path from 'path';
import uploadPlugin from './vite-plugin-upload.js';
import blobAssetPlugin from './vite-plugin-blob.js';
import svgUse from './vite-plugin-svg-use.js';
import { execSync } from 'child_process';
import { playwright } from '@vitest/browser-playwright';

function getGitCommitHash() {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return 'unknown';
    }
}

export default defineConfig((_options) => {
    const commitHash = getGitCommitHash();

    return {
        test: {
            // https://vitest.dev/guide/browser/
            browser: {
                enabled: true,
                provider: playwright(),
                headless: !!process.env.HEADLESS,
                instances: [{ browser: 'chromium' }],
            },
        },
        base: './',
        define: {
            __COMMIT_HASH__: JSON.stringify(commitHash),
            __VITEST__: !!process.env.VITEST,
        },
        worker: {
            format: 'es',
        },
        resolve: {
            alias: {
                '!lucide': '/node_modules/lucide-static/icons',
                '!simpleicons': '/node_modules/simple-icons/icons',
                '!': '/node_modules',

                events: '/node_modules/events/events.js',
                pocketbase: '/node_modules/pocketbase/dist/pocketbase.es.js',
                stream: path.resolve(__dirname, 'stream-stub.js'), // Stub for stream module
            },
        },
        server: {
            fs: {
                allow: ['.', 'node_modules'],
                // host: true,
                // allowedHosts: ['<your_tailscale_hostname>'], // e.g. pi5.tailf5f622.ts.net
            },
        },
        // preview: {
        //     host: true,
        //     allowedHosts: ['<your_tailscale_hostname>'], // e.g. pi5.tailf5f622.ts.net
        // },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            sourcemap: true,
            rollupOptions: {
                output: {
                    // Split node_modules into stable chunks by package. Function form so the
                    // build never references packages that aren't installed (the previous
                    // static map listed vue/howler/etc. that don't exist here and broke the build).
                    manualChunks(id) {
                        if (!id.includes('node_modules')) return undefined;
                        if (id.includes('shaka-player')) return 'video';
                        if (id.includes('hls.js')) return 'audio';
                        if (id.includes('@ffmpeg') || id.includes('butterchurn')) return 'media';
                        if (id.includes('lucide-static') || id.includes('simple-icons')) return 'icons';
                        if (id.includes('fuse.js') || id.includes('uuid')) return 'utils';
                        if (id.includes('pocketbase')) return 'auth';
                        return 'vendor';
                    },
                },
            },
            chunkSizeWarningLimit: 1000, // 1MB warning limit
            reportSizeChange: true,
        },
        optimizeDeps: {
            include: [
                // Include specific icon imports for better tree shaking
                'lucide-static/icons',
                'simple-icons/icons',
            ],
            exclude: [
                'pocketbase',
                '@ffmpeg/ffmpeg',
                '@ffmpeg/util',
                '@ffmpeg/core',
            ],
        },
        plugins: [
            authGatePlugin(),
            uploadPlugin(),
            blobAssetPlugin(),
            svgUse(),
            VitePWA({
                registerType: 'prompt',
                workbox: {
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
                    cleanupOutdatedCaches: true,
                    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MiB limit
                    // Define runtime caching strategies
                    runtimeCaching: [
                        {
                            urlPattern: ({ request }) => request.destination === 'image',
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'images',
                                expiration: {
                                    maxEntries: 100,
                                    maxAgeSeconds: 60 * 24 * 60 * 60, // 60 Days
                                },
                            },
                        },
                        {
                            urlPattern: ({ request }) =>
                                request.destination === 'audio' || request.destination === 'video',
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'media',
                                expiration: {
                                    maxEntries: 50,
                                    maxAgeSeconds: 60 * 24 * 60 * 60, // 60 Days
                                },
                                rangeRequests: true, // Support scrubbing
                            },
                        },
                    ],
                },
                includeAssets: ['discord.html'],
                manifest: false, // Use existing public/manifest.json
            }),
        ],
    };
});
