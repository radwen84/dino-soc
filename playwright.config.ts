import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Option A : Pointer directement vers un dossier dédié aux tests End-to-End
  testDir: './e2e',

  // Option B : Ou filtrer uniquement les fichiers se terminant par .e2e.spec.ts
  testMatch: '**/*.e2e.spec.ts',

  // Exclure explicitement les dossiers unitaires/intégration
  testIgnore: [
    '**/apps/**',
    '**/services/**',
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});