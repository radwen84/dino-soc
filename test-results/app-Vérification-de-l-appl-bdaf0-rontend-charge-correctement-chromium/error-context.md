# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> Vérification de l'application SOC >> La page d'accueil Nginx / Frontend charge correctement
- Location: apps\frontend\e2e\app.spec.ts:4:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at https://localhost/
Call log:
  - navigating to "https://localhost/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Vérification de l\'application SOC', () => {
  4  |   test('La page d\'accueil Nginx / Frontend charge correctement', async ({ page }) => {
  5  | 
  6  |     // Connexion à la baseURL https://localhost
> 7  |     const response = await page.goto('/');
     |                                 ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at https://localhost/
  8  | 
  9  |     // Vérifie que le serveur web renvoie un code de succès
  10 |     expect(response?.status()).toBeLessThan(400);
  11 | 
  12 |     // Vérifie que le titre de la page est présent
  13 |     await expect(page).toHaveTitle(/./);
  14 |   });
  15 | });
```