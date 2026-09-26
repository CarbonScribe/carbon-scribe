# Stellar Signing Key Rotation (#542)

## Env-backed provider (`STELLAR_SIGNING_PROVIDER=env`, default)

1. Generate a new Stellar keypair offline.
2. Set `STELLAR_SECRET_KEY` (and optionally `STELLAR_TRANSFER_SECRET_KEY`) to the new secret in your secret store / deployment env.
3. Set `STELLAR_SIGNING_MODE=live`.
4. Rolling restart application instances. In-flight requests on old pods finish with the old key; new pods sign with the new key.
5. Confirm audit logs show the new `publicKey` on subsequent transactions.
6. Retire the old key from Horizon / custody once no in-flight work remains.

No code changes are required — configuration only.

## KMS / Vault provider (`STELLAR_SIGNING_PROVIDER=kms|vault`)

1. Create a new KMS key version or Vault transit key version.
2. Update `STELLAR_KMS_KEY_ID` / `STELLAR_VAULT_KEY_PATH` and `STELLAR_KMS_PUBLIC_KEY`.
3. Restart services. Signing uses the new key id immediately.
4. Disable the previous KMS key version after the drain window.

## Separate keys per operation

- Contract invocation uses `SIGNING_PROVIDER_CONTRACT` (`STELLAR_SECRET_KEY` or KMS).
- Transfers use `SIGNING_PROVIDER_TRANSFER` (`STELLAR_TRANSFER_SECRET_KEY` if set, else shared).
