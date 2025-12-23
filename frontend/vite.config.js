import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh
      fastRefresh: true
    })
  ],
  server: {
    port: 3000
  },
  build: {
    // Enable code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'pdf-vendor': ['pdfjs-dist'],
          'ocr-vendor': ['tesseract.js']
        }
      }
    },
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Minify output with esbuild (faster than terser)
    minify: 'esbuild',
    // Source maps for production debugging (optional, set to false to reduce size)
    sourcemap: false
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
})
