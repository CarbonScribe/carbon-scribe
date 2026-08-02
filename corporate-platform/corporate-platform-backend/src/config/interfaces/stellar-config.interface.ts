export interface StellarConfig {
  network: string;
  horizonUrl: string | undefined;
  sorobanRpcUrl: string | undefined;
  simulateTimeout: number;
  sendTimeout: number;
  getTransactionTimeout: number;
  getEventsTimeout: number;
  getLatestLedgerTimeout: number;
}
