const KEY_SLOT = "project-portal-storage-key-v1";

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function getKey(): Promise<CryptoKey> {
  const stored = sessionStorage.getItem(KEY_SLOT);
  const raw = stored ? base64ToBytes(stored) : crypto.getRandomValues(new Uint8Array(32));
  if (!stored) sessionStorage.setItem(KEY_SLOT, bytesToBase64(raw));
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export const encryptedStorage = {
  async getItem(name: string): Promise<string | null> {
    const encoded = localStorage.getItem(name);
    if (!encoded) return null;
    try {
      const [ivText, dataText] = encoded.split(".");
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(ivText) as BufferSource },
        await getKey(),
        base64ToBytes(dataText) as BufferSource,
      );
      return new TextDecoder().decode(plain);
    } catch {
      localStorage.removeItem(name);
      return null;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      await getKey(),
      new TextEncoder().encode(value) as BufferSource,
    );
    localStorage.setItem(name, `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`);
  },
  async removeItem(name: string): Promise<void> {
    localStorage.removeItem(name);
  },
};
