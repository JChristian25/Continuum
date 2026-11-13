import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  // Prebundle lazy-screen primitives together so they share the renderer's React.
  optimizeDeps: {
    include: [
      'react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime',
      '@base-ui/react/button', '@base-ui/react/checkbox', '@base-ui/react/dialog',
      '@base-ui/react/menu', '@base-ui/react/select',
      '@radix-ui/react-slot', '@radix-ui/react-tabs', '@radix-ui/react-tooltip',
      'cmdk', 'sonner',
    ],
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: process.env.CONTINUUM_API_TARGET || 'http://127.0.0.1:8787' } },
  },
})
