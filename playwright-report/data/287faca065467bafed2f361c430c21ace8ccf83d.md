# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-stack.spec.ts >> full-stack smoke tests >> frontend renders the login screen
- Location: apps\frontend\e2e\full-stack.spec.ts:14:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at https://localhost/login
Call log:
  - navigating to "https://localhost/login", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test.describe('full-stack smoke tests', () => {
  4  |   test('backend health is available through the frontend proxy', async ({ request }) => {
  5  |     const response = await request.get('/api/health');
  6  |     expect(response.ok()).toBeTruthy();
  7  | 
  8  |     const body = await response.json();
  9  |     expect(body.status).toBe('healthy');
  10 |     expect(body.checks.database).toBe('healthy');
  11 |     expect(body.checks.redis).toBe('healthy');
  12 |   });
  13 | 
  14 |   test('frontend renders the login screen', async ({ page }) => {
> 15 |     await page.goto('/login');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at https://localhost/login
  16 |     await expect(page).toHaveTitle(/Mini-SOC/i);
  17 |     await expect(page.getByRole('heading', { name: 'Mini-SOC' })).toBeVisible();
  18 |     await expect(page.getByLabel('Adresse Email')).toBeVisible();
  19 |     await expect(page.getByLabel('Mot de passe')).toBeVisible();
  20 |     await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  21 |   });
  22 | 
  23 |   test('protected dashboard redirects unauthenticated users to login', async ({ page }) => {
  24 |     await page.goto('/');
  25 |     await expect(page).toHaveURL(/\/login$/);
  26 |   });
  27 | });
```