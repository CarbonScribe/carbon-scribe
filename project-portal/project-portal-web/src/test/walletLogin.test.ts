import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidStellarAddress } from "@/lib/stellar/wallet";

vi.mock("@/lib/stellar/wallet", async () => {
  const actual = await vi.importActual("@/lib/stellar/wallet");
  return {
    ...actual,
    connectWallet: vi.fn(),
    isWalletInstalled: vi.fn(),
    signChallengeXdr: vi.fn(),
  };
});

vi.mock("@/lib/api/auth.api", () => ({
  walletChallengeApi: vi.fn(),
  walletLoginApi: vi.fn(),
}));

import { connectWallet, isWalletInstalled, signChallengeXdr } from "@/lib/stellar/wallet";
import { walletChallengeApi, walletLoginApi } from "@/lib/api/auth.api";

describe("Stellar wallet login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates correct Stellar G-address format", () => {
    const valid =
      "GBZ3POYXCBG5V2I4XVQUQMN7G3QE4X7KQXQ5YHVKCEN4QCU6LM4V36XL";
    expect(isValidStellarAddress(valid)).toBe(true);
  });

  it("rejects non-G prefix addresses", () => {
    expect(
      isValidStellarAddress("ABZ3POYXCBG5V2I4XVQUQMN7G3QE4X7KQXQ5YHVKCEN4QCU6LM4V36XL"),
    ).toBe(false);
  });

  it("rejects addresses with invalid length", () => {
    expect(isValidStellarAddress("GBZ3POYXCBG5V2I4")).toBe(false);
  });

  it("calls connectWallet and returns a public key", async () => {
    const mockKey = "GBZ3POYXCBG5V2I4XVQUQMN7G3QE4X7KQXQ5YHVKCEN4QCU6LM4V36XL";
    vi.mocked(connectWallet).mockResolvedValue(mockKey);

    const key = await connectWallet();
    expect(key).toBe(mockKey);
    expect(connectWallet).toHaveBeenCalledOnce();
  });

  it("throws when wallet extension is not installed", async () => {
    vi.mocked(isWalletInstalled).mockResolvedValue(false);
    vi.mocked(connectWallet).mockRejectedValue(
      new Error(
        "No Stellar wallet extension detected. Please install Freighter to connect your wallet.",
      ),
    );

    await expect(connectWallet()).rejects.toThrow(
      "No Stellar wallet extension detected",
    );
  });

  it("calls walletChallengeApi with the connected public key", async () => {
    const mockKey = "GBZ3POYXCBG5V2I4XVQUQMN7G3QE4X7KQXQ5YHVKCEN4QCU6LM4V36XL";
    vi.mocked(walletChallengeApi).mockResolvedValue({
      challenge: "signed-xdr-string",
      expires_in: 900,
    });

    const result = await walletChallengeApi(mockKey);
    expect(result.challenge).toBe("signed-xdr-string");
    expect(walletChallengeApi).toHaveBeenCalledWith(mockKey);
  });

  it("calls walletLoginApi with public key and signed challenge", async () => {
    const mockResponse = {
      access_token: "jwt-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
      user: {
        id: "1",
        email: "",
        full_name: "",
        organization: "",
        role: "farmer",
        email_verified: true,
        is_active: true,
      },
    };
    vi.mocked(walletLoginApi).mockResolvedValue(mockResponse);

    const result = await walletLoginApi({
      public_key: "GBZ3POYXCBG5V2I4XVQUQMN7G3QE4X7KQXQ5YHVKCEN4QCU6LM4V36XL",
      signed_challenge: "signed-xdr",
    });

    expect(result.access_token).toBe("jwt-token");
    expect(walletLoginApi).toHaveBeenCalledWith({
      public_key: "GBZ3POYXCBG5V2I4XVQUQMN7G3QE4X7KQXQ5YHVKCEN4QCU6LM4V36XL",
      signed_challenge: "signed-xdr",
    });
  });

  it("signChallengeXdr returns signed XDR from wallet", async () => {
    vi.mocked(signChallengeXdr).mockResolvedValue("signed-xdr-result");

    const result = await signChallengeXdr("challenge-xdr", "Test SDF Network ; September 2015");
    expect(result).toBe("signed-xdr-result");
  });

  it("signChallengeXdr throws when user rejects", async () => {
    vi.mocked(signChallengeXdr).mockRejectedValue(
      new Error("Signature rejected by the user."),
    );

    await expect(
      signChallengeXdr("challenge-xdr", "Test SDF Network ; September 2015"),
    ).rejects.toThrow("Signature rejected by the user.");
  });
});
