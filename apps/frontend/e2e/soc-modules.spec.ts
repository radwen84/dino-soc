import { expect } from '@playwright/test';
import { test } from './fixtures';

test.describe('Couverture globale des modules Mini-SOC', () => {
  test.beforeEach(async ({ page, mockSocApi }) => {
    await mockSocApi();
    // Injection d'un faux token JWT pour simuler une session active
    await page.addInitScript(() => {
      window.localStorage.setItem('auth-storage', JSON.stringify({
        state: { token: 'fake-jwt-token', user: { name: 'Analyste SOC', roles: ['admin'] } }
      }));
    });
  });

  test('Module Alertes - Filtrage et Drawer d inspection', async ({ page }) => {
    await page.goto('/alerts');
    await expect(page.locator('h1')).toContainText('Alertes');

    // Vérification du tableau et clic sur une alerte
    await expect(page.locator('text=Détection SSH Bruteforce')).toBeVisible();
    await page.click('text=Détection SSH Bruteforce');

    // Vérification de l'ouverture du Drawer latéral
    await expect(page.locator('text=Payload Brut (JSON)')).toBeVisible();
    await expect(page.locator('button:has-text("Acquitter")')).toBeEnabled();
  });

  test('Module Incidents - Création d un nouvel incident', async ({ page }) => {
    await page.goto('/incidents');
    await page.click('button:has-text("Créer un incident")');

    // Complétion du formulaire modal
    await page.fill('input[placeholder*="Malware"]', 'Intrusion Système Critique');
    await page.fill('textarea', 'Analyse nécessaire sur le serveur srv-web-01');
    await page.selectOption('select:has-text("Critical")', 'critical');

    // Mock de l'appel POST /incidents
    await page.route('**/api/incidents', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, body: JSON.stringify({ id: 'inc-99' }) });
      }
    });

    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator('.toast, text=Incident créé')).toBeVisible();
  });

  test('Module Threat Intelligence - Recherche de réputation d une IP', async ({ page }) => {
    await page.goto('/threat-intel');
    await page.fill('input[placeholder*="IP, domaine"]', '185.220.101.5');
    await page.click('button:has-text("Analyser")');

    // Validation des résultats enrichis
    await expect(page.locator('text=Risque: critical')).toBeVisible();
    await expect(page.locator('text=98%')).toBeVisible(); // Score AbuseIPDB
  });

  test('Module Assets - Ajout d un nouvel asset', async ({ page }) => {
    await page.goto('/assets');
    await page.click('button:has-text("Ajouter un asset")');

    await page.fill('input[placeholder="srv-web-01"]', 'srv-db-prod');
    await page.fill('input[placeholder="192.168.1.50"]', '10.0.0.15');

    await page.route('**/api/assets', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, body: JSON.stringify({ id: 'ast-1' }) });
      }
    });

    await page.click('button:has-text("Ajouter")');
    await expect(page.locator('.toast, text=Asset ajouté')).toBeVisible();
  });

  test('Module Rapports - Génération et export JSON', async ({ page }) => {
    await page.goto('/reports');

    await page.route('**/api/reports/generate*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metadata: { type: 'executive_summary' },
          data: { totalIncidents: 12, mttr: 1.5 },
        }),
      });
    });

    // Clic sur la carte Executive Summary
    await page.click('h3:has-text("Executive Summary") ~ button:has-text("Générer")');
    await expect(page.locator('text=Exporter JSON')).toBeVisible();
  });

  test('Module Paramètres - Ouverture du Modal MFA TOTP', async ({ page }) => {
    await page.goto('/settings');
    await page.click('button:has-text("Configurer le MFA (TOTP)")');

    // Vérification de la présence de la modal QR Code
    await expect(page.locator('text=[QR CODE MFA]')).toBeVisible();
    await page.click('button:has-text("Valider la configuration")');
    await expect(page.locator('.toast, text=MFA activé')).toBeVisible();
  });
});