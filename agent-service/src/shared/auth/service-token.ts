import jwt from "jsonwebtoken";

// Service-to-service auth (issue #579): every upstream caller (currently
// corporate-platform and project-portal) signs its own short-lived HS256
// JWT with its own secret and sends it as `Authorization: Bearer <token>`
// — the same Bearer convention those platforms already use for their own
// user-facing JWTs. Keying secrets per issuer, rather than sharing one
// static secret across every caller, means rotating or revoking one
// caller's credential never affects the others, and the verified `iss`
// claim tells us which service actually made the call — neither of which
// a single shared secret compared with `!==` could ever provide.
//
// A caller mints its token the same way signServiceToken() does below:
// `{ iss: "<its own service name>" }`, HS256-signed with the secret
// registered for it in agent-service's config, short expiry.

const DEFAULT_TOKEN_TTL_SECONDS = 60;

export interface VerifiedServiceIdentity {
  /** The verified issuer claim — which upstream service made this call. */
  service: string;
}

/** Mint a short-lived HS256 service-identity token, e.g. for use in tests. */
export function signServiceToken(
  issuer: string,
  secret: string,
  options: { expiresInSeconds?: number } = {},
): string {
  return jwt.sign({}, secret, {
    issuer,
    algorithm: "HS256",
    expiresIn: options.expiresInSeconds ?? DEFAULT_TOKEN_TTL_SECONDS,
  });
}

/**
 * Verify an inbound service token against the secret registered for its
 * claimed issuer, returning the verified identity or null.
 *
 * Rejects (returns null) when: the token is malformed or has no `iss`
 * claim, the claimed issuer has no secret registered (including one whose
 * registered secret is an empty string — never verify against an empty
 * key), or `jsonwebtoken.verify` rejects the token for any reason
 * (bad signature, expired, wrong algorithm, issuer mismatch).
 */
export function verifyServiceToken(
  token: string,
  secretsByIssuer: Record<string, string>,
): VerifiedServiceIdentity | null {
  // Read the issuer claim without trusting it yet — only to pick which
  // registered secret to verify the signature against. The actual trust
  // decision happens in the jwt.verify() call below, which fails closed if
  // the token wasn't really signed by that issuer's secret.
  const decoded = jwt.decode(token, { json: true });
  const claimedIssuer =
    decoded && typeof decoded === "object" && typeof decoded.iss === "string"
      ? decoded.iss
      : undefined;
  if (!claimedIssuer) {
    return null;
  }

  const secret = secretsByIssuer[claimedIssuer];
  if (!secret) {
    return null;
  }

  try {
    const verified = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: claimedIssuer,
    });
    if (typeof verified === "string") {
      return null;
    }
    return { service: claimedIssuer };
  } catch {
    return null;
  }
}
