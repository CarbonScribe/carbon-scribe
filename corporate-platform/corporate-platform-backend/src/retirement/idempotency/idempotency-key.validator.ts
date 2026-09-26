export class IdempotencyKeyValidator {
  private static readonly MAX_LENGTH = 255;
  private static readonly ALLOWED_PATTERN = /^[a-zA-Z0-9\-_]+$/;

  /**
   * Validates an idempotency key format and length
   */
  static validate(key: string): { valid: boolean; error?: string } {
    if (!key || typeof key !== 'string') {
      return {
        valid: false,
        error: 'Idempotency key must be a non-empty string',
      };
    }

    if (key.length > this.MAX_LENGTH) {
      return {
        valid: false,
        error: `Idempotency key must be at most ${this.MAX_LENGTH} characters`,
      };
    }

    if (!this.ALLOWED_PATTERN.test(key)) {
      return {
        valid: false,
        error:
          'Idempotency key must contain only alphanumeric characters, hyphens, and underscores',
      };
    }

    return { valid: true };
  }

  /**
   * Normalizes an idempotency key (trim, lowercase)
   */
  static normalize(key: string): string {
    return key.trim();
  }
}
