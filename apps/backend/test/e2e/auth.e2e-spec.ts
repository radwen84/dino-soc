import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { RedisService } from '../../src/redis/redis.service'; // Ajustez ce chemin si besoin

jest.setTimeout(30000);

describe('Auth (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Objet fictif (mock) simulant les méthodes Redis
    const mockRedisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
    };

    const moduleFixtureBuilder = Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot({ global: true }),
        AppModule,
      ],
    });

    // Remplace le vrai RedisService par le mock pour éviter les tentatives de connexion TCP
    const moduleFixture: TestingModule = await moduleFixtureBuilder
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Login Flow', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@minisoc.local', password: 'Admin@MiniSOC2026!' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe('admin@minisoc.local');
      expect(res.body.user.roles).toContain('admin');
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@minisoc.local', password: 'wrong' })
        .expect(401);
    });

    it('should reject empty body', async () => {
      await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(400);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@minisoc.local', password: 'Admin@MiniSOC2026!' });

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.accessToken).not.toBe(loginRes.body.accessToken);
    });
  });

  describe('Protected routes', () => {
    it('should access protected route with valid token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@minisoc.local', password: 'Admin@MiniSOC2026!' });

      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);
    });

    it('should reject expired/invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});