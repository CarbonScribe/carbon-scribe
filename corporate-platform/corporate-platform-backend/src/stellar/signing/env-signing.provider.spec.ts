import { EnvSigningProvider } from './env-signing.provider';
import { KmsSigningProvider } from './kms-signing.provider';

describe('EnvSigningProvider (#542)', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('defaults to simulate mode when STELLAR_SIGNING_MODE is unset', () => {
    delete process.env.STELLAR_SIGNING_MODE;
    delete process.env.STELLAR_SECRET_KEY;
    const p = new EnvSigningProvider('contract');
    expect(p.isLive()).toBe(false);
    expect(() => p.onModuleInit()).not.toThrow();
  });

  it('fails fast in live mode without a secret', () => {
    process.env.STELLAR_SIGNING_MODE = 'live';
    delete process.env.STELLAR_SECRET_KEY;
    const p = new EnvSigningProvider('contract');
    expect(() => p.onModuleInit()).toThrow(/no secret configured/i);
  });

  it('fails fast in live mode with malformed secret', () => {
    process.env.STELLAR_SIGNING_MODE = 'live';
    process.env.STELLAR_SECRET_KEY = 'not-a-stellar-secret';
    const p = new EnvSigningProvider('contract');
    expect(() => p.onModuleInit()).toThrow(/Invalid Stellar signing secret/i);
  });

  it('signTransaction rejects in simulate mode', async () => {
    process.env.STELLAR_SIGNING_MODE = 'simulate';
    const p = new EnvSigningProvider('transfer');
    await expect(p.signTransaction('AAAA', 'Test SDF Network ; September 2015')).rejects.toThrow(
      /simulate mode/i,
    );
  });

  it('KmsSigningProvider fails closed when selected without public key', () => {
    process.env.STELLAR_SIGNING_PROVIDER = 'kms';
    delete process.env.STELLAR_KMS_PUBLIC_KEY;
    const p = new KmsSigningProvider('contract');
    expect(() => p.onModuleInit()).toThrow(/STELLAR_KMS_PUBLIC_KEY/);
  });
});
