import { expect } from '@playwright/test';
import { test } from './fixtures';

test.describe('Validation MFA (Multi-Factor Authentication)', () => {
  test('Doit demander et valider le code MFA lors de la connexion', async ({ page, mockSocApi }) => {
    await mockSocApi();
    await page.goto('/login');

    // 1. Saisie des identifiants (Étape 1)
    await page.fill('input#email', 'mfa@minisoc.local');
    await page.fill('input#password', 'Password123!');
    await page.click('button[type="submit"]');

    // 2. Vérification du basculement vers le champ MFA (Étape 2)
    const mfaInput = page.locator('input#mfaCode');
    await expect(mfaInput).toBeVisible();
    await expect(page.locator('text=Code MFA (6 chiffres)')).toBeVisible();

    // 3. Saisie du code TOTP à 6 chiffres
    await mfaInput.fill('123456');
    await page.click('button[type="submit"]');

    // 4. Validation de la redirection vers le Dashboard SOC
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('SOC Dashboard');
  });

  test('Permet de retourner au formulaire de login depuis l écran MFA', async ({ page, mockSocApi }) => {
    await mockSocApi();
    await page.goto('/login');

    await page.fill('input#email', 'mfa@minisoc.local');
    await page.fill('input#password', 'Password123!');
    await page.click('button[type="submit"]');

    // Clic sur "Retour à la connexion"
    await page.click('button:has-text("Retour à la connexion")');

    // Vérification du retour au champ email
    await expect(page.locator('input#email')).toBeVisible();
  });
});