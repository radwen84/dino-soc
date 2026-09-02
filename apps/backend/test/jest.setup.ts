import { config } from 'dotenv';

// Charge les variables d'environnement de test
config({ path: '.env.test' });

// Augmente le timeout global de Jest (30 secondes pour laisser le temps aux bases de données)
jest.setTimeout(30000);

// Reinitialise les mocks entre chaque test pour éviter la fuite d'état
afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  // 1. Réinitialise les timers si des fake timers ont été utilisés
  jest.useRealTimers();

  // 2. Vide la file de micro-tâches et libère proprement l'event loop
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
});