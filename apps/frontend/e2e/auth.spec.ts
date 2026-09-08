import { test, expect } from '@playwright/test';

test.describe('Authentification Frontend', () => {
  test('Affiche la page de connexion', async ({ page }) => {
    await page.goto('/login');

    // Utilisation d'un sélecteur unique (getByRole ou first) pour éviter la violation du mode strict
    await expect(page.getByRole('heading', { name: 'Mini-SOC' })).toBeVisible();
    await expect(page.locator('form')).toBeVisible();
  });

  test('Permet à l\'utilisateur de se connecter', async ({ page }) => {
    await page.goto('/login');

    // Remplissage du formulaire
    await page.fill('input[type="email"]', 'admin@minisoc.local');
    await page.fill('input[type="password"]', 'Admin@MiniSOC2026!');
    await page.click('button[type="submit"]');

    // Attente et vérification de la redirection vers la racine ou le dashboard
    await expect(page).toHaveURL(/^https:\/\/localhost\/(dashboard)?$/);
  });
});