import type { HelmetOptions } from "helmet";

/**
 * Helmet configuration for agent-service (issue #631).
 *
 * agent-service is a pure JSON API: every route under /health and /agents
 * responds with `application/json`, and nothing here renders HTML, serves
 * static assets, or is ever loaded as a browser document. The options below
 * are chosen for that shape rather than left at Helmet's document-oriented
 * defaults:
 *
 * - `contentSecurityPolicy: false` — a CSP only governs how a browser may
 *   load subresources for a *document*. There is no document here, so the
 *   default policy (`default-src 'self'`, `upgrade-insecure-requests`, …)
 *   would be misleading noise on JSON consumed by other services. It is
 *   disabled deliberately; if a browser-facing surface is ever added to this
 *   service, CSP must be re-enabled and scoped to that surface.
 * - `crossOriginEmbedderPolicy: false` — COEP is likewise a document-level
 *   control (it gates subresource loading), so it has no effect on a JSON
 *   API and is disabled to keep responses clean.
 *
 * Everything else is kept and pinned explicitly to the values the repo
 * already uses in corporate-platform-backend, so a future Helmet default
 * change cannot silently weaken agent-service:
 *
 * - X-Content-Type-Options: nosniff            — stop MIME-sniffing of JSON
 * - X-Frame-Options: DENY                      — no response may be framed
 * - Strict-Transport-Security                  — HTTPS for 1 year, incl. subdomains
 * - Referrer-Policy                            — don't leak internal paths cross-origin
 * - X-DNS-Prefetch-Control / X-Download-Options / X-Permitted-Cross-Domain-Policies
 * - Cross-Origin-Opener-Policy / Cross-Origin-Resource-Policy: same-origin
 * - hidePoweredBy                              — drop the `X-Powered-By: Express` fingerprint
 *
 * Kept in its own module (rather than inline in main.ts) so the header test
 * exercises the exact options the running service ships with; main.ts still
 * applies it itself via `app.use(helmet(helmetOptions))`.
 */
export const helmetOptions: HelmetOptions = {
  // Not meaningful for a JSON-only API — see the note above.
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,

  noSniff: true,
  frameguard: { action: "deny" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  dnsPrefetchControl: { allow: false },
  hidePoweredBy: true,
  xssFilter: true,
  ieNoOpen: true,
  originAgentCluster: true,
};
