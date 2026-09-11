# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: soc-modules.spec.ts >> Couverture globale des modules Mini-SOC - Intégration Réelle >> Module Incidents - Création d un nouvel incident
- Location: apps/frontend/e2e/soc-modules.spec.ts:43:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
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
        - textbox "Code MFA (6 chiffres)" [active] [ref=e19]:
          - /placeholder: "000000"
      - button "Vérifier le code" [ref=e20] [cursor=pointer]
  - paragraph [ref=e21]: Mini-SOC Platform v1.0 — PFE 2026
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { authenticator } from 'otplib';
  3   | 
  4   | test.describe('Couverture globale des modules Mini-SOC - Intégration Réelle', () => {
  5   |   // Secret TOTP partagé avec le seed de la base de données
  6   |   const MFA_SECRET = process.env.TEST_USER_MFA_SECRET || 'JBSWY3DPEHPK3PXP';
  7   | 
  8   |   test.beforeEach(async ({ page }) => {
  9   |     // 1. Connexion initiale réelle sur la stack
  10  |     await page.goto('/login');
  11  |     await page.fill('input#email, input[name="email"]', 'admin@minisoc.local');
  12  |     await page.fill('input#password, input[name="password"]', 'Admin@MiniSOC2026!');
  13  |     await page.click('button[type="submit"]');
  14  | 
  15  |     // 2. Traitement dynamique du formulaire MFA si réclamé par le backend NestJS
  16  |     const mfaInput = page.locator('input#mfaCode, input[name="mfaCode"]');
  17  |     if (await mfaInput.isVisible({ timeout: 4000 }).catch(() => false)) {
  18  |       const currentToken = authenticator.generate(MFA_SECRET);
  19  |       await mfaInput.fill(currentToken);
  20  |       await page.click('button[type="submit"]');
  21  |     }
  22  | 
  23  |     // 3. Confirmation de l'entrée dans le Dashboard Mini-SOC
> 24  |     await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  25  |     await expect(page.locator('main')).toBeVisible();
  26  |   });
  27  | 
  28  |   test('Module Alertes - Filtrage et Drawer d inspection', async ({ page }) => {
  29  |     await page.goto('/alerts');
  30  |     await page.waitForURL(/\/alerts\/?$/);
  31  | 
  32  |     await expect(page.locator('main h1, main h2, h2').first()).toContainText(/Alertes/i);
  33  |     
  34  |     // Attente que le premier élément de la liste réelle soit affiché
  35  |     const firstRow = page.locator('table tbody tr, .alert-card').first();
  36  |     await expect(firstRow).toBeVisible();
  37  |     await firstRow.click();
  38  | 
  39  |     // Inspection du détail dans le Drawer / Modal
  40  |     await expect(page.getByRole('button', { name: /Acquitter|Fermer/i }).first()).toBeVisible();
  41  |   });
  42  | 
  43  |   test('Module Incidents - Création d un nouvel incident', async ({ page }) => {
  44  |     await page.goto('/incidents');
  45  |     await page.waitForURL(/\/incidents\/?$/);
  46  | 
  47  |     await page.getByRole('button', { name: /Créer|Nouveau/i }).click();
  48  |     await page.locator('input[placeholder*="Malware"], input[name="title"]').fill('Intrusion Système Critique (E2E Test)');
  49  |     await page.locator('textarea').fill('Analyse nécessaire sur le serveur srv-web-01 via Playwright');
  50  | 
  51  |     const selectSeverity = page.locator('select[name="severity"], select').first();
  52  |     if (await selectSeverity.isVisible()) {
  53  |       await selectSeverity.selectOption('critical');
  54  |     }
  55  | 
  56  |     await page.getByRole('button', { name: /Enregistrer|Créer|Sauvegarder/i }).click();
  57  |     await expect(page.locator('.toast, [role="status"], text=/créé|created|succès/i').first()).toBeVisible({ timeout: 5000 });
  58  |   });
  59  | 
  60  |   test('Module Threat Intelligence - Recherche de réputation d une IP', async ({ page }) => {
  61  |     await page.goto('/threat-intel');
  62  |     await page.waitForURL(/\/threat-intel\/?$/);
  63  | 
  64  |     const searchInput = page.locator('input[placeholder*="IP"], input[type="text"]').first();
  65  |     await searchInput.fill('185.220.101.5');
  66  |     await page.getByRole('button', { name: /Analyser|Rechercher|Search/i }).click();
  67  | 
  68  |     // Attente de l'affichage du score de réputation
  69  |     await expect(page.locator('main')).toContainText(/185.220.101.5|Score|Trouvé/i);
  70  |   });
  71  | 
  72  |   test('Module Assets - Ajout d un nouvel asset', async ({ page }) => {
  73  |     await page.goto('/assets');
  74  |     await page.waitForURL(/\/assets\/?$/);
  75  | 
  76  |     await page.getByRole('button', { name: /Ajouter un asset|Ajouter/i }).first().click();
  77  |     await page.locator('input[placeholder*="srv-web-01"], input[name="name"]').fill('srv-db-prod-e2e');
  78  |     await page.locator('input[placeholder*="192.168"], input[name="ip"]').fill('10.0.0.15');
  79  | 
  80  |     await page.getByRole('button', { name: /^Ajouter$|^Enregistrer$/i }).click();
  81  |     await expect(page.locator('.toast, [role="status"]').first()).toBeVisible({ timeout: 5000 });
  82  |   });
  83  | 
  84  |   test('Module Rapports - Génération et export JSON', async ({ page }) => {
  85  |     await page.goto('/reports');
  86  |     await page.waitForURL(/\/reports\/?$/);
  87  | 
  88  |     // Mock léger uniquement sur l'endpoint lourd de génération
  89  |     await page.route('**/api/reports/generate*', async (route) => {
  90  |       await route.fulfill({
  91  |         status: 200,
  92  |         contentType: 'application/json',
  93  |         body: JSON.stringify({
  94  |           metadata: { type: 'executive_summary' },
  95  |           data: { totalIncidents: 12, mttr: 1.5 },
  96  |         }),
  97  |       });
  98  |     });
  99  | 
  100 |     const generateBtn = page.getByRole('button', { name: /Générer/i }).first();
  101 |     await generateBtn.click();
  102 | 
  103 |     await expect(page.getByRole('button', { name: /Exporter JSON|Télécharger/i })).toBeVisible({ timeout: 5000 });
  104 |   });
  105 | 
  106 |   test('Module Paramètres - Ouverture du Modal MFA TOTP', async ({ page }) => {
  107 |     await page.goto('/settings');
  108 |     await page.waitForURL(/\/settings\/?$/);
  109 | 
  110 |     const mfaBtn = page.getByRole('button', { name: /Configurer le MFA|Activer MFA|TOTP/i });
  111 |     
  112 |     if (await mfaBtn.isVisible()) {
  113 |       await mfaBtn.click();
  114 |       await expect(page.getByText(/QR CODE|Scannez/i)).toBeVisible();
  115 |     } else {
  116 |       // Si le MFA est déjà actif pour cet utilisateur
  117 |       await expect(page.getByText(/MFA Activé|Désactiver/i)).toBeVisible();
  118 |     }
  119 |   });
  120 | });
```