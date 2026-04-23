import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loginSchema, registerSchema, changePasswordSchema } from '@/lib/validation-schemas';

describe('Auth Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login credentials', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'password123',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email).toBeDefined();
      }
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const validData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Test Company',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject passwords with no uppercase', () => {
      const invalidData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Test Company',
        password: 'securepass123!',
        confirmPassword: 'securepass123!',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject passwords with no lowercase', () => {
      const invalidData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Test Company',
        password: 'SECUREPASS123!',
        confirmPassword: 'SECUREPASS123!',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject passwords with no number', () => {
      const invalidData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Test Company',
        password: 'SecurePass!',
        confirmPassword: 'SecurePass!',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject passwords with no special character', () => {
      const invalidData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Test Company',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject passwords shorter than 8 characters', () => {
      const invalidData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Test Company',
        password: 'Pass12!',
        confirmPassword: 'Pass12!',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Test Company',
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass123!',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
      }
    });

    it('should reject short first name', () => {
      const invalidData = {
        email: 'test@example.com',
        firstName: 'J',
        lastName: 'Doe',
        companyName: 'Test Company',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate correct password change data', () => {
      const validData = {
        oldPassword: 'OldPass123!',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'NewSecurePass123!',
      };

      const result = changePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject mismatched new passwords', () => {
      const invalidData = {
        oldPassword: 'OldPass123!',
        newPassword: 'NewSecurePass123!',
        confirmPassword: 'DifferentPass123!',
      };

      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
