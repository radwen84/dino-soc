import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';

test.describe('Couverture globale des modules Mini-SOC - Intégration Réelle', () => {
  // Secret TOTP partagé avec le seed de la base de données
  const MFA_SECRET = process.env.TEST_USER_MFA_SECRET || 'JBSWY3DPEHPK3PXP';

  test.beforeEach(async ({ page }) => {
    // 1. Connexion initiale réelle sur la stack
    await page.goto('/login');
    await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
    await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
    await page.click('button[type="submit"]');

    // 2. Traitement dynamique du formulaire MFA si réclamé par le backend NestJS
    const mfaInput = page.locator('input#mfaCode, input[name="mfaCode"]');
    if (await mfaInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      const currentToken = authenticator.generate(MFA_SECRET);
      await mfaInput.fill(currentToken);
      await page.click('button[type="submit"]');
    }

    // 3. Confirmation de l'entrée dans le Dashboard Mini-SOC
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 });
    await expect(page.locator('main')).toBeVisible();
  });

  test('Module Alertes - Filtrage et Drawer d inspection', async ({ page }) => {
    await page.goto('/alerts');
    await page.waitForURL(/\/alerts\/?$/);

    await expect(page.locator('main h1, main h2, h2').first()).toContainText(/Alertes/i);
    
    // Attente que le premier élément de la liste réelle soit affiché
    const firstRow = page.locator('table tbody tr, .alert-card').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // Inspection du détail dans le Drawer / Modal
    await expect(page.getByRole('button', { name: /Acquitter|Fermer/i }).first()).toBeVisible();
  });

  test('Module Incidents - Création d un nouvel incident', async ({ page }) => {
    await page.goto('/incidents');
    await page.waitForURL(/\/incidents\/?$/);

    await page.getByRole('button', { name: /Créer|Nouveau/i }).click();
    await page.locator('input[placeholder*="Malware"], input[name="title"]').fill('Intrusion Système Critique (E2E Test)');
    await page.locator('textarea').fill('Analyse nécessaire sur le serveur srv-web-01 via Playwright');

    const selectSeverity = page.locator('select[name="severity"], select').first();
    if (await selectSeverity.isVisible()) {
      await selectSeverity.selectOption('critical');
    }

    await page.getByRole('button', { name: /Enregistrer|Créer|Sauvegarder/i }).click();
    await expect(page.locator('.toast, [role="status"], text=/créé|created|succès/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('Module Threat Intelligence - Recherche de réputation d une IP', async ({ page }) => {
    await page.goto('/threat-intel');
    await page.waitForURL(/\/threat-intel\/?$/);

    const searchInput = page.locator('input[placeholder*="IP"], input[type="text"]').first();
    await searchInput.fill('185.220.101.5');
    await page.getByRole('button', { name: /Analyser|Rechercher|Search/i }).click();

    // Attente de l'affichage du score de réputation
    await expect(page.locator('main')).toContainText(/185.220.101.5|Score|Trouvé/i);
  });

  test('Module Assets - Ajout d un nouvel asset', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForURL(/\/assets\/?$/);

    await page.getByRole('button', { name: /Ajouter un asset|Ajouter/i }).first().click();
    await page.locator('input[placeholder*="srv-web-01"], input[name="name"]').fill('srv-db-prod-e2e');
    await page.locator('input[placeholder*="192.168"], input[name="ip"]').fill('10.0.0.15');

    await page.getByRole('button', { name: /^Ajouter$|^Enregistrer$/i }).click();
    await expect(page.locator('.toast, [role="status"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Module Rapports - Génération et export JSON', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForURL(/\/reports\/?$/);

    // Mock léger uniquement sur l'endpoint lourd de génération
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

    await expect(page.getByRole('button', { name: /Exporter JSON|Télécharger/i })).toBeVisible({ timeout: 5000 });
  });

  test('Module Paramètres - Ouverture du Modal MFA TOTP', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL(/\/settings\/?$/);

    const mfaBtn = page.getByRole('button', { name: /Configurer le MFA|Activer MFA|TOTP/i });
    
    if (await mfaBtn.isVisible()) {
      await mfaBtn.click();
      await expect(page.getByText(/QR CODE|Scannez/i)).toBeVisible();
    } else {
      // Si le MFA est déjà actif pour cet utilisateur
      await expect(page.getByText(/MFA Activé|Désactiver/i)).toBeVisible();
    }
  });
});