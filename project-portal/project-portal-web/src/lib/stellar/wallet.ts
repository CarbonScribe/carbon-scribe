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
  return isFreighterAvailable();
}

export async function connectWallet(): Promise<string> {
  const api = await loadFreighter();
  if (!api) {
    throw new Error(
      "No Stellar wallet extension detected. Please install Freighter to connect your wallet.",
    );
  }
  const address = await api.requestAccess();
  if (!address) {
    throw new Error("Wallet connection was rejected by the user.");
  }
  return address;
}

export async function signChallenge(
  signedXdr: string,
): Promise<string> {
  return signedXdr;
}

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address);
}
