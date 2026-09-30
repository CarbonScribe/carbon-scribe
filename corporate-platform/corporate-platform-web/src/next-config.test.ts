import { describe, it, expect, vi, afterEach } from 'vitest';
import nextConfig from '../next.config';

type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };

const ALL_ROUTES_SOURCE = '/(.*)';

async function getRule(source: string): Promise<HeaderRule> {
  if (typeof nextConfig.headers !== 'function') {
    throw new Error('next.config does not export a headers() function');
  }
  const rules = (await nextConfig.headers()) as HeaderRule[];
  const rule = rules.find((r) => r.source === source);
  if (!rule) throw new Error(`Expected a header rule for source "${source}"`);
  return rule;
}

async function getSecurityHeaders(): Promise<Header[]> {
  return (await getRule(ALL_ROUTES_SOURCE)).headers;
}

function headerValue(headers: Header[], key: string): string | undefined {
  return headers.find((h) => h.key === key)?.value;
}

function cspDirective(csp: string, name: string): string {
  const match = csp.match(new RegExp(`${name}\\s+([^;]+)`));
  if (!match) throw new Error(`Missing CSP directive: ${name}`);
  return match[1].trim();
}

describe('next.config security headers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  });

  it('applies a baseline security header set to all routes', async () => {
    const headers = await getSecurityHeaders();

    expect(headerValue(headers, 'X-Frame-Options')).toBe('DENY');
    expect(headerValue(headers, 'X-Content-Type-Options')).toBe('nosniff');
    expect(headerValue(headers, 'Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(headerValue(headers, 'Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
    expect(headerValue(headers, 'Content-Security-Policy')).toBeDefined();
  });

  it('only emits Strict-Transport-Security in production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(
      headerValue(await getSecurityHeaders(), 'Strict-Transport-Security'),
    ).toBeUndefined();

    vi.stubEnv('NODE_ENV', 'production');
    expect(
      headerValue(await getSecurityHeaders(), 'Strict-Transport-Security'),
    ).toBe('max-age=63072000; includeSubDomains; preload');
  });

  it('CSP blocks framing via frame-ancestors and allows required script sources', async () => {
    const csp = headerValue(await getSecurityHeaders(), 'Content-Security-Policy');
    expect(csp).toBeDefined();
    if (!csp) return;

    expect(cspDirective(csp, 'frame-ancestors')).toBe("'none'");
    const scriptSrc = cspDirective(csp, 'script-src');
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  it('CSP connect-src allows the default API base URL', async () => {
    const csp = headerValue(await getSecurityHeaders(), 'Content-Security-Policy');
    expect(csp).toBeDefined();
    if (!csp) return;

    const connectSrc = cspDirective(csp, 'connect-src');
    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain('http://localhost:4000');
  });

  it('CSP connect-src allows a custom NEXT_PUBLIC_API_BASE_URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.com');
    const csp = headerValue(await getSecurityHeaders(), 'Content-Security-Policy');
    expect(csp).toBeDefined();
    if (!csp) return;

    expect(cspDirective(csp, 'connect-src')).toContain('https://api.example.com');
  });

  it('CSP img-src covers every images.remotePatterns host', async () => {
    const csp = headerValue(await getSecurityHeaders(), 'Content-Security-Policy');
    expect(csp).toBeDefined();
    if (!csp) return;

    const imgSrc = cspDirective(csp, 'img-src');
    for (const host of [
      'https://images.unsplash.com',
      'https://*.pinata.cloud',
      'https://cdn.jsdelivr.net',
      'https://*.stellar.org',
    ]) {
      expect(imgSrc).toContain(host);
    }
  });

  it('dev CSP keeps hot reload working (unsafe-eval + WebSocket)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const csp = headerValue(await getSecurityHeaders(), 'Content-Security-Policy');
    expect(csp).toBeDefined();
    if (!csp) return;

    expect(cspDirective(csp, 'script-src')).toContain("'unsafe-eval'");
    const connectSrc = cspDirective(csp, 'connect-src');
    expect(connectSrc).toContain('ws:');
    expect(connectSrc).toContain('wss:');
  });

  it('production CSP is stricter (no unsafe-eval, no WebSocket)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const csp = headerValue(await getSecurityHeaders(), 'Content-Security-Policy');
    expect(csp).toBeDefined();
    if (!csp) return;

    expect(cspDirective(csp, 'script-src')).not.toContain("'unsafe-eval'");
    const connectSrc = cspDirective(csp, 'connect-src');
    expect(connectSrc).not.toContain('ws:');
    expect(connectSrc).not.toContain('wss:');
  });

  it('blocks plugins and confines the document base', async () => {
    const csp = headerValue(await getSecurityHeaders(), 'Content-Security-Policy');
    expect(csp).toBeDefined();
    if (!csp) return;

    expect(cspDirective(csp, 'object-src')).toBe("'none'");
    expect(cspDirective(csp, 'base-uri')).toBe("'self'");
    expect(cspDirective(csp, 'form-action')).toBe("'self'");
  });

  it('preserves the existing caching header rules', async () => {
    const staticRule = await getRule('/_next/static/:path*');
    expect(staticRule.headers).toEqual(
      expect.arrayContaining([
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        { key: 'Vary', value: 'Accept-Encoding' },
      ]),
    );

    const imageRule = await getRule('/_next/image/:path*');
    expect(headerValue(imageRule.headers, 'Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('does not add security headers to the caching rules (no accidental overrides)', async () => {
    const staticRule = await getRule('/_next/static/:path*');
    expect(headerValue(staticRule.headers, 'X-Frame-Options')).toBeUndefined();
    expect(headerValue(staticRule.headers, 'Content-Security-Policy')).toBeUndefined();
  });
});
