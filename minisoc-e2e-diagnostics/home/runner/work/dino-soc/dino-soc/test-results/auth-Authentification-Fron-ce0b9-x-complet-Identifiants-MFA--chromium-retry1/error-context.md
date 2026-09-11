# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentification Frontend - Intégration Réelle >> Permet à l'utilisateur de se connecter (Flux complet Identifiants + MFA)
- Location: apps/frontend/e2e/auth.spec.ts:16:7

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
          - text: "543697"
      - button "Vérifier le code" [ref=e20] [cursor=pointer]
  - paragraph [ref=e21]: Mini-SOC Platform v1.0 — PFE 2026
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
  17 |     await page.goto('/login');
  18 | 
  19 |     // 1. Étape 1 : Identifiants
  20 |     await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
  21 |     await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
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
  34 |     // 3. Attente SPA : On attend la transition d'URL sans bloquer sur l'événement 'load'
> 35 |     await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/dashboard', { 
     |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  36 |       timeout: 10000,
  37 |       waitUntil: 'commit',
  38 |     });
  39 | 
  40 |     await expect(page).not.toHaveURL(/\/login\/?$/);
  41 |   });
  42 | 
  43 |   test('Affiche un message d\'erreur avec des identifiants invalides', async ({ page }) => {
  44 |     await page.goto('/login');
  45 | 
  46 |     await page.fill('input#email, input[name="email"]', 'bad-user@minisoc.local');
  47 |     await page.fill('input#password, input[name="password"]', 'WrongPassword123!');
  48 |     await page.click('button[type="submit"]');
  49 | 
  50 |     // Correctif du sélecteur : Séparation propre des locuteurs
  51 |     const toastError = page.locator('.toast, [role="status"], .hot-toast-message')
  52 |       .or(page.getByText(/invalide|erreur|unauthorized/i));
  53 | 
  54 |     await expect(toastError.first()).toBeVisible({ timeout: 5000 });
  55 |     await expect(page).toHaveURL(/\/login\/?$/);
  56 |   });
  57 | });
```