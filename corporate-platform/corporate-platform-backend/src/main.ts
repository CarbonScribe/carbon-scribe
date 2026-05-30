import { NestFactory } from '@nestjs/core';
import * as helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { getHelmetConfig } from './config/helmet.config';

function parseCorsOrigins(value?: string): string[] {
  const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000'];

  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : defaults;
}

function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Apply helmet middleware for comprehensive HTTP security hardening
  // Helmet must be applied before CORS to ensure security headers are set correctly
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(helmet(getHelmetConfig(isProduction)));

  const configuredOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (configuredOrigins.includes(origin) || isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Tenant-Id',
      'X-Api-Key',
      'x-api-key',
      'Accept',
    ],
    // Expose security headers to client
    exposedHeaders: [
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Strict-Transport-Security',
      'Referrer-Policy',
      'Cross-Origin-Resource-Policy',
      'Cross-Origin-Opener-Policy',
      'X-DNS-Prefetch-Control',
      'Expect-CT',
      'Permissions-Policy',
      'X-XSS-Protection',
    ],
    optionsSuccessStatus: 204,
  });

  const configService = app.get(ConfigService);
  const appConfig = configService.getAppConfig();

  const config = new DocumentBuilder()
    .setTitle('CarbonScribe Corporate Platform API')
    .setDescription(
      'API documentation for the CarbonScribe Corporate Platform, including retirement verification, compliance, GHG Protocol, CSRD, and CORSIA endpoints.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(appConfig.port);
}
bootstrap();
