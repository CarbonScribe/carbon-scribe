import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TenantContext } from './interfaces/tenant-context.interface';

@Injectable()
export class TenantContextStore {
  private readonly storage = new AsyncLocalStorage<TenantContext | null>();

  runWithContext<T>(context: TenantContext | null, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  setContext(context: TenantContext | null): void {
    this.storage.enterWith(context);
  }

  getContext(): TenantContext | null {
    return this.storage.getStore() ?? null;
  }
}
