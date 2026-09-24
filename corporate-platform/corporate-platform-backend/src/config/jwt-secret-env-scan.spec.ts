import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Guards against a future regression reintroducing a direct
 * process.env.JWT_SECRET read (with or without a fallback literal)
 * anywhere outside ConfigService, which is the only module allowed to
 * read it — see #540.
 */

const SRC_ROOT = join(__dirname, '..');
const ALLOWED_FILES = new Set([join(SRC_ROOT, 'config', 'config.service.ts')]);
const DIRECT_READ_PATTERN = /process\.env\.JWT_SECRET/;

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectTsFiles(fullPath, out);
    } else if (
      entry.endsWith('.ts') &&
      !entry.endsWith('.spec.ts') &&
      !entry.endsWith('.d.ts')
    ) {
      out.push(fullPath);
    }
  }
  return out;
}

describe('JWT_SECRET direct-env-read scan', () => {
  it('flags any process.env.JWT_SECRET read outside ConfigService', () => {
    const offenders = collectTsFiles(SRC_ROOT)
      .filter((file) => !ALLOWED_FILES.has(file))
      .filter((file) => DIRECT_READ_PATTERN.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('confirms the scan itself still detects a direct read (sanity check)', () => {
    const fixture = 'const secret = process.env.JWT_SECRET || "dev-jwt-secret";';
    expect(DIRECT_READ_PATTERN.test(fixture)).toBe(true);
  });
});
