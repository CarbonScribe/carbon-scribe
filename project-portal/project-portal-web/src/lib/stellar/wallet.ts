let freighterApi: any = null;

export type WalletConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "unavailable"
  | "error";

function isFreighterAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as any).Freighter !== "undefined";
}

async function loadFreighter(): Promise<any> {
  if (freighterApi) return freighterApi;
  if (!isFreighterAvailable()) return null;
  try {
    const mod = await import("@stellar/freighter-api");
    freighterApi = mod;
    return freighterApi;
  } catch {
    return null;
  }
}

export async function isWalletInstalled(): Promise<boolean> {
  const api = await loadFreighter();
  if (!api) return false;
  try {
    const result = await api.isConnected();
    return result.isConnected === true;
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<string> {
  const api = await loadFreighter();
  if (!api) {
    throw new Error(
      "No Stellar wallet extension detected. Please install Freighter to connect your wallet.",
    );
  }

  const connected = await api.isConnected();
  if (!connected.isConnected) {
    throw new Error(
      "No Stellar wallet extension detected. Please install Freighter to connect your wallet.",
    );
  }

  const result = await api.requestAccess();
  if (result.error) {
    throw new Error(result.error.message || "Wallet connection was rejected by the user.");
  }
  return result.address;
}

export async function signChallengeXdr(
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  const api = await loadFreighter();
  if (!api) throw new Error("Wallet not available");

  const result = await api.signTransaction(xdr, { networkPassphrase });
  if (result.error) {
    throw new Error(result.error.message || "Signature rejected by the user.");
  }
  return result.signedTxXdr;
}

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address);
}
