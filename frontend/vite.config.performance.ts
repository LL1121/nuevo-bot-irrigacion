/**
 * Performance optimization config for Vite
 * Add this to vite.config.ts for production builds
 */

export const performanceConfig = {
  build: {
    // Target modern browsers only for smaller bundles
    target: 'es2020',
    
    // Enable minification and compression
    minify: 'terser',
    
    // Split chunks for better caching
    rollupOptions: {
      output: {
        // Chunk strategy: create vendor bundles and lazy-loaded chunks
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
    
    // Report compressed bundle sizes
    reportCompressedSize: true,
    
    // Chunk size warning threshold (in kB)
    chunkSizeWarningLimit: 600,
    
    // Source maps in production for error tracking
    sourcemap: true
  },
  
  // Optimize dependencies
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
};
