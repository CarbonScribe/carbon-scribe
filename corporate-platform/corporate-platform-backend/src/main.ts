import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { StartupValidator } from './config/validation/startup-validator';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { ExceptionMappingInterceptor } from './shared/interceptors/exception-mapping.interceptor';
import { LoggerService } from './logger/logger.service';

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

  const configService = app.get(ConfigService);
  const appConfig = configService.getAppConfig();
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  const logger = new Logger('Bootstrap');

  // ============================================================================
  // Run Startup Validation
  // ============================================================================
  const startupValidator = app.get(StartupValidator);
  try {
    const result = await startupValidator.validateStartup();
    if (!result.valid) {
      logger.error('❌ Startup validation failed. Check errors above.');
      process.exit(1);
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`❌ Startup validation error: ${err.message}`);
    process.exit(1);
  }

  // ============================================================================
  // Global Exception Handling
  // ============================================================================

  /**
   * Register global exception filter for centralized error handling
   * This filter catches all exceptions and transforms them into consistent error responses
   */
  const loggerService = app.get(LoggerService);
  app.useGlobalFilters(new HttpExceptionFilter(loggerService));

  /**
   * Register global interceptor for mapping exceptions
   * This interceptor translates Prisma errors and other exceptions before they reach the filter
   */
  app.useGlobalInterceptors(new ExceptionMappingInterceptor());

  // ============================================================================
  // Helmet HTTP Hardening Middleware
  // ============================================================================

  /**
   * Helmet middleware with comprehensive security headers.
   *
   * Each header is configured with production-safe values while maintaining
   * compatibility with Swagger UI and API functionality.
   *
   * Security Headers:
   * - Content-Security-Policy (CSP): Prevents XSS and data injection
   * - X-Frame-Options: Prevents clickjacking
   * - X-Content-Type-Options: Prevents MIME sniffing
   * - Strict-Transport-Security (HSTS): Enforces HTTPS
   * - Referrer-Policy: Controls referrer information
   * - Cross-Origin-Resource-Policy: Controls cross-origin resource sharing
   * - Cross-Origin-Opener-Policy: Controls window sharing
   * - Cross-Origin-Embedder-Policy: Controls cross-origin embedding
   * - X-DNS-Prefetch-Control: Controls DNS prefetching
   * - Permissions-Policy: Controls browser features (added manually)
   */
  app.use(
    helmet({
      /**
       * Content Security Policy
       * - Allows inline scripts for Swagger UI
       * - Allows loading from trusted CDN sources
       * - Allows images from any source
       * - Restricts object/embed sources
       */
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Swagger UI
            "'unsafe-eval'", // Required for Swagger UI
            'https://cdn.jsdelivr.net',
            'https://cdnjs.cloudflare.com',
            'https://unpkg.com',
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Swagger UI
            'https://cdn.jsdelivr.net',
            'https://cdnjs.cloudflare.com',
          ],
          imgSrc: ["'self'", 'data:', 'https:', 'http:'],
          fontSrc: [
            "'self'",
            'https://cdn.jsdelivr.net',
            'https://cdnjs.cloudflare.com',
            'https://fonts.gstatic.com',
          ],
          connectSrc: [
            "'self'",
            'https://api.pinata.cloud',
            'https://*.stellar.org',
            process.env.STELLAR_RPC_URL || '',
            process.env.STELLAR_HORIZON_URL || '',
          ].filter(Boolean),
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: [
            "'self'",
            'https://app.stellar.org',
            'https://stellar.expert',
          ],
          frameAncestors: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },

      /**
       * X-Frame-Options
       * Prevents clickjacking by disallowing embedding in frames
       */
      frameguard: {
        action: 'deny',
      },

      /**
       * X-Content-Type-Options
       * Prevents MIME type sniffing
       */
      noSniff: true,

      /**
       * Strict-Transport-Security (HSTS)
       * Enforces HTTPS for 1 year (31536000 seconds)
       * Includes subdomains and preload
       */
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },

      /**
       * Referrer-Policy
       * Controls how much referrer information is sent
       */
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },

      /**
       * Cross-Origin-Resource-Policy
       * Prevents cross-origin resource sharing
       * Set to 'same-origin' for API endpoints, 'cross-origin' for public resources
       */
      crossOriginResourcePolicy: {
        policy: 'same-origin',
      },

      /**
       * Cross-Origin-Opener-Policy
       * Controls cross-origin window sharing
       * Set to 'same-origin' for security
       */
      crossOriginOpenerPolicy: {
        policy: 'same-origin',
      },

      /**
       * Cross-Origin-Embedder-Policy
       * Controls cross-origin embedding
       * Set to 'require-corp' for strict protection
       */
      crossOriginEmbedderPolicy: false, // Disabled to allow cross-origin resources

      /**
       * X-DNS-Prefetch-Control
       * Controls DNS prefetching
       */
      dnsPrefetchControl: {
        allow: false,
      },

      /**
       * Remove X-Powered-By header
       * Prevents information leakage about the technology stack
       */
      hidePoweredBy: true,

      /**
       * X-XSS-Protection
       * Legacy XSS protection (now handled by CSP)
       * Set to '0' to avoid potential issues, CSP handles XSS
       */
      xssFilter: true,

      /**
       * IE X-Download-Options
       * Prevents IE from executing downloads in the context of the site
       */
      ieNoOpen: true,

      /**
       * Origin-Agent-Cluster
       * Prevents site from being used as an origin agent cluster
       */
      originAgentCluster: true,
    }),
  );

  // ============================================================================
  // Manual Permissions-Policy Header (not supported in helmet v8)
  // ============================================================================

  /**
   * Permissions-Policy (formerly Feature-Policy)
   * Controls which browser features are allowed
   * Set manually since helmet's permissionsPolicy option has type issues
   */
  app.use((req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(self), ' +
        'microphone=(), ' +
        'camera=(), ' +
        'payment=(self), ' +
        'usb=(), ' +
        'vr=(), ' +
        'xr=(), ' +
        'accelerometer=(), ' +
        'gyroscope=(), ' +
        'magnetometer=(), ' +
        'speaker=(), ' +
        'document-domain=(), ' +
        'fullscreen=(self), ' +
        'picture-in-picture=(self), ' +
        'autoplay=(self), ' +
        'clipboard-write=(self), ' +
        'clipboard-read=(self), ' +
        'encrypted-media=(self), ' +
        'gamepad=(), ' +
        'hid=(), ' +
        'idle-detection=(), ' +
        'keyboard-map=(), ' +
        'navigation-override=(), ' +
        'serial=(), ' +
        'sync-xhr=(), ' +
        'wake-lock=(self)',
    );
    next();
  });

  // ============================================================================
  // CORS Configuration
  // ============================================================================

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
      'Origin',
      'Referer',
      'User-Agent',
    ],
    exposedHeaders: [
      'Content-Length',
      'Content-Type',
      'X-Total-Count',
      'X-Pagination-Page',
      'X-Pagination-Limit',
      'X-Pagination-Total',
    ],
    optionsSuccessStatus: 204,
  });

  // ============================================================================
  // Swagger Documentation
  // ============================================================================

  const config = new DocumentBuilder()
    .setTitle('CarbonScribe Corporate Platform API')
    .setDescription(
      'API documentation for the CarbonScribe Corporate Platform, including retirement verification, compliance, GHG Protocol, CSRD, and CORSIA endpoints.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Api-Key',
        in: 'header',
        description: 'API Key for programmatic access',
      },
      'api-key',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'CarbonScribe Corporate Platform API',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { font-size: 2rem; }
      .swagger-ui .info .title small { font-size: 0.8rem; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  });

  // ============================================================================
  // Additional Security Headers (Manual)
  // ============================================================================

  // Add additional security headers not covered by Helmet
  app.use((req, res, next) => {
    // Server-Timing header for performance monitoring
    if (isDevelopment) {
      res.setHeader('Server-Timing', 'app;dur=0');
    }

    // NEL (Network Error Logging) header for monitoring
    if (isProduction) {
      res.setHeader(
        'NEL',
        JSON.stringify({
          report_to: 'default',
          max_age: 86400,
          include_subdomains: true,
        }),
      );
    }

    // Reporting-Endpoints header for CSP violation reporting
    if (isProduction) {
      res.setHeader(
        'Reporting-Endpoints',
        JSON.stringify({
          default: '/api/v1/security/reports',
          csp: '/api/v1/security/csp-reports',
        }),
      );
    }

    // Cache-Control for API responses
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
  });

  // ============================================================================
  // Start Server
  // ============================================================================

  logger.log(
    `🚀 Starting server in ${isProduction ? 'production' : 'development'} mode`,
  );
  logger.log(`📡 Listening on port ${appConfig.port}`);
  logger.log(
    `📚 Swagger UI available at http://localhost:${appConfig.port}/api/docs`,
  );

  const server = await app.listen(appConfig.port);

  // ============================================================================
  // Graceful Shutdown
  // ============================================================================

  const shutdownGracePeriod = parseInt(
    process.env.SHUTDOWN_GRACE_PERIOD || '30000',
    10,
  );

  /**
   * Gracefully shutdown the application on SIGTERM
   * - Stops accepting new connections
   * - Waits for in-flight requests to complete
   * - Closes all connections and exits
   */
  process.on('SIGTERM', async () => {
    logger.log(
      `Received SIGTERM, waiting ${shutdownGracePeriod}ms for in-flight requests...`,
    );

    // Close the HTTP server first to stop accepting new connections
    server.close(() => {
      logger.log('HTTP server closed');
    });

    // Wait for grace period
    await new Promise((resolve) => setTimeout(resolve, shutdownGracePeriod));

    // Close the application
    await app.close();
    logger.log('Application shutdown complete');
    process.exit(0);
  });

  /**
   * Gracefully shutdown the application on SIGINT (Ctrl+C)
   */
  process.on('SIGINT', async () => {
    logger.log(
      `Received SIGINT, waiting ${shutdownGracePeriod}ms for in-flight requests...`,
    );

    server.close(() => {
      logger.log('HTTP server closed');
    });

    await new Promise((resolve) => setTimeout(resolve, shutdownGracePeriod));
    await app.close();
    logger.log('Application shutdown complete');
    process.exit(0);
  });

  /**
   * Handle uncaught exceptions during shutdown
   */
  process.on('uncaughtException', (error) => {
    logger.error(
      `Uncaught exception during shutdown: ${error.message}`,
      error.stack,
    );
    process.exit(1);
  });

  /**
   * Handle unhandled promise rejections during shutdown
   */
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection during shutdown: ${reason}`);
    process.exit(1);
  });
}

bootstrap();
