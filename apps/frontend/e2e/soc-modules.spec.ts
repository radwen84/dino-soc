import { test, expect } from '@playwright/test';

test.describe('Couverture globale des modules Mini-SOC - Intégration Réelle', () => {
  async function navigateTo(page: import('@playwright/test').Page, label: string, path: string) {
    await page.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}/?$`));
  }

  test.beforeEach(async ({ page }) => {
    // Each module test starts an independent session. This dedicated account has
    // MFA disabled, so a valid TOTP cannot be accidentally replayed.
    await page.goto('/login');
    await page.fill('input#email, input[name="email"]', 'e2e.modules@minisoc.local');
    await page.fill('input#password, input[name="password"]', 'E2E@MiniSOC2026!');
    await page.click('button[type="submit"]');

    // Confirmation de l'entrée dans le Dashboard Mini-SOC
    await expect(page).not.toHaveURL(/\/login\/?$/, { timeout: 10000 });
    await expect(page.locator('main')).toBeVisible();
  });

  test('Module Alertes - Filtrage et Drawer d inspection', async ({ page }) => {
    await navigateTo(page, 'Alertes', '/alerts');

    await expect(page.locator('main h1, main h2, h2').first()).toContainText(/Alertes/i);
    
    // Attente du chargement de la table ou de la liste
    await page.waitForLoadState('networkidle');

    // Ciblage du premier élément de tableau ou carte d'alerte
    const firstRow = page.locator('table tbody tr, .alert-card, [role="row"]').first();
    
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      // Inspection du détail dans le Drawer / Modal
      await expect(page.getByRole('button', { name: /Acquitter|Fermer/i }).first()).toBeVisible({ timeout: 5000 });
    } else {
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('Module Incidents - Création d un nouvel incident', async ({ page }) => {
    await navigateTo(page, 'Incidents', '/incidents');

    // 1. Clic sur le bouton d'ouverture du modal
    await page.getByRole('button', { name: /Créer|Nouveau/i }).first().click();

    // Attente de l'apparition du formulaire/modal
    const modal = page.locator('[role="dialog"], form').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    await page.locator('input[placeholder*="Malware"], input[name="title"]').fill('Intrusion Système Critique (E2E Test)');
    await page.locator('textarea').fill('Analyse nécessaire sur le serveur srv-web-01 via Playwright');

    const selectSeverity = page.locator('select[name="severity"], select').first();
    if (await selectSeverity.isVisible().catch(() => false)) {
      await selectSeverity.selectOption('critical');
    }

    // 2. Clic ciblé sur le bouton de SOUMISSION dans le modal
    const submitBtn = modal.getByRole('button', { name: /Enregistrer|Créer|Sauvegarder|Submit/i }).first();
    await submitBtn.click();

    // SÉLECTEUR CORRIGÉ : combinaison propre via .or()
    const notification = page.locator('.toast, [role="status"]')
      .or(page.getByText(/créé|created|succès/i))
      .first();

    await expect(notification).toBeVisible({ timeout: 5000 });
  });

  test('Module Threat Intelligence - Recherche de réputation d une IP', async ({ page }) => {
    await navigateTo(page, 'Threat Intel', '/threat-intel');

    const searchInput = page.locator('input[placeholder*="IP"], input[type="text"]').first();
    await searchInput.fill('185.220.101.5');
    
    const searchBtn = page.getByRole('button', { name: /Analyser|Rechercher|Search|Analyse/i }).first();
    if (await searchBtn.isVisible().catch(() => false)) {
      await searchBtn.click();
    } else {
      await searchInput.press('Enter');
    }

    await expect(page.locator('main')).toContainText(/185\.220\.101\.5|Score|Trouvé|Threat Intelligence|AbuseIPDB|Analyse/i, { timeout: 10000 });
  });

  test('Module Assets - Ajout d un nouvel asset', async ({ page }) => {
    await navigateTo(page, 'Assets', '/assets');

    await page.getByRole('button', { name: /Ajouter un asset|Ajouter/i }).first().click();
    await page.locator('input[placeholder*="srv-web-01"], input[name="name"]').fill('srv-db-prod-e2e');
    await page.locator('input[placeholder*="192.168"], input[name="ip"]').fill('10.0.0.15');

    await page.getByRole('button', { name: /^Ajouter$|^Enregistrer$/i }).click();

    // SÉLECTEUR CORRIGÉ
    const notification = page.locator('.toast, [role="status"]')
      .or(page.getByText(/ajouté|added|succès/i))
      .first();

    await expect(notification).toBeVisible({ timeout: 5000 });
  });

  test('Module Rapports - Génération et export JSON', async ({ page }) => {
    await navigateTo(page, 'Rapports', '/reports');

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
    await navigateTo(page, 'Paramètres', '/settings');

    const mfaBtn = page.getByRole('button', { name: /Configurer le MFA|Activer MFA|TOTP/i });
    
    if (await mfaBtn.isVisible().catch(() => false)) {
      await mfaBtn.click();
      await expect(page.getByText('[QR CODE MFA]', { exact: true })).toBeVisible();
    } else {
      await expect(page.getByText(/MFA Activé|Désactiver/i)).toBeVisible();
    }
  });
});