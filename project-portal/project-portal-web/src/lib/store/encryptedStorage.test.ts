import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptedStorage } from "./encryptedStorage";

describe("encryptedStorage", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.spyOn(localStorage, "getItem").mockImplementation((key) => values.get(key) ?? null);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => values.set(key, value));
    vi.spyOn(localStorage, "removeItem").mockImplementation((key) => values.delete(key));
    vi.spyOn(localStorage, "clear").mockImplementation(() => values.clear());
    localStorage.clear();
    sessionStorage.clear();
  });

  it("does not persist plaintext tokens", async () => {
    await encryptedStorage.setItem("project-portal-store-v2", JSON.stringify({ token: "jwt-secret", refreshToken: "refresh-secret" }));
    const raw = localStorage.getItem("project-portal-store-v2");
    expect(raw).not.toContain("jwt-secret");
    expect(raw).not.toContain("refresh-secret");
    await expect(encryptedStorage.getItem("project-portal-store-v2")).resolves.toContain("jwt-secret");
  });

  it("clears corrupted state gracefully", async () => {
    localStorage.setItem("project-portal-store-v2", "not-encrypted");
    await expect(encryptedStorage.getItem("project-portal-store-v2")).resolves.toBeNull();
    expect(localStorage.getItem("project-portal-store-v2")).toBeNull();
  });
});
