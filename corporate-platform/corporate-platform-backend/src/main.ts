import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const appConfig = config.getAppConfig();
  await app.listen(appConfig.port);
}
bootstrap();
