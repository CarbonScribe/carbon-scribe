import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

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
