import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('IPFS Upload Antivirus (e2e)', () => {
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

  it('should upload a clean file and persist it', async () => {
    const fileBuffer = Buffer.from('clean test file');
    const res = await request(app.getHttpServer())
      .post('/api/v1/ipfs/upload')
      .set('Authorization', `Bearer ${jwt}`)
      .field('idempotencyKey', 'antivirus-clean-1')
      .attach('file', fileBuffer, 'clean.txt');
    expect(res.status).toBe(201);
    expect(res.body.cid).toBeDefined();
    expect(res.body.record).toBeDefined();
    expect(res.body.error).toBeUndefined();
  });

  it('should reject an infected file', async () => {
    // EICAR test string is a standard harmless virus test pattern
    const eicar = Buffer.from(
      'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
    );
    const res = await request(app.getHttpServer())
      .post('/api/v1/ipfs/upload')
      .set('Authorization', `Bearer ${jwt}`)
      .field('idempotencyKey', 'antivirus-infected-1')
      .attach('file', eicar, 'eicar.txt');
    expect(res.status).toBe(201); // Controller returns error in body, not 400
    expect(res.body.error).toBe('File failed antivirus scan');
    expect(res.body.details).toBeDefined();
  });

  it('should handle scan errors gracefully', async () => {
    // Simulate scan error by uploading an empty file (should not error, but test for robustness)
    const res = await request(app.getHttpServer())
      .post('/api/v1/ipfs/upload')
      .set('Authorization', `Bearer ${jwt}`)
      .field('idempotencyKey', 'antivirus-error-1')
      .attach('file', Buffer.alloc(0), 'empty.txt');
    // Should not throw, but may return error if scan fails
    expect([undefined, 'Antivirus scan failed']).toContain(res.body.error);
  });
});
