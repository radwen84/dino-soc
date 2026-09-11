import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Pointer vers le dossier e2e dans apps/frontend
  testDir: './apps/frontend/e2e', // Ajusté selon l'arborescence réelle de vos logs (apps/frontend/e2e)

  // Cibler les fichiers de test .spec.ts ou .e2e.ts
  testMatch: '**/*.{spec,e2e}.{ts,js}',

  // Exclure uniquement les tests unitaires
  testIgnore: [
    '**/__tests__/**',
    '**/*.test.{ts,tsx}',
  ],

  /* Temps d'attente maximum par test (30 secondes) */
  timeout: 30 * 1000,

  /* En cas d'échec sur CI, retenter le test une fois */
  retries: process.env.CI ? 2 : 0,

  /* Limitation du nombre de workers en CI pour éviter de surcharger l'environnement */
  workers: process.env.CI ? 1 : undefined,

  /* Rapporteurs d'exécution : Console + Rapport HTML + JSON pour archivage */
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],

  use: {
    /* URL de base pointant sur l'application frontend ou le proxy Nginx */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://localhost',

    /* Accepter les certificats auto-signés si HTTPS local est utilisé (ex: Nginx reverse proxy) */
    ignoreHTTPSErrors: true,

    /* Capture des artefacts pour le débogage (vidéos, captures, traces) */
    trace: 'on',             // 'on', 'retain-on-failure', ou 'off'
    video: 'on',             // Enregistre les vidéos de chaque test
    screenshot: 'on',        // Enregistre les captures d'écran
  },

  /* Dossier d'exportation des vidéos et fichiers de trace bruts */
  outputDir: 'test-results/',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});