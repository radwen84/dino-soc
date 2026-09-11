import { test as base } from '@playwright/test';

// 1. Définition du type de la fixture custom
type SocFixtures = {
  mockSocApi: () => Promise<void>;
};

// 2. Extension du 'test' de base avec le type générique <SocFixtures>
export const test = base.extend<SocFixtures>({
  mockSocApi: async ({ page }, use) => {
    const setupMocks = async () => {
      // Mock de l'API Health
      await page.route('**/api/health', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'healthy',
            checks: { database: 'healthy', redis: 'healthy' },
          }),
        });
      });

      // Mock de la connexion MFA & Auth globale
      await page.route('**/api/auth/login', async (route) => {
        const json = route.request().postDataJSON();

        if (json?.email === 'mfa@minisoc.local' && !json?.mfaCode) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ requiresMfa: true, tempToken: 'temp-jwt-token-123' }),
          });
        } else if (json?.mfaCode === '123456' || (json?.email && json?.password)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              accessToken: 'fake-jwt-token',
              token: 'fake-jwt-token',
              user: { id: 'usr-1', name: 'SOC Analyst', role: 'admin', roles: ['admin'] },
            }),
          });
        } else {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Code invalide' }),
          });
        }
      });

      // Mock des Alertes
      await page.route('**/api/alerts*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'alt-1',
                level: 12,
                ruleDescription: 'Détection SSH Bruteforce',
                source: 'wazuh',
                srcIp: '192.168.1.100',
                status: 'new',
                timestamp: new Date().toISOString(),
              },
            ],
            meta: { total: 1, page: 1, limit: 25, totalPages: 1 },
          }),
        });
      });

      // Mock des Incidents
      await page.route('**/api/incidents*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'inc-1',
                title: 'Suspicion d exfiltration de données',
                severity: 'high',
                status: 'investigating',
                detectedAt: new Date().toISOString(),
              },
            ],
            meta: { total: 1, page: 1, limit: 20 },
          }),
        });
      });

      // Mock de Threat Intel
      await page.route('**/api/threat-intel/lookup/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            value: '185.220.101.5',
            riskLevel: 'critical',
            knownIoc: true,
            sources: ['AbuseIPDB', 'OTX'],
            abuseIpDb: { abuseConfidenceScore: 98, totalReports: 450 },
          }),
        });
      });
    };

    // Rend la fonction de setup disponible dans les tests
    await use(setupMocks);
  },
});

// Re-export de expect pour simplifier les imports dans les specs
export { expect } from '@playwright/test';