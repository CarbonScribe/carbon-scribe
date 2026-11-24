/**
 * Cache key namespacing (#813).
 *
 * Every Redis cache key belongs to exactly one namespace:
 *
 *   - Tenant-scoped:  `t:{companyId}:r:{roleScope}:{key}`
 *   - Global:         `g:{key}`
 *
 * Tenant-scoped data always carries the owning company ID, so two tenants can
 * never read or evict each other's entries. `roleScope` separates responses
 * that differ by role (e.g. admin vs viewer); service-level data that does not
 * depend on the caller's role uses {@link ROLE_AGNOSTIC_SCOPE}.
 *
 * Global data (reference data, public marketplace aggregates, ...) must opt in
 * explicitly via {@link CacheKeys.global} or `scope: 'global'`.
 */

export type CacheScope = 'tenant' | 'global';

/** Role scope used for tenant data that is identical for every role. */
export const ROLE_AGNOSTIC_SCOPE = 'all';

/** Role scope used when an authenticated tenant user carries no role claim. */
export const UNKNOWN_ROLE_SCOPE = 'none';

/**
 * Raised when a cache key cannot be built safely: a template token is
 * unresolved or non-primitive, or a tenant/role identifier is missing or
 * malformed. Callers must skip caching rather than fall back to a shared key.
 */
export class CacheKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheKeyError';
  }
}

/** Identifiers embedded in the namespace prefix must not contain `:` or globs. */
const IDENTIFIER_RE = /^[A-Za-z0-9._@-]+$/;

function assertIdentifier(name: string, value: unknown): string {
  if (typeof value !== 'string' || !IDENTIFIER_RE.test(value)) {
    throw new CacheKeyError(`Invalid or missing ${name} for cache key`);
  }
  return value;
}

/** Escape Redis glob metacharacters so a value only ever matches literally. */
export function escapeGlob(value: string): string {
  return value.replace(/[*?[\]\\]/g, '\\$&');
}

/** Normalise a role claim into a role scope segment. */
export function normalizeRoleScope(role: unknown): string {
  if (role === undefined || role === null || role === '') {
    return UNKNOWN_ROLE_SCOPE;
  }
  return assertIdentifier('role scope', String(role).toLowerCase());
}

export const CacheKeys = {
  /** `t:{companyId}:r:{roleScope}:{key}` */
  tenant(
    companyId: string,
    key: string,
    roleScope: string = ROLE_AGNOSTIC_SCOPE,
  ): string {
    return `t:${assertIdentifier('companyId', companyId)}:r:${assertIdentifier(
      'role scope',
      roleScope,
    )}:${key}`;
  },

  /**
   * Pattern matching `keyPattern` for one tenant across every role scope.
   * `keyPattern` is used verbatim (it may contain globs); the tenant ID is
   * escaped so it can never widen the match.
   */
  tenantAllRolesPattern(companyId: string, keyPattern: string): string {
    return `t:${escapeGlob(
      assertIdentifier('companyId', companyId),
    )}:r:*:${keyPattern}`;
  },

  /** Tag names are tenant-scoped (but role-agnostic) for tenant data. */
  tenantTag(companyId: string, tag: string): string {
    return `t:${assertIdentifier('companyId', companyId)}:${tag}`;
  },

  /** `g:{key}` — explicitly shared across all tenants. */
  global(key: string): string {
    return `g:${key}`;
  },
};

type Primitive = string | number | boolean | bigint;

function asKeyValue(value: unknown): string | undefined {
  if (
    (typeof value === 'string' && value.length > 0) ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value as Primitive);
  }
  return undefined;
}

/**
 * Substitute `{token}` placeholders in a key template.
 *
 * - `{0}`, `{1}`, ... resolve to the positional handler argument, which must
 *   be a primitive.
 * - `{name}` resolves to the first plain-object source that has an own,
 *   primitive `name` property.
 *
 * Anything else (missing, empty, `null`, objects, arrays) throws a
 * {@link CacheKeyError}: there is no fallback to `''` and no single-argument
 * shortcut, so a template can never silently collapse into a shared key.
 *
 * With `escapeValues`, substituted values are glob-escaped (for eviction
 * patterns) so request data cannot broaden what a pattern deletes.
 */
export function resolveKeyTemplate(
  template: string,
  sources: unknown[],
  args: unknown[] = [],
  escapeValues = false,
): string {
  return template.replace(/{([^}]+)}/g, (_match, token: string) => {
    let value: string | undefined;
    if (/^\d+$/.test(token)) {
      value = asKeyValue(args[Number(token)]);
    } else {
      for (const source of sources) {
        if (
          source &&
          typeof source === 'object' &&
          !Array.isArray(source) &&
          Object.prototype.hasOwnProperty.call(source, token)
        ) {
          value = asKeyValue((source as Record<string, unknown>)[token]);
          if (value !== undefined) break;
        }
      }
    }
    if (value === undefined) {
      throw new CacheKeyError(
        `Unresolved cache key token {${token}} in template "${template}"`,
      );
    }
    return escapeValues ? escapeGlob(value) : value;
  });
}
