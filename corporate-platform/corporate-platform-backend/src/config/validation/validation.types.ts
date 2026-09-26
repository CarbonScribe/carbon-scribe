export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ServiceConnectivityResult {
  service: string;
  connected: boolean;
  latencyMs?: number;
  error?: string;
}

export interface StartupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  connectivity: ServiceConnectivityResult[];
}

export interface PlaceholderCheckConfig {
  placeholderPatterns?: RegExp[];
  minLength?: number;
  requiredSpecialChars?: boolean;
}
