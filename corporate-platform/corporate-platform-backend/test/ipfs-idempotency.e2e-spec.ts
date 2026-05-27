import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('IPFS Upload Idempotency (e2e)', () => {
  let app: INestApplication;
  let jwt: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    // TODO: Replace with actual JWT retrieval logic
    jwt = process.env.TEST_JWT || 'test.jwt.token';
  });

  it('should upload a file with idempotencyKey and not duplicate on retry', async () => {
    const idempotencyKey = 'test-key-123';
    const fileBuffer = Buffer.from('test file content');
    const upload = () =>
      request(app.getHttpServer())
        .post('/api/v1/ipfs/upload')
        .set('Authorization', `Bearer ${jwt}`)
        .field('idempotencyKey', idempotencyKey)
        .attach('file', fileBuffer, 'test.txt');

    // First upload
    const res1 = await upload();
    expect(res1.status).toBe(201);
    expect(res1.body.cid).toBeDefined();
    expect(res1.body.record).toBeDefined();
    expect(res1.body.record.idempotencyKey).toBe(idempotencyKey);
    expect(res1.body.idempotent).not.toBe(true);

    // Retry upload with same key
    const res2 = await upload();
    expect(res2.status).toBe(201);
    expect(res2.body.cid).toBe(res1.body.cid);
    expect(res2.body.record.id).toBe(res1.body.record.id);
    expect(res2.body.idempotent).toBe(true);
  });

  it('should error if idempotencyKey is missing', async () => {
    const fileBuffer = Buffer.from('test file content');
    const res = await request(app.getHttpServer())
      .post('/api/v1/ipfs/upload')
      .attach('file', fileBuffer, 'test.txt');
    expect(res.status).toBe(201); // Controller returns error in body, not 400
    expect(res.body.error).toBe('idempotencyKey is required');
  });
});
