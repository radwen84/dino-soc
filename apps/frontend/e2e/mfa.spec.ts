import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';

test.describe('Validation du flux MFA (Multi-Factor Authentication) - Intégration Réelle', () => {
  const MFA_SECRET = process.env.TEST_USER_MFA_SECRET || 'JBSWY3DPEHPK3PXP';

  test('un analyste doit pouvoir se connecter avec un code TOTP valide', async ({ page }) => {
    await page.goto('/login');

    // 1. ÉTAPE 1
    await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
    await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
    await page.click('button[type="submit"]');

    // 2. ÉTAPE 2 : MFA
    const mfaInput = page.locator('input#mfaCode, input[name="mfaCode"]');
    await expect(mfaInput).toBeVisible({ timeout: 5000 });
    await expect(page.locator('label[for="mfaCode"]')).toBeVisible();

    authenticator.options = { window: 1 };
    const currentToken = authenticator.generate(MFA_SECRET);

    await mfaInput.fill(currentToken);
    await page.click('button[type="submit"]');

    // 3. Validation de redirection SPA (waitUntil: 'commit')
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/dashboard', { 
      timeout: 10000,
      waitUntil: 'commit',
    });

    await expect(page).not.toHaveURL(/\/login\/?$/);
  });

  test('doit refuser la connexion avec un code TOTP invalide', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
    await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
    await page.click('button[type="submit"]');

    const mfaInput = page.locator('input#mfaCode, input[name="mfaCode"]');
    await expect(mfaInput).toBeVisible({ timeout: 5000 });

    await mfaInput.fill('000000');
    await page.click('button[type="submit"]');

    // Correctif du sélecteur
    const toastError = page.locator('.toast, [role="status"], .hot-toast-message')
      .or(page.getByText(/invalid|erreur/i));

    await expect(toastError.first()).toBeVisible({ timeout: 5000 });
  });

  test('permet de renoncer à l étape MFA et de revenir aux identifiants', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
    await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
    await page.click('button[type="submit"]');

    await expect(page.locator('input#mfaCode, input[name="mfaCode"]')).toBeVisible();

    await page.getByRole('button', { name: /Retour|Annuler/i }).click();

    await expect(page.locator('input#email, input[name="email"]')).toBeVisible();
  });
});