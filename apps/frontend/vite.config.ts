import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.API_BASE_URL || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: process.env.API_BASE_URL || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: [...configDefaults.exclude, 'e2e/*'],
  },
});