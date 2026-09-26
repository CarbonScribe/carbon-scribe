import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { signServiceToken, verifyServiceToken } from "./service-token.js";

const SECRETS = {
  "corporate-platform": "corporate-platform-secret",
  "project-portal": "project-portal-secret",
};

describe("signServiceToken / verifyServiceToken", () => {
  it("verifies a valid token from each configured caller", () => {
    for (const issuer of Object.keys(SECRETS)) {
      const token = signServiceToken(
        issuer,
        SECRETS[issuer as keyof typeof SECRETS],
      );
      const result = verifyServiceToken(token, SECRETS);
      expect(result).toEqual({ service: issuer });
    }
  });

  it("rejects an expired token", () => {
    const token = signServiceToken(
      "corporate-platform",
      SECRETS["corporate-platform"],
      {
        expiresInSeconds: -10,
      },
    );
    expect(verifyServiceToken(token, SECRETS)).toBeNull();
  });

  it("rejects a token from an issuer with no registered secret (untrusted issuer)", () => {
    const token = jwt.sign({}, "whatever-secret-an-attacker-controls", {
      issuer: "some-other-service",
      algorithm: "HS256",
      expiresIn: 60,
    });
    expect(verifyServiceToken(token, SECRETS)).toBeNull();
  });

  it("rejects a token whose signature doesn't match its claimed issuer's secret", () => {
    // Claims to be corporate-platform but is actually signed with
    // project-portal's secret (or any secret other than the claimed
    // issuer's own) — the per-issuer secret lookup must catch this.
    const token = jwt.sign({}, SECRETS["project-portal"], {
      issuer: "corporate-platform",
      algorithm: "HS256",
      expiresIn: 60,
    });
    expect(verifyServiceToken(token, SECRETS)).toBeNull();
  });

  it("rejects a token whose issuer has an empty registered secret", () => {
    // The token itself is validly signed with *some* secret — the point is
    // that agent-service's own config has no real secret on file for this
    // issuer, so it must never be treated as trusted regardless.
    const secretsWithBlankEntry = { ...SECRETS, "blank-caller": "" };
    const token = jwt.sign({}, "whatever-secret-the-caller-used", {
      issuer: "blank-caller",
      algorithm: "HS256",
      expiresIn: 60,
    });
    expect(verifyServiceToken(token, secretsWithBlankEntry)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyServiceToken("not-a-jwt-at-all", SECRETS)).toBeNull();
    expect(verifyServiceToken("", SECRETS)).toBeNull();
  });

  it("rejects a token with no iss claim", () => {
    const token = jwt.sign({}, SECRETS["corporate-platform"], {
      algorithm: "HS256",
      expiresIn: 60,
    });
    expect(verifyServiceToken(token, SECRETS)).toBeNull();
  });
});
