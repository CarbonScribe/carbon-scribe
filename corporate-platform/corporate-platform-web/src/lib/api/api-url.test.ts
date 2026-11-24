import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { apiUrl } from './api-url';

const srcDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function getApplicationSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return getApplicationSourceFiles(entryPath);
    if (!/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) {
      return [];
    }
    return [entryPath];
  });
}

describe('apiUrl', () => {
  it('uses the validated default base and adds the API prefix', () => {
    expect(apiUrl('/projects')).toBe('http://localhost:4000/api/v1/projects');
  });

  it('normalizes trailing slashes, existing API prefixes, and relative paths', () => {
    expect(apiUrl('api/v1/projects', 'https://api.example.com/api/v1/')).toBe(
      'https://api.example.com/api/v1/projects',
    );
  });

  it('does not duplicate the API prefix when callers already include it', () => {
    expect(apiUrl('/api/v1/teams?limit=5', 'https://api.example.com/')).toBe(
      'https://api.example.com/api/v1/teams?limit=5',
    );
  });

  it('keeps API URL environment reads centralized in env.ts', () => {
    const deprecatedVariable = `NEXT_PUBLIC_API_${'URL'}`;
    const baseVariable = `NEXT_PUBLIC_API_BASE_${'URL'}`;
    const directRead = new RegExp(
      `process\\.env(?:\\?\\.)?(?:\\.(?:${deprecatedVariable}|${baseVariable})|\\[['"](?:${deprecatedVariable}|${baseVariable})['"]\\])`,
    );
    const offenders = getApplicationSourceFiles(srcDirectory).filter((file) => {
      const relativePath = path.relative(srcDirectory, file);
      if (relativePath === 'env.ts' || relativePath === 'lib/api/api-url.test.ts') return false;
      return directRead.test(readFileSync(file, 'utf8'));
    });

    expect(offenders).toEqual([]);
  });
});
