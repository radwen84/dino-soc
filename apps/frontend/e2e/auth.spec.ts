import { test, expect } from '@playwright/test';

test.describe('Authentification Frontend', () => {
  test('Affiche la page de connexion', async ({ page }) => {
    // Navigue vers la page de login
    await page.goto('/login');

    // Vérifie qu'un élément clé de l'interface est présent (ex: le bouton ou le titre)
    await expect(page.locator('h1, h2, form')).toBeVisible();
  });

  test('Permet à l\'utilisateur de se connecter', async ({ page }) => {
    await page.goto('/login');

    // Remplissage du formulaire
    await page.fill('input[type="email"]', 'admin@minisoc.local');
    await page.fill('input[type="password"]', 'Admin@MiniSOC2026!');
    await page.click('button[type="submit"]');

    // Vérification de la redirection vers le dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });
});