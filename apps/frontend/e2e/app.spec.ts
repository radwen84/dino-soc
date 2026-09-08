import { test, expect } from '@playwright/test';

test.describe('Vérification de l\'application SOC', () => {
  test('La page d\'accueil Nginx / Frontend charge correctement', async ({ page }) => {

    // Connexion à la baseURL https://localhost
    const response = await page.goto('/');

    // Vérifie que le serveur web renvoie un code de succès
    expect(response?.status()).toBeLessThan(400);

    // Vérifie que le titre de la page est présent
    await expect(page).toHaveTitle(/./);
  });
});