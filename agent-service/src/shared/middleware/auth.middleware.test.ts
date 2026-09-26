import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRETS = {
  "corporate-platform": "corporate-platform-secret",
  "project-portal": "project-portal-secret",
};

vi.mock("../../config/env.js", () => ({
  env: { serviceTokenSecrets: SECRETS },
}));

const { requireInternalAuth } = await import("./auth.middleware.js");
const { signServiceToken } = await import("../auth/service-token.js");

function mockReqRes(authHeader?: string) {
  const req = {
    header: (name: string) =>
      name.toLowerCase() === "authorization" ? authHeader : undefined,
  } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe("requireInternalAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(Object.keys(SECRETS))(
    "authenticates a valid token from %s and attaches its identity",
    (issuer) => {
      const token = signServiceToken(
        issuer,
        SECRETS[issuer as keyof typeof SECRETS],
      );
      const { req, res, next } = mockReqRes(`Bearer ${token}`);

      requireInternalAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.callingService).toBe(issuer);
      expect(res.status).not.toHaveBeenCalled();
    },
  );

  it("rejects a request with no Authorization header", () => {
    const { req, res, next } = mockReqRes(undefined);

    requireInternalAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(req.callingService).toBeUndefined();
  });

  it("rejects a header that isn't a Bearer token", () => {
    const { req, res, next } = mockReqRes("Basic dXNlcjpwYXNz");

    requireInternalAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects an expired token", () => {
    const token = signServiceToken(
      "corporate-platform",
      SECRETS["corporate-platform"],
      {
        expiresInSeconds: -10,
      },
    );
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    requireInternalAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects a token from an untrusted issuer", () => {
    const token = signServiceToken(
      "some-untrusted-service",
      "attacker-controlled-secret",
    );
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    requireInternalAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects a token signed with the wrong secret for its claimed issuer", () => {
    const token = signServiceToken(
      "corporate-platform",
      SECRETS["project-portal"],
    );
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    requireInternalAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
