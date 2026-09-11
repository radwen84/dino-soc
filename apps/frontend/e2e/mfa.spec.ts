import { test, expect } from './fixtures';
import { authenticator } from 'otplib';

test.describe('Validation du flux MFA (Multi-Factor Authentication)', () => {
  // Secret TOTP de test (récupéré des variables d'environnement Node.js ou valeur par défaut du seed)
  const MFA_SECRET = process.env.TEST_USER_MFA_SECRET || 'JBSWY3DPEHPK3PXP';

  test('un analyste doit pouvoir se connecter avec un code TOTP valide', async ({ page, mockSocApi }) => {
    // 0. Interception et mocking des endpoints API SOC
    await mockSocApi();

    // 1. Accès au formulaire de connexion
    await page.goto('/login');

    // 2. ÉTAPE 1 : Saisie des identifiants primaires
    await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
    await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
    await page.click('button[type="submit"]');

    // 3. Vérification du passage à l'étape 2 (Champ MFA)
    const mfaInput = page.locator('input#mfaCode, input[name="mfaCode"]');
    await expect(mfaInput).toBeVisible({ timeout: 5000 });
    
    // Isolation du label pour éviter toute violation de Strict Mode Playwright
    await expect(page.locator('label[for="mfaCode"]')).toBeVisible();

    // 4. ÉTAPE 2 : Génération et saisie du code TOTP dynamique (6 chiffres)
    const currentToken = authenticator.generate(MFA_SECRET);
    await mfaInput.fill(currentToken);
    await page.click('button[type="submit"]');

    // 5. Validation de la redirection vers le Dashboard du Mini-SOC
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/dashboard', { 
      timeout: 10000 
    });

    await expect(page).not.toHaveURL(/\/login\/?$/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('doit refuser la connexion avec un code TOTP invalide', async ({ page, mockSocApi }) => {
    await mockSocApi();
    await page.goto('/login');

    // Étape 1 : Identifiants
    await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
    await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
    await page.click('button[type="submit"]');

    const mfaInput = page.locator('input#mfaCode, input[name="mfaCode"]');
    await expect(mfaInput).toBeVisible({ timeout: 5000 });

    // Étape 2 : Saisie d'un mauvais code TOTP
    await mfaInput.fill('000000');
    await page.click('button[type="submit"]');

    // Notification ou alerte d'erreur
    await expect(
      page.locator('.toast, [role="status"], .hot-toast-message, text=/invalid|erreur/i').first()
    ).toBeVisible();
  });

  test('permet de renoncer à l étape MFA et de revenir aux identifiants', async ({ page, mockSocApi }) => {
    await mockSocApi();
    await page.goto('/login');

    // Étape 1 : Identifiants
    await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
    await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
    await page.click('button[type="submit"]');

    // Vérification présence du champ MFA
    await expect(page.locator('input#mfaCode, input[name="mfaCode"]')).toBeVisible();

    // Clic sur le bouton de retour
    await page.getByRole('button', { name: /Retour|Annuler/i }).click();

    // Retour à la saisie de l'email
    await expect(page.locator('input#email, input[name="email"]')).toBeVisible();
  });
});