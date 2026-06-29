/**
 * Build-time validation for public (`NEXT_PUBLIC_*`) environment variables.
 *
 * The goal is to fail fast: a missing or malformed public config value should
 * surface during `next build` (and be flagged at `next dev` startup) rather than
 * as a cryptic network error at runtime in production.
 *
 * `validatePublicEnv` is a pure function (easy to unit test). `assertPublicEnv`
 * wraps it with logging and throw-on-error behaviour for use in `next.config.ts`.
 */

export interface EnvValidationResult {
  errors: string[];
  warnings: string[];
}

/** Required public URL variables. Missing/invalid values fail a production build. */
const REQUIRED_URL_VARS = [
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL',
] as const;

/** Optional URL variables. Validated only when present; problems warn, never fail. */
const OPTIONAL_URL_VARS = [
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT',
] as const;

/** Optional numeric tuning variables. When set they must parse to a non-negative number. */
const OPTIONAL_NUMERIC_VARS = [
  'NEXT_PUBLIC_TOKEN_REFRESH_BUFFER',
  'NEXT_PUBLIC_SESSION_TIMEOUT_WARNING',
  'NEXT_PUBLIC_MAX_RETRY_ATTEMPTS',
  'NEXT_PUBLIC_RETRY_INITIAL_DELAY_MS',
  'NEXT_PUBLIC_RETRY_MAX_DELAY_MS',
  'NEXT_PUBLIC_RETRY_BACKOFF_MULTIPLIER',
  'NEXT_PUBLIC_DEGRADED_THRESHOLD',
  'NEXT_PUBLIC_DEGRADED_RECOVERY_THRESHOLD',
  'NEXT_PUBLIC_CONNECTIVITY_CHECK_INTERVAL',
  'NEXT_PUBLIC_MAX_QUEUE_SIZE',
  'NEXT_PUBLIC_QUEUE_MAX_RETRIES',
  'NEXT_PUBLIC_ERROR_RATE_LIMIT_MAX',
  'NEXT_PUBLIC_ERROR_RATE_LIMIT_WINDOW_MS',
  'NEXT_PUBLIC_SESSION_EXPIRY_WARNING_MINUTES',
  'NEXT_PUBLIC_SESSION_GRACE_SECONDS',
] as const;

const ENVIRONMENT_VALUES = ['development', 'staging', 'production'] as const;

type EnvRecord = Record<string, string | undefined>;

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function checkHttpUrl(name: string, value: string, sink: string[]): void {
  const url = parseUrl(value);
  if (!url) {
    sink.push(`${name} is not a valid URL (got "${value}").`);
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    sink.push(
      `${name} must use the http or https protocol (got "${url.protocol}").`,
    );
  }
}

/**
 * Validate public environment variables and return collected errors and warnings.
 *
 * This function never throws and has no side effects, so it is safe to call from
 * tests and from the build pipeline.
 *
 * @param env - The environment to validate (defaults to `process.env`).
 */
export function validatePublicEnv(env: EnvRecord = process.env): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required URLs.
  for (const name of REQUIRED_URL_VARS) {
    const value = env[name]?.trim();
    if (!value) {
      errors.push(`${name} is required but is missing or empty.`);
      continue;
    }
    checkHttpUrl(name, value, errors);
    if (value.endsWith('/')) {
      warnings.push(
        `${name} has a trailing slash ("${value}"); remove it to avoid double-slash request paths.`,
      );
    }
  }

  // Optional URLs (validate format only when provided).
  for (const name of OPTIONAL_URL_VARS) {
    const value = env[name]?.trim();
    if (!value) continue;
    checkHttpUrl(name, value, warnings);
  }

  // NEXT_PUBLIC_ENVIRONMENT: optional enum.
  const environment = env.NEXT_PUBLIC_ENVIRONMENT?.trim();
  if (
    environment &&
    !(ENVIRONMENT_VALUES as readonly string[]).includes(environment)
  ) {
    warnings.push(
      `NEXT_PUBLIC_ENVIRONMENT should be one of ${ENVIRONMENT_VALUES.join(', ')} (got "${environment}").`,
    );
  }

  // NEXT_PUBLIC_APP_NAME: optional, but warn if set to an empty string.
  if (
    env.NEXT_PUBLIC_APP_NAME !== undefined &&
    env.NEXT_PUBLIC_APP_NAME.trim() === ''
  ) {
    warnings.push(
      'NEXT_PUBLIC_APP_NAME is set but empty; provide a non-empty value or remove it.',
    );
  }

  // Optional numeric tuning variables.
  for (const name of OPTIONAL_NUMERIC_VARS) {
    const value = env[name]?.trim();
    if (!value) continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      warnings.push(
        `${name} should be a non-negative number (got "${value}").`,
      );
    }
  }

  return { errors, warnings };
}

export interface AssertOptions {
  /** Environment to validate (defaults to `process.env`). */
  env?: EnvRecord;
  /**
   * When true (the default), required-variable problems throw. When false, they
   * are logged as errors but do not throw (used at dev startup so local work with
   * built-in fallbacks is not blocked).
   */
  strict?: boolean;
  /** Logger, injectable for tests. */
  logger?: Pick<Console, 'warn' | 'error'>;
}

const LOG_PREFIX = '[env] Public environment validation';

/**
 * Validate public env vars, log warnings/errors, and throw on errors in strict
 * mode. Set `SKIP_ENV_VALIDATION=1` to bypass entirely (e.g. for tooling that
 * intentionally builds without runtime config).
 */
export function assertPublicEnv(options: AssertOptions = {}): EnvValidationResult {
  const { env = process.env, strict = true, logger = console } = options;

  if (env.SKIP_ENV_VALIDATION === '1' || env.SKIP_ENV_VALIDATION === 'true') {
    return { errors: [], warnings: [] };
  }

  const result = validatePublicEnv(env);

  for (const warning of result.warnings) {
    logger.warn(`${LOG_PREFIX} warning: ${warning}`);
  }

  if (result.errors.length > 0) {
    const message = [
      `${LOG_PREFIX} failed with ${result.errors.length} error(s):`,
      ...result.errors.map((error) => `  - ${error}`),
      '',
      'Set these variables in your environment or .env file.',
      'See .env.example and ENVIRONMENT.md for the full list and rules.',
    ].join('\n');

    if (strict) {
      throw new Error(message);
    }
    logger.error(message);
  }

  return result;
}
