import { expect, test } from '@playwright/test';

test.describe('full-stack smoke tests', () => {
  test('backend health is available through the frontend proxy', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.database).toBe('healthy');
    expect(body.checks.redis).toBe('healthy');
  });

  test('frontend renders the login screen', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Mini-SOC/i);
    await expect(page.getByRole('heading', { name: 'Mini-SOC' })).toBeVisible();
    await expect(page.getByLabel('Adresse Email')).toBeVisible();
    await expect(page.getByLabel('Mot de passe')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });

  test('protected dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});