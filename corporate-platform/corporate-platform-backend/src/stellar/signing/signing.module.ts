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
    EnvSigningProvider,
    KmsSigningProvider,
  ],
  exports: [
    SIGNING_PROVIDER_CONTRACT,
    SIGNING_PROVIDER_TRANSFER,
    EnvSigningProvider,
    KmsSigningProvider,
  ],
})
export class SigningModule {}
