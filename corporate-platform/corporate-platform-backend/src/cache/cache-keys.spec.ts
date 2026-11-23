import {
  CacheKeyError,
  CacheKeys,
  ROLE_AGNOSTIC_SCOPE,
  escapeGlob,
  normalizeRoleScope,
  resolveKeyTemplate,
} from './cache-keys';

describe('cache-keys (#813)', () => {
  describe('CacheKeys', () => {
    it('prefixes tenant keys with company and role scope', () => {
      expect(CacheKeys.tenant('c1', 'portfolio:p1', 'viewer')).toBe(
        't:c1:r:viewer:portfolio:p1',
      );
      expect(CacheKeys.tenant('c1', 'portfolio:p1')).toBe(
        `t:c1:r:${ROLE_AGNOSTIC_SCOPE}:portfolio:p1`,
      );
    });

    it('keeps tenant and global namespaces disjoint', () => {
      expect(CacheKeys.global('portfolio:p1')).toBe('g:portfolio:p1');
      expect(CacheKeys.tenant('c1', 'portfolio:p1')).not.toBe(
        CacheKeys.global('portfolio:p1'),
      );
    });

    it.each([undefined, '', 'c1:r:admin', 'c*', 'c?', 'c[1]'])(
      'rejects a missing or malformed companyId (%p)',
      (companyId) => {
        expect(() => CacheKeys.tenant(companyId as any, 'k')).toThrow(
          CacheKeyError,
        );
        expect(() =>
          CacheKeys.tenantAllRolesPattern(companyId as any, 'k'),
        ).toThrow(CacheKeyError);
      },
    );

    it('builds tenant eviction patterns that cover every role of one tenant', () => {
      expect(CacheKeys.tenantAllRolesPattern('c1', 'dashboard:*')).toBe(
        't:c1:r:*:dashboard:*',
      );
    });
  });

  describe('normalizeRoleScope', () => {
    it('lower-cases roles and defaults missing roles', () => {
      expect(normalizeRoleScope('ADMIN')).toBe('admin');
      expect(normalizeRoleScope(undefined)).toBe('none');
    });

    it('rejects roles that could forge a namespace', () => {
      expect(() => normalizeRoleScope('admin:t:c2')).toThrow(CacheKeyError);
    });
  });

  describe('resolveKeyTemplate', () => {
    it('resolves named tokens from the first source that has them', () => {
      expect(
        resolveKeyTemplate('p:{id}:{page}', [{ id: 'a' }, { page: 2 }]),
      ).toBe('p:a:2');
    });

    it('resolves positional tokens only to primitives', () => {
      expect(resolveKeyTemplate('p:{0}', [], ['x'])).toBe('p:x');
      expect(() => resolveKeyTemplate('p:{0}', [], [{ id: 1 }])).toThrow(
        CacheKeyError,
      );
    });

    it('throws instead of substituting an empty string', () => {
      expect(() => resolveKeyTemplate('portfolio:{companyId}', [{}])).toThrow(
        CacheKeyError,
      );
      expect(() =>
        resolveKeyTemplate('portfolio:{companyId}', [{ companyId: '' }]),
      ).toThrow(CacheKeyError);
      expect(() =>
        resolveKeyTemplate('portfolio:{companyId}', [{ companyId: null }]),
      ).toThrow(CacheKeyError);
    });

    it('has no single-argument shortcut', () => {
      // Previously any token resolved to String(args[0]) for single-arg
      // handlers, which produced `[object Object]` keys.
      expect(() =>
        resolveKeyTemplate('portfolio:{companyId}', [], [{ other: 1 }]),
      ).toThrow(CacheKeyError);
      expect(() =>
        resolveKeyTemplate('portfolio:{companyId}', [{ companyId: { a: 1 } }]),
      ).toThrow(CacheKeyError);
    });

    it('glob-escapes values when building patterns', () => {
      expect(resolveKeyTemplate('p:{id}', [{ id: 'a*b?[c]' }], [], true)).toBe(
        'p:a\\*b\\?\\[c\\]',
      );
      expect(escapeGlob('x\\y')).toBe('x\\\\y');
    });
  });
});
