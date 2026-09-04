import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Pointer directement vers le dossier e2e dans apps/frontend
  testDir: './apps/frontend/e2e',

  // Cibler les fichiers de test .spec.ts ou .e2e.ts
  testMatch: '**/*.{spec,e2e}.{ts,js}',

  // Exclure uniquement les tests unitaires (Vitest / React Testing Library)
  testIgnore: [
    '**/__tests__/**',
    '**/*.test.{ts,tsx}',
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});