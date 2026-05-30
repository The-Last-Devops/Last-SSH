/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(() => {
  const isWebBuild = process.env.BUILD_TARGET === 'web';
  return {
    // Electron cần relative path ('./'), web cần absolute ('/')
    base: isWebBuild ? '/' : './',
    plugins: [react(), tailwindcss()],
    server: {
      // Dev mode: proxy /ws → backend WebSocket server (port 3000)
      proxy: {
        '/ws': {
          target: 'ws://localhost:3000',
          ws: true,
          changeOrigin: true,
        }
      }
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: './src/setupTests.js',
      exclude: [...configDefaults.exclude, 'e2e/**/*'],
    },
  };
})
