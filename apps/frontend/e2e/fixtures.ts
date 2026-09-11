import { test as base, Page } from '@playwright/test';

export const test = base.extend({
  // Helper pour mocker l'API du SOC pendant les tests E2E
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

      // Mock de la connexion MFA
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
            body: JSON.stringify({ accessToken: 'fake-jwt-token', user: { name: 'SOC Analyst' } }),
          });
        } else {
          await route.fulfill({ status: 401, body: JSON.stringify({ message: 'Code invalide' }) });
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

    await use(setupMocks);
  },
});