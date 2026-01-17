// frontend/vite.config.ts - FIXED

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Server configuration
  server: {
    port: 3001,
    host: true,
    strictPort: true,
    open: false,
    cors: true,
    proxy: {
      // Proxy API requests to backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'mui-vendor': [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled',
          ],
          'flow-vendor': ['reactflow'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  
  // Optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      'reactflow',
      'axios',
      'zustand',
      '@tanstack/react-query',
    ],
  },
  
  // Environment variables
  envPrefix: 'VITE_',
  
  // Preview server (for production build testing)
  preview: {
    port: 3001,
    host: true,
    strictPort: true,
  },
});