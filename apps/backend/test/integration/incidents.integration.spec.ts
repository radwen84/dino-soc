import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Incidents (Integration)', () => {
  jest.setTimeout(30000);

  const testContext: {
    app?: INestApplication;
    prisma?: PrismaService;
    authToken?: string;
  } = {};

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    testContext.app = module.createNestApplication();
    
    // ✅ Configuration du préfixe global /api pour matcher les routes de production
    testContext.app.setGlobalPrefix('api');
    testContext.app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    
    await testContext.app.init();

    testContext.prisma = module.get<PrismaService>(PrismaService);

    const loginRes = await request(testContext.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@minisoc.local', password: 'Admin@MiniSOC2026!' });
    
    testContext.authToken = loginRes.body.accessToken;
  }, 30000);

  afterAll(async () => {
    if (testContext.prisma) {
      await testContext.prisma.$disconnect();
    }
    if (testContext.app) {
      await testContext.app.close();
    }
  });

  describe('POST /api/incidents', () => {
    it('should create an incident', async () => {
      const res = await request(testContext.app!.getHttpServer())
        .post('/api/incidents')
        .set('Authorization', `Bearer ${testContext.authToken}`)
        .send({
          title: 'Test Incident - Brute Force SSH',
          description: 'Multiple failed SSH login attempts detected',
          severity: 'high',
          category: 'brute_force',
          mitreTactics: ['TA0001'],
          mitreTechniques: ['T1110'],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Test Incident - Brute Force SSH');
      expect(res.body.status).toBe('new');
      expect(res.body.severity).toBe('high');
    });

    it('should reject invalid severity', async () => {
      await request(testContext.app!.getHttpServer())
        .post('/api/incidents')
        .set('Authorization', `Bearer ${testContext.authToken}`)
        .send({ title: 'Test', severity: 'invalid' })
        .expect(400);
    });

    it('should reject unauthenticated requests', async () => {
      // ✅ Correction : Ajout de .post('/api/incidents')
      await request(testContext.app!.getHttpServer())
        .post('/api/incidents')
        .send({ title: 'Test', severity: 'low' })
        .expect(401);
    });
  });

  describe('GET /api/incidents', () => {
    it('should return paginated incidents', async () => {
      const res = await request(testContext.app!.getHttpServer())
        .get('/api/incidents')
        .set('Authorization', `Bearer ${testContext.authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
    });

    it('should filter by severity', async () => {
      const res = await request(testContext.app!.getHttpServer())
        .get('/api/incidents')
        .set('Authorization', `Bearer ${testContext.authToken}`)
        .query({ severity: 'critical' })
        .expect(200);

      res.body.data.forEach((incident: any) => {
        expect(incident.severity).toBe('critical');
      });
    });
  });
});