import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
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
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: 'Bot de Irrigación',
        short_name: 'Irrigación',
        description: 'Sistema de gestión de irrigación con chat y controles en tiempo real',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Cache strategies
        runtimeCaching: [
          {
            // Cache API responses
            urlPattern: /^https:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache images
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Cache static assets
            urlPattern: /\.(?:js|css|woff|woff2|ttf|otf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
        // Clean old caches
        cleanupOutdatedCaches: true,
        // Skip waiting for new service worker
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false, // Disable in dev for faster HMR
      },
    })
  ],
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
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return undefined

          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'vendor-react'
          }

          if (
            id.includes('/@radix-ui/react-dialog/') ||
            id.includes('/@radix-ui/react-dropdown-menu/') ||
            id.includes('/@radix-ui/react-tabs/') ||
            id.includes('/@radix-ui/react-popover/')
          ) {
            return 'vendor-ui'
          }

          if (
            id.includes('/axios/') ||
            id.includes('/socket.io-client/') ||
            id.includes('/date-fns/')
          ) {
            return 'vendor-utils'
          }

          if (id.includes('/emoji-picker-react/')) {
            return 'vendor-emoji'
          }

          return undefined
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