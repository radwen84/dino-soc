# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mfa.spec.ts >> Validation du flux MFA (Multi-Factor Authentication) - Intégration Réelle >> un analyste doit pouvoir se connecter avec un code TOTP valide
- Location: apps\frontend\e2e\mfa.spec.ts:7:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at https://localhost/login
Call log:
  - navigating to "https://localhost/login", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { authenticator } from 'otplib';
  3  | 
  4  | test.describe('Validation du flux MFA (Multi-Factor Authentication) - Intégration Réelle', () => {
  5  |   const MFA_SECRET = process.env.TEST_USER_MFA_SECRET || 'JBSWY3DPEHPK3PXP';
  6  | 
  7  |   test('un analyste doit pouvoir se connecter avec un code TOTP valide', async ({ page }) => {
> 8  |     await page.goto('/login');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at https://localhost/login
  9  | 
  10 |     // 1. ÉTAPE 1
  11 |     await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
  12 |     await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
  13 |     await page.click('button[type="submit"]');
  14 | 
  15 |     // 2. ÉTAPE 2 : MFA
  16 |     const mfaInput = page.locator('input#mfaCode, input[name="mfaCode"]');
  17 |     await expect(mfaInput).toBeVisible({ timeout: 5000 });
  18 |     await expect(page.locator('label[for="mfaCode"]')).toBeVisible();
  19 | 
  20 |     authenticator.options = { window: 1 };
  21 |     const currentToken = authenticator.generate(MFA_SECRET);
  22 | 
  23 |     await mfaInput.fill(currentToken);
  24 |     await page.click('button[type="submit"]');
  25 | 
  26 |     await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
  27 |   });
  28 | 
  29 |   test('doit refuser la connexion avec un code TOTP invalide', async ({ page }) => {
  30 |     await page.goto('/login');
  31 | 
  32 |     await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
  33 |     await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
  34 |     await page.click('button[type="submit"]');
  35 | 
  36 |     const mfaInput = page.locator('input#mfaCode, input[name="mfaCode"]');
  37 |     await expect(mfaInput).toBeVisible({ timeout: 5000 });
  38 | 
  39 |     await mfaInput.fill('000000');
  40 |     await page.click('button[type="submit"]');
  41 | 
  42 |     // Correctif du sélecteur
  43 |     const toastError = page.locator('.toast, [role="status"], .hot-toast-message')
  44 |       .or(page.getByText(/invalid|erreur/i));
  45 | 
  46 |     await expect(toastError.first()).toBeVisible({ timeout: 5000 });
  47 |   });
  48 | 
  49 |   test('permet de renoncer à l étape MFA et de revenir aux identifiants', async ({ page }) => {
  50 |     await page.goto('/login');
  51 | 
  52 |     await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
  53 |     await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
  54 |     await page.click('button[type="submit"]');
  55 | 
  56 |     await expect(page.locator('input#mfaCode, input[name="mfaCode"]')).toBeVisible();
  57 | 
  58 |     await page.getByRole('button', { name: /Retour|Annuler/i }).click();
  59 | 
  60 |     await expect(page.locator('input#email, input[name="email"]')).toBeVisible();
  61 |   });
  62 | });
  63 | 
```