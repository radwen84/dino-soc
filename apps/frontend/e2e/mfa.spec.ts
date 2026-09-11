import { test, expect } from './fixtures';

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

    // Résolution de la strict mode violation : ciblage précis du label
    await expect(page.locator('label[for="mfaCode"]')).toBeVisible();

    // 3. Saisie du code TOTP à 6 chiffres
    await mfaInput.fill('123456');
    await page.click('button[type="submit"]');

    // 4. Validation de la redirection vers le Dashboard SOC
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/dashboard', { timeout: 10000 });
    await expect(page).not.toHaveURL('/login');
    await expect(page.locator('main')).toBeVisible();
  });

  test('Permet de retourner au formulaire de login depuis l écran MFA', async ({ page, mockSocApi }) => {
    await mockSocApi();
    await page.goto('/login');

    await page.fill('input#email', 'mfa@minisoc.local');
    await page.fill('input#password', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('input#mfaCode')).toBeVisible();
    await page.getByRole('button', { name: /Retour à la connexion|Annuler/i }).click();

    await expect(page.locator('input#email')).toBeVisible();
  });
});