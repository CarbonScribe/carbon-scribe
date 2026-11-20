/**
 * Shared Stellar Expert explorer-link resolution (#641).
 *
 * Four views each needed a link to a transaction's Stellar Expert page;
 * before this, three of them hardcoded the `public` (mainnet) network
 * segment while a fourth read NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL with a
 * testnet fallback — so a retirement completed against testnet rendered a
 * working link from one view and a broken one from the other three.
 *
 * This is the single place that reads the env var and applies the
 * fallback, matching env.ts's validated default, so every view stays in
 * sync with whatever network the app is actually configured against.
 */
const DEFAULT_STELLAR_EXPLORER_BASE_URL =
  'https://stellar.expert/explorer/testnet/tx'

/** Resolves the Stellar Expert transaction-explorer link for `transactionHash`. */
export function getStellarExplorerUrl(transactionHash: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL ??
    DEFAULT_STELLAR_EXPLORER_BASE_URL
  return `${baseUrl}/${transactionHash}`
}
