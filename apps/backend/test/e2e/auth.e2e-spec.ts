import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Auth (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
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
      // Login first
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@minisoc.local', password: 'Admin@MiniSOC2026!' });

      // Refresh
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
