import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          maps: ['deck.gl', 'react-map-gl', 'maplibre-gl'],
          charts: ['recharts'],
          ui: ['framer-motion', 'lucide-react'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@aperture/orbital-core'], // Let Bun handle this
  },
})