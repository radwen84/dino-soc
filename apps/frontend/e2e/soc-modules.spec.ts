// 1. Importation DEPUIS './fixtures' pour hériter des types et de mockSocApi
import { test, expect } from './fixtures';

test.describe('Couverture globale des modules Mini-SOC', () => {
  test.beforeEach(async ({ page, mockSocApi }) => {
    // Initialisation des routes de mock
    await mockSocApi();

    // Authentification fluide via la page de login pour initialiser l'état React / Zustand
    await page.goto('/login');
    await page.fill('input#email', 'admin@minisoc.local');
    await page.fill('input#password', 'Password123!');
    await page.click('button[type="submit"]');

    // Attente que le routeur confirme la connexion avant de lancer le test
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 });
  });

  test('Module Alertes - Filtrage et Drawer d inspection', async ({ page }) => {
    await page.goto('/alerts');
    await expect(page).toHaveURL('/alerts');

    // Ciblage du titre de section sans conflit avec le logo "Mini-SOC"
    await expect(page.locator('main h1, main h2, h2').first()).toContainText(/Alertes/i);

    // Vérification de la présence de l'alerte
    await expect(page.getByText('Détection SSH Bruteforce')).toBeVisible();
    await page.getByText('Détection SSH Bruteforce').click();

    // Vérification du Drawer
    await expect(page.getByText(/Payload Brut/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Acquitter/i })).toBeEnabled();
  });

  test('Module Incidents - Création d un nouvel incident', async ({ page }) => {
    await page.goto('/incidents');
    await expect(page).toHaveURL('/incidents');

    // Mock spécifique à la création d'incident POST
    await page.route('**/api/incidents', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, body: JSON.stringify({ id: 'inc-99' }) });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('button', { name: /Créer|Nouveau/i }).click();

    await page.locator('input[placeholder*="Malware"], input[name="title"]').fill('Intrusion Système Critique');
    await page.locator('textarea').fill('Analyse nécessaire sur le serveur srv-web-01');

    const selectSeverity = page.locator('select');
    if (await selectSeverity.isVisible()) {
      await selectSeverity.selectOption('critical');
    }

    await page.getByRole('button', { name: /Enregistrer|Créer|Sauvegarder/i }).click();
    await expect(page.locator('.toast, [role="status"], text=created')).toBeVisible({ timeout: 5000 });
  });

  test('Module Threat Intelligence - Recherche de réputation d une IP', async ({ page }) => {
    await page.goto('/threat-intel');
    await expect(page).toHaveURL('/threat-intel');

    const searchInput = page.locator('input[placeholder*="IP"], input[type="text"]').first();
    await searchInput.fill('185.220.101.5');

    await page.getByRole('button', { name: /Analyser|Rechercher|Search/i }).click();

    await expect(page.getByText(/critical/i)).toBeVisible();
    await expect(page.getByText(/98%/)).toBeVisible();
  });

  test('Module Assets - Ajout d un nouvel asset', async ({ page }) => {
    await page.goto('/assets');
    await expect(page).toHaveURL('/assets');

    await page.route('**/api/assets', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, body: JSON.stringify({ id: 'ast-1' }) });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('button', { name: /Ajouter un asset|Ajouter/i }).first().click();

    await page.locator('input[placeholder*="srv-web-01"], input[name="name"]').fill('srv-db-prod');
    await page.locator('input[placeholder*="192.168"], input[name="ip"]').fill('10.0.0.15');

    await page.getByRole('button', { name: /^Ajouter$|^Enregistrer$/i }).click();
    await expect(page.locator('.toast, [role="status"]')).toBeVisible();
  });

  test('Module Rapports - Génération et export JSON', async ({ page }) => {
    await page.goto('/reports');
    await expect(page).toHaveURL('/reports');

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

    const generateBtn = page.getByRole('button', { name: /Générer/i }).first();
    await generateBtn.click();

    await expect(page.getByRole('button', { name: /Exporter JSON|Télécharger/i })).toBeVisible();
  });

  test('Module Paramètres - Ouverture du Modal MFA TOTP', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    await page.getByRole('button', { name: /Configurer le MFA|Activer MFA|TOTP/i }).click();

    await expect(page.getByText(/QR CODE|Scannez/i)).toBeVisible();
    await page.getByRole('button', { name: /Valider|Activer/i }).click();

    await expect(page.locator('.toast, [role="status"], text=activé')).toBeVisible();
  });
});