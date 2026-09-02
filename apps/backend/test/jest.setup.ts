import { config } from 'dotenv';

// Charge les variables d'environnement de test
config({ path: '.env.test' });

// Augmente le timeout global de Jest (10 secondes)
jest.setTimeout(10000);

afterAll(async () => {
  // S'assure que les timers réels de Node.js sont utilisés pour éviter tout blocage avec jest.useFakeTimers()
  jest.useRealTimers();

  // Permet de libérer proprement l'event loop sans maintenir de handle actif
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 100);
    if (timer.unref) {
      timer.unref(); // Indique à Node.js de ne pas attendre ce timer pour fermer le processus
    }
  });
});