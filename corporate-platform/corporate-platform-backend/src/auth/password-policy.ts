import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import * as bcrypt from 'bcrypt';

/**
 * Single source of truth for the password strength policy (#810) — this
 * regex/min-length pair was previously copy-pasted across RegisterDto,
 * ChangePasswordDto and ResetPasswordDto, so a future policy change could
 * easily be applied to one and missed on the others.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_POLICY_REGEX =
  /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
export const PASSWORD_POLICY_MESSAGE =
  'Password must contain uppercase, lowercase, and special characters';

/** Composite decorator applying the full password policy to a DTO field. */
export function IsStrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    IsNotEmpty(),
    MinLength(PASSWORD_MIN_LENGTH),
    Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE }),
  );
}

const DEFAULT_BCRYPT_COST = 10;
const MIN_BCRYPT_COST = 4;
const MAX_BCRYPT_COST = 15;

/**
 * The shared bcrypt work factor (#810), configurable via PASSWORD_HASH_COST
 * so it can be tuned per environment without a code change, previously
 * hardcoded as the literal `10` at every bcrypt.hash call site.
 */
export function getBcryptCost(): number {
  const raw = process.env.PASSWORD_HASH_COST;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (
    Number.isFinite(parsed) &&
    parsed >= MIN_BCRYPT_COST &&
    parsed <= MAX_BCRYPT_COST
  ) {
    return parsed;
  }
  return DEFAULT_BCRYPT_COST;
}

/** Hashes a plaintext password with the shared bcrypt cost. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, getBcryptCost());
}
