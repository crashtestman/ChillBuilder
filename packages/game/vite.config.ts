import { defineConfig } from 'vite';

// base: './' is required so the built assets resolve with relative paths —
// Capacitor's local WebView and Electron's loadFile() don't serve from a URL root.
export default defineConfig({
    base: './',
    build: {
        target: 'es2020',
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        }
    },
    server: {
        port: 8080
    }
});
