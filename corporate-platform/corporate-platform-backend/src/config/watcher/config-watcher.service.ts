import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { watch, FSWatcher, existsSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
import { ConfigService } from '../config.service';

@Injectable()
export class ConfigWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConfigWatcherService.name);
  private watcher?: FSWatcher;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const explicitPath = process.env.CONFIG_WATCH_FILE;
    const candidate = explicitPath || resolve(process.cwd(), '.env');
    if (!candidate || !existsSync(candidate)) {
      return;
    }
    this.watcher = watch(candidate, () => {
      dotenv.config({ path: candidate });
      this.configService.reload();
      this.logger.log('Configuration reloaded from file');
    });
  }

  onModuleDestroy() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
  }
}
