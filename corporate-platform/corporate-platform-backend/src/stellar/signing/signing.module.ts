import { Global, Module } from '@nestjs/common';
import {
  SIGNING_PROVIDER_CONTRACT,
  SIGNING_PROVIDER_TRANSFER,
} from './signing-provider.interface';
import {
  createContractSigningProvider,
  createTransferSigningProvider,
  EnvSigningProvider,
} from './env-signing.provider';
import { KmsSigningProvider } from './kms-signing.provider';

/**
 * EnvSigningProvider/KmsSigningProvider are intentionally NOT listed as bare
 * providers below: nothing in the codebase injects either class directly —
 * every consumer goes through the SIGNING_PROVIDER_CONTRACT/TRANSFER tokens
 * below. Registering the classes as additional, separate providers made Nest
 * try to DI-construct them itself (instead of via `new` in selectProvider()),
 * which fails because their constructors take plain `category`/`secretEnvKey`
 * parameters Nest has no injection token for ("Nest can't resolve
 * dependencies of the EnvSigningProvider (?, Object)..."). That broke any
 * e2e test that boots a module importing this one (including the
 * pre-existing, unrelated test/app.e2e-spec.ts).
 */

function selectProvider(
  category: 'contract' | 'transfer',
): EnvSigningProvider | KmsSigningProvider {
  const kind = (process.env.STELLAR_SIGNING_PROVIDER || 'env').toLowerCase();
  if (kind === 'kms' || kind === 'vault') {
    return new KmsSigningProvider(category);
  }
  return category === 'transfer'
    ? createTransferSigningProvider()
    : createContractSigningProvider();
}

@Global()
@Module({
  providers: [
    {
      provide: SIGNING_PROVIDER_CONTRACT,
      useFactory: () => selectProvider('contract'),
    },
    {
      provide: SIGNING_PROVIDER_TRANSFER,
      useFactory: () => selectProvider('transfer'),
    },
  ],
  exports: [SIGNING_PROVIDER_CONTRACT, SIGNING_PROVIDER_TRANSFER],
})
export class SigningModule {}
