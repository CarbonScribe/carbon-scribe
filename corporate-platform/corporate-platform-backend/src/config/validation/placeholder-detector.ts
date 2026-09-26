import { PlaceholderCheckConfig } from './validation.types';

const DEFAULT_PLACEHOLDER_PATTERNS = [
  /^dev[-_]?/i,
  /^test[-_]?/i,
  /^demo[-_]?/i,
  /^placeholder[-_]?/i,
  /^change[-_]?me/i,
  /^sample[-_]?/i,
  /^example[-_]?/i,
  /^your[-_]?/i,
  /^dummy[-_]?/i,
  /^mock[-_]?/i,
  /^temp[-_]?/i,
  /^local[-_]?/i,
  /^secret$/i,
  /^password$/i,
  /^key$/i,
  /^token$/i,
  /^jwt[-_]?secret$/i,
];

export class PlaceholderDetector {
  private patterns: RegExp[];

  constructor(customPatterns?: RegExp[]) {
    this.patterns = [
      ...DEFAULT_PLACEHOLDER_PATTERNS,
      ...(customPatterns || []),
    ];
  }

  /**
   * Checks if a value appears to be a placeholder
   */
  isPlaceholder(value: string, config?: PlaceholderCheckConfig): boolean {
    if (!value || typeof value !== 'string') {
      return true;
    }

    const trimmedValue = value.trim();

    // Check against placeholder patterns
    const hasPlaceholderPattern = this.patterns.some((pattern) =>
      pattern.test(trimmedValue),
    );

    if (hasPlaceholderPattern) {
      return true;
    }

    // Check minimum length if configured
    if (config?.minLength && trimmedValue.length < config.minLength) {
      return true;
    }

    // Check for required special characters
    if (config?.requiredSpecialChars) {
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(
        trimmedValue,
      );
      if (!hasSpecialChar) {
        return true;
      }
    }

    // Check for common weak patterns
    const weakPatterns = [
      /^[a-zA-Z0-9]{4,8}$/, // Short alphanumeric only
      /^[a-zA-Z]+$/, // Letters only
      /^[0-9]+$/, // Numbers only
      /^password$/i,
      /^secret$/i,
      /^token$/i,
    ];

    const hasWeakPattern = weakPatterns.some((pattern) =>
      pattern.test(trimmedValue),
    );

    return hasWeakPattern;
  }

  /**
   * Validates a value against placeholder detection rules
   */
  validateValue(
    value: string,
    name: string,
    config?: PlaceholderCheckConfig,
  ): {
    isValid: boolean;
    message?: string;
  } {
    if (!value || typeof value !== 'string') {
      return {
        isValid: false,
        message: `${name} is empty or invalid`,
      };
    }

    if (this.isPlaceholder(value, config)) {
      return {
        isValid: false,
        message: `${name} appears to be a placeholder value. Please set a secure value.`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validates multiple values at once
   */
  validateValues(
    values: Record<string, string>,
    configs?: Record<string, PlaceholderCheckConfig>,
  ): Record<string, { isValid: boolean; message?: string }> {
    const results: Record<string, { isValid: boolean; message?: string }> = {};

    for (const [key, value] of Object.entries(values)) {
      const config = configs?.[key];
      results[key] = this.validateValue(value, key, config);
    }

    return results;
  }
}
