# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mfa.spec.ts >> Validation du flux MFA (Multi-Factor Authentication) - Intégration Réelle >> un analyste doit pouvoir se connecter avec un code TOTP valide
- Location: apps/frontend/e2e/mfa.spec.ts:7:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "commit"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - heading "Mini-SOC" [level=1] [ref=e10]
    - paragraph [ref=e11]: Security Operations Center
  - generic [ref=e12]:
    - button "Retour à la connexion" [ref=e13] [cursor=pointer]
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: Code MFA (6 chiffres)
        - textbox "Code MFA (6 chiffres)" [ref=e19]:
          - /placeholder: "000000"
          - text: "809723"
      - button "Vérifier le code" [ref=e20] [cursor=pointer]
  - paragraph [ref=e21]: Mini-SOC Platform v1.0 — PFE 2026
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
  8  |     await page.goto('/login');
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
  26 |     // 3. Validation de redirection SPA (waitUntil: 'commit')
> 27 |     await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/dashboard', { 
     |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  28 |       timeout: 10000,
  29 |       waitUntil: 'commit',
  30 |     });
  31 | 
  32 |     await expect(page).not.toHaveURL(/\/login\/?$/);
  33 |   });
  34 | 
  35 |   test('doit refuser la connexion avec un code TOTP invalide', async ({ page }) => {
  36 |     await page.goto('/login');
  37 | 
  38 |     await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
  39 |     await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
  40 |     await page.click('button[type="submit"]');
  41 | 
  42 |     const mfaInput = page.locator('input#mfaCode, input[name="mfaCode"]');
  43 |     await expect(mfaInput).toBeVisible({ timeout: 5000 });
  44 | 
  45 |     await mfaInput.fill('000000');
  46 |     await page.click('button[type="submit"]');
  47 | 
  48 |     // Correctif du sélecteur
  49 |     const toastError = page.locator('.toast, [role="status"], .hot-toast-message')
  50 |       .or(page.getByText(/invalid|erreur/i));
  51 | 
  52 |     await expect(toastError.first()).toBeVisible({ timeout: 5000 });
  53 |   });
  54 | 
  55 |   test('permet de renoncer à l étape MFA et de revenir aux identifiants', async ({ page }) => {
  56 |     await page.goto('/login');
  57 | 
  58 |     await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
  59 |     await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
  60 |     await page.click('button[type="submit"]');
  61 | 
  62 |     await expect(page.locator('input#mfaCode, input[name="mfaCode"]')).toBeVisible();
  63 | 
  64 |     await page.getByRole('button', { name: /Retour|Annuler/i }).click();
  65 | 
  66 |     await expect(page.locator('input#email, input[name="email"]')).toBeVisible();
  67 |   });
  68 | });
```