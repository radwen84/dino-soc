import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/frontend/e2e',
  testMatch: '**/*.spec.ts',

  testIgnore: [
    '**/__tests__/**',
    '**/*.test.{ts,tsx}',
  ],

  use: {
    // Utilise la variable de la CI (https://localhost) ou http://localhost par défaut
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost',
    
    // INDISPENSABLE pour la CI avec Nginx / HTTPS (évite les erreurs de certificat SSL auto-signé)
    ignoreHTTPSErrors: true,
    
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});