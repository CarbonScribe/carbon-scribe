import { describe, it, expect } from 'vitest';
import {
  parseApiError,
  ErrorCode,
  getErrorMessageForCode,
  formatFieldErrors,
  isErrorType,
  hasFieldErrors,
} from './errorParser';

describe('errorParser', () => {
  describe('parseApiError', () => {
    it('should parse { message: string } shape', () => {
      const error = { message: 'Invalid input' };
      const parsed = parseApiError(error, 400);
      expect(parsed.message).toBe('Invalid input');
      expect(parsed.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should parse { error: string } shape', () => {
      const error = { error: 'Unauthorized' };
      const parsed = parseApiError(error, 401);
      expect(parsed.message).toBe('Unauthorized');
      expect(parsed.code).toBe(ErrorCode.AUTH_ERROR);
    });

    it('should parse { error: { message: string } } shape', () => {
      const error = { error: { message: 'Not found' } };
      const parsed = parseApiError(error, 404);
      expect(parsed.message).toBe('Not found');
      expect(parsed.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('should parse { errors: Array<{ message: string }> } shape', () => {
      const error = { errors: [{ message: 'First error' }, { message: 'Second error' }] };
      const parsed = parseApiError(error, 400);
      expect(parsed.message).toBe('First error');
    });

    it('should parse { errors: string[] } shape', () => {
      const error = { errors: ['Error 1', 'Error 2'] };
      const parsed = parseApiError(error, 400);
      expect(parsed.message).toBe('Error 1');
    });

    it('should parse { detail: string } shape', () => {
      const error = { detail: 'Detailed error message' };
      const parsed = parseApiError(error, 500);
      expect(parsed.message).toBe('Detailed error message');
    });

    it('should parse { title: string, detail: string } shape', () => {
      const error = { title: 'Validation Failed', detail: 'Invalid email format' };
      const parsed = parseApiError(error, 422);
      expect(parsed.message).toBe('Validation Failed: Invalid email format');
    });

    it('should parse { title: string } shape', () => {
      const error = { title: 'Server Error' };
      const parsed = parseApiError(error, 500);
      expect(parsed.message).toBe('Server Error');
    });

    it('should parse field-level validation errors', () => {
      const error = { errors: { email: ['Invalid format'], name: ['Required'] } };
      const parsed = parseApiError(error, 422);
      expect(parsed.fieldErrors).toEqual({
        email: ['Invalid format'],
        name: ['Required'],
      });
    });

    it('should parse fieldErrors shape', () => {
      const error = { fieldErrors: { password: ['Too short'] } };
      const parsed = parseApiError(error, 422);
      expect(parsed.fieldErrors).toEqual({
        password: ['Too short'],
      });
    });

    it('should handle string errors', () => {
      const error = 'Something went wrong';
      const parsed = parseApiError(error);
      expect(parsed.message).toBe('Something went wrong');
    });

    it('should handle Error objects', () => {
      const error = new Error('Network failure');
      const parsed = parseApiError(error);
      expect(parsed.message).toBe('Network failure');
    });

    it('should handle network errors (TypeError)', () => {
      const error = new TypeError('Failed to fetch');
      const parsed = parseApiError(error);
      expect(parsed.message).toBe('Network error. Please check your connection and try again.');
      expect(parsed.code).toBe(ErrorCode.NETWORK_ERROR);
    });

    it('should handle AbortError (timeout)', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      const parsed = parseApiError(error);
      expect(parsed.message).toBe('Request timed out. Please try again.');
      expect(parsed.code).toBe(ErrorCode.NETWORK_ERROR);
    });

    it('should use status code messages when no message found', () => {
      const error = { data: 'something' };
      const parsed = parseApiError(error, 404);
      expect(parsed.message).toBe('Resource not found.');
    });

    it('should use fallback message for unknown errors', () => {
      const error = { random: 'data' };
      const parsed = parseApiError(error);
      expect(parsed.message).toBe('Something went wrong. Please try again.');
    });

    it('should map status codes to error codes', () => {
      expect(parseApiError({}, 400).code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(parseApiError({}, 401).code).toBe(ErrorCode.AUTH_ERROR);
      expect(parseApiError({}, 403).code).toBe(ErrorCode.AUTH_ERROR);
      expect(parseApiError({}, 404).code).toBe(ErrorCode.NOT_FOUND);
      expect(parseApiError({}, 422).code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(parseApiError({}, 500).code).toBe(ErrorCode.SERVER_ERROR);
    });
  });

  describe('getErrorMessageForCode', () => {
    it('should return user-friendly messages for error codes', () => {
      expect(getErrorMessageForCode(ErrorCode.VALIDATION_ERROR)).toBe('Please check your input and try again.');
      expect(getErrorMessageForCode(ErrorCode.AUTH_ERROR)).toBe('Authentication required. Please log in.');
      expect(getErrorMessageForCode(ErrorCode.NOT_FOUND)).toBe('The requested resource was not found.');
      expect(getErrorMessageForCode(ErrorCode.SERVER_ERROR)).toBe('Server error. Please try again later.');
      expect(getErrorMessageForCode(ErrorCode.NETWORK_ERROR)).toBe('Network error. Please check your connection.');
      expect(getErrorMessageForCode(ErrorCode.UNKNOWN_ERROR)).toBe('Something went wrong. Please try again.');
    });
  });

  describe('formatFieldErrors', () => {
    it('should format field errors for display', () => {
      const fieldErrors = {
        email: ['Invalid format', 'Already taken'],
        password: ['Too short'],
      };
      const formatted = formatFieldErrors(fieldErrors);
      expect(formatted).toEqual([
        'email: Invalid format',
        'email: Already taken',
        'password: Too short',
      ]);
    });

    it('should handle empty field errors', () => {
      const formatted = formatFieldErrors({});
      expect(formatted).toEqual([]);
    });
  });

  describe('isErrorType', () => {
    it('should check if error is a specific type', () => {
      const error = parseApiError({}, 401);
      expect(isErrorType(error, ErrorCode.AUTH_ERROR)).toBe(true);
      expect(isErrorType(error, ErrorCode.VALIDATION_ERROR)).toBe(false);
    });
  });

  describe('hasFieldErrors', () => {
    it('should check if error has field-level validation errors', () => {
      const errorWithFields = parseApiError({ errors: { email: ['Invalid'] } }, 422);
      expect(hasFieldErrors(errorWithFields)).toBe(true);

      const errorWithoutFields = parseApiError({ message: 'Error' }, 400);
      expect(hasFieldErrors(errorWithoutFields)).toBe(false);
    });
  });
});
