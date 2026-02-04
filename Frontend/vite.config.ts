import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    // Use jsdom environment for React component testing
    environment: 'jsdom',
    
    // Setup files for test utilities
    setupFiles: ['./src/test/setup.ts'],
    
    // Coverage settings
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/main.tsx',
        '**/*.d.ts',
        '**/index.ts'
      ],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    },
    
    // Globals: no need to import describe, it, expect, etc.
    globals: true,
    
    // Silent console in tests unless explicitly needed
    silent: false,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    middlewareMode: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5174,
    },
  },
  build: {
    // Target modern browsers for smaller bundles
    target: 'es2020',
    
    // Enable minification
    minify: 'terser',
    
    // Split chunks for better caching: vendor libs separate from app code
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-popover'
          ],
          'vendor-utils': ['axios', 'socket.io-client', 'date-fns'],
          'vendor-emoji': ['emoji-picker-react']
        }
      }
    },
    
    // Report compressed sizes
    reportCompressedSize: true,
    
    // Chunk size warning (in kB)
    chunkSizeWarningLimit: 600,
    
    // Source maps for production error tracking (with Sentry)
    sourcemap: true
  },
  
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'axios',
      'socket.io-client',
      'sonner',
      'date-fns'
    ]
  }
})