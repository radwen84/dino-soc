# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentification Frontend - Intégration Réelle >> Permet à l'utilisateur de se connecter (Flux complet Identifiants + MFA)
- Location: apps\frontend\e2e\auth.spec.ts:16:7

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
  4  | test.describe('Authentification Frontend - Intégration Réelle', () => {
  5  |   const MFA_SECRET = process.env.TEST_USER_MFA_SECRET || 'JBSWY3DPEHPK3PXP';
  6  | 
  7  |   test('Affiche la page de connexion', async ({ page }) => {
  8  |     await page.goto('/login');
  9  | 
  10 |     await expect(page.getByRole('heading', { name: /Mini-SOC/i })).toBeVisible();
  11 |     await expect(page.locator('form')).toBeVisible();
  12 |     await expect(page.locator('input#email, input[name="email"]')).toBeVisible();
  13 |     await expect(page.locator('input#password, input[name="password"]')).toBeVisible();
  14 |   });
  15 | 
  16 |   test('Permet à l\'utilisateur de se connecter (Flux complet Identifiants + MFA)', async ({ page }) => {
> 17 |     await page.goto('/login');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at https://localhost/login
  18 | 
  19 |     // 1. Étape 1 : Identifiants
  20 |     await page.fill('input#email, input[name="email"]', 'analyst.l1@minisoc.local');
  21 |     await page.fill('input#password, input[name="password"]', 'Analyst1@SOC2026!');
  22 |     await page.click('button[type="submit"]');
  23 | 
  24 |     // 2. Étape 2 : Challenge MFA
  25 |     const mfaInput = page.locator('input#mfaCode, input[name="mfaCode"]');
  26 |     await expect(mfaInput).toBeVisible({ timeout: 5000 });
  27 | 
  28 |     authenticator.options = { window: 1 };
  29 |     const currentToken = authenticator.generate(MFA_SECRET);
  30 | 
  31 |     await mfaInput.fill(currentToken);
  32 |     await page.click('button[type="submit"]');
  33 | 
  34 |     await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
  35 |   });
  36 | 
  37 |   test('Affiche un message d\'erreur avec des identifiants invalides', async ({ page }) => {
  38 |     await page.goto('/login');
  39 | 
  40 |     await page.fill('input#email, input[name="email"]', 'bad-user@minisoc.local');
  41 |     await page.fill('input#password, input[name="password"]', 'WrongPassword123!');
  42 |     await page.click('button[type="submit"]');
  43 | 
  44 |     // Correctif du sélecteur : Séparation propre des locuteurs
  45 |     const toastError = page.locator('.toast, [role="status"], .hot-toast-message')
  46 |       .or(page.getByText(/invalide|erreur|unauthorized/i));
  47 | 
  48 |     await expect(toastError.first()).toBeVisible({ timeout: 5000 });
  49 |     await expect(page).toHaveURL(/\/login\/?$/);
  50 |   });
  51 | });
  52 | 
```