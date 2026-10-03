import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const engineSrc = path.resolve(__dirname, '../../packages/orbital-core/src/index.ts')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Consume the engine from source: instant HMR, no separate build step
      '@aperture/orbital-core': engineSrc,
    },
  },
  server: {
    port: 3000,
    host: true,
    fs: { allow: [path.resolve(__dirname, '../..')] },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // land-50m (≈170 KB gzip) is a lazily loaded map-detail chunk
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          geo: ['d3-geo', 'topojson-client'],
        },
      },
    },
  },
})
