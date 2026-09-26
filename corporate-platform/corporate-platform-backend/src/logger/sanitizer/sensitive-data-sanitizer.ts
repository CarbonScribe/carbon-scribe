export class SensitiveDataSanitizer {
  private static readonly SENSITIVE_PATTERNS = [
    { pattern: /password/gi, replacement: '[REDACTED]' },
    { pattern: /secret/gi, replacement: '[REDACTED]' },
    { pattern: /token/gi, replacement: '[REDACTED]' },
    { pattern: /authorization/gi, replacement: '[REDACTED]' },
    { pattern: /bearer\s+[a-zA-Z0-9._-]+/gi, replacement: 'Bearer [REDACTED]' },
    { pattern: /api[_-]?key/gi, replacement: '[REDACTED]' },
    { pattern: /jwt/gi, replacement: '[REDACTED]' },
    { pattern: /refresh[_-]?token/gi, replacement: '[REDACTED]' },
    { pattern: /access[_-]?token/gi, replacement: '[REDACTED]' },
    { pattern: /private[_-]?key/gi, replacement: '[REDACTED]' },
    { pattern: /pinnata[_-]?secret/gi, replacement: '[REDACTED]' },
    { pattern: /stellar[_-]?secret/gi, replacement: '[REDACTED]' },
  ];

  private static readonly EMAIL_PATTERN =
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  /**
   * Sanitizes sensitive data from a string or object
   */
  static sanitize<T>(data: T, redactEmail: boolean = false): T {
    if (typeof data === 'string') {
      return this.sanitizeString(data, redactEmail) as T;
    }

    if (typeof data === 'object' && data !== null) {
      return this.sanitizeObject(data, redactEmail) as T;
    }

    return data;
  }

  private static sanitizeString(str: string, redactEmail: boolean): string {
    let result = str;

    // Redact sensitive patterns
    for (const { pattern, replacement } of this.SENSITIVE_PATTERNS) {
      result = result.replace(pattern, replacement);
    }

    // Redact emails if requested
    if (redactEmail) {
      result = result.replace(this.EMAIL_PATTERN, '[EMAIL REDACTED]');
    }

    return result;
  }

  private static sanitizeObject(
    obj: Record<string, any>,
    redactEmail: boolean,
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const isSensitiveKey = this.SENSITIVE_PATTERNS.some(({ pattern }) =>
        pattern.test(key),
      );

      if (isSensitiveKey && typeof value === 'string') {
        result[key] = '[REDACTED]';
        continue;
      }

      if (typeof value === 'string') {
        result[key] = this.sanitizeString(value, redactEmail);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeObject(value, redactEmail);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Checks if a log entry should be sanitized
   */
  static shouldSanitize(level: string, environment: string): boolean {
    // Always sanitize error logs and production logs
    return (
      level === 'error' || level === 'fatal' || environment === 'production'
    );
  }
}
