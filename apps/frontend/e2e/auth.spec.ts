import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';

test.describe('Authentification Frontend - Intégration Réelle', () => {
  const MFA_SECRET = process.env.TEST_USER_MFA_SECRET || 'JBSWY3DPEHPK3PXP';

  test('Affiche la page de connexion', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /Mini-SOC/i })).toBeVisible();
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input#email, input[name="email"]')).toBeVisible();
    await expect(page.locator('input#password, input[name="password"]')).toBeVisible();
  });

  test('Permet à l\'utilisateur de se connecter (Flux complet Identifiants + MFA)', async ({ page }) => {
    await page.goto('/login');

    // 1. Étape 1 : Remplissage des identifiants
    await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
    await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
    await page.click('button[type="submit"]');

    // 2. Étape 2 : Saisie MFA
    const mfaInput = page.locator('input#mfaCode, input[name="mfaCode"]');
    await expect(mfaInput).toBeVisible({ timeout: 5000 });

    // Autoriser une tolérance de pas de temps (+/- 30s) pour éviter les rejets en CI
    authenticator.options = { window: 1 };
    const currentToken = authenticator.generate(MFA_SECRET);

    await mfaInput.fill(currentToken);
    await page.click('button[type="submit"]');

    // 3. Attente basée sur les éléments du DOM de la SPA (Dashboard) plutôt qu'un reload navigateur
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
    await expect(page).not.toHaveURL(/\/login\/?$/);
  });

  test('Affiche un message d\'erreur avec des identifiants invalides', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#email, input[name="email"]', 'bad-user@minisoc.local');
    await page.fill('input#password, input[name="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    await expect(
      page.locator('.toast, [role="status"], .hot-toast-message, text=/invalide|erreur|unauthorized/i').first()
    ).toBeVisible({ timeout: 5000 });

    await expect(page).toHaveURL(/\/login\/?$/);
  });
});