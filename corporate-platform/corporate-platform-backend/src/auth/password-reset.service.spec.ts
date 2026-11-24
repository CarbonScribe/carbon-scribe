import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../shared/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { SecurityService } from '../security/security.service';
import { ConfigService } from '../config/config.service';
import { MailService } from '../mail/mail.service';
import { ValidationError } from '../shared/exceptions/error-classes';
import { SecurityEvents } from '../security/constants/security-events.constants';
import { hashResetToken } from './password-reset-token';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService password reset (#810)', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    session: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let security: { logEvent: jest.Mock };
  let configService: { get: jest.Mock };
  let mailService: { sendPasswordResetEmail: jest.Mock };

  const user = {
    id: 'user-1',
    email: 'user@example.com',
    companyId: 'company-1',
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      session: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    security = { logEvent: jest.fn() };
    configService = {
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
    };
    mailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { verify: jest.fn(), sign: jest.fn() },
        },
        { provide: SecurityService, useValue: security },
        { provide: ConfigService, useValue: configService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
  });

  describe('forgotPassword', () => {
    it('stores a hash of the token, never the raw value', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await service.forgotPassword({ email: user.email });

      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.passwordResetToken).toHaveLength(64); // sha256 hex digest
      expect(data.passwordResetToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it('emails a working reset link containing the raw (unhashed) token', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      configService.get.mockImplementation(
        (key: string, defaultValue: unknown) =>
          key === 'FRONTEND_URL' ? 'https://app.example.com' : defaultValue,
      );

      await service.forgotPassword({ email: user.email });

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const [to, link] = mailService.sendPasswordResetEmail.mock.calls[0];
      expect(to).toBe(user.email);
      expect(link).toMatch(
        /^https:\/\/app\.example\.com\/reset-password\?token=[0-9a-f]{64}$/,
      );

      const storedHash =
        prisma.user.update.mock.calls[0][0].data.passwordResetToken;
      const rawToken = new URL(link).searchParams.get('token')!;
      expect(hashResetToken(rawToken)).toBe(storedHash);
    });

    it('respects the configured TTL', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      configService.get.mockImplementation(
        (key: string, defaultValue: unknown) =>
          key === 'PASSWORD_RESET_TTL_MINUTES' ? 5 : defaultValue,
      );
      const before = Date.now();

      await service.forgotPassword({ email: user.email });

      const expires: Date =
        prisma.user.update.mock.calls[0][0].data.passwordResetExpires;
      const deltaMs = expires.getTime() - before;
      expect(deltaMs).toBeGreaterThan(4 * 60 * 1000);
      expect(deltaMs).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
    });

    it('still returns the neutral message and logs a failure event when the email fails to send', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      mailService.sendPasswordResetEmail.mockRejectedValue(
        new Error('SMTP down'),
      );

      const result = await service.forgotPassword({ email: user.email });

      expect(result).toEqual({
        message:
          'If an account exists for this email, a reset link has been sent',
      });
      expect(security.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEvents.AuthPasswordResetFailed,
          userId: user.id,
          details: { reason: 'email_send_failed' },
        }),
      );
    });

    it('returns the same neutral message for an unknown email, without storing a token or sending mail', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'nobody@example.com',
      });

      expect(result).toEqual({
        message:
          'If an account exists for this email, a reset link has been sent',
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('looks up the user by the hash of the supplied token, not the raw token', async () => {
      prisma.user.findFirst.mockResolvedValue(user);
      const rawToken = 'a'.repeat(64);

      await service.resetPassword({
        token: rawToken,
        newPassword: 'Str0ng!Pass',
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            passwordResetToken: hashResetToken(rawToken),
          }),
        }),
      );
    });

    it('rejects an invalid or expired token and logs a security event', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'bad-token',
          newPassword: 'Str0ng!Pass',
        }),
      ).rejects.toThrow(ValidationError);

      expect(security.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: SecurityEvents.AuthPasswordResetFailed,
          details: { reason: 'invalid_or_expired_token' },
        }),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('is single use — clears the token and expiry on success', async () => {
      prisma.user.findFirst.mockResolvedValue(user);

      await service.resetPassword({
        token: 'good-token',
        newPassword: 'Str0ng!Pass',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: expect.objectContaining({
            passwordResetToken: null,
            passwordResetExpires: null,
          }),
        }),
      );
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: user.id },
        data: { isValid: false },
      });
    });

    it('hashes the new password with the shared bcrypt cost', async () => {
      prisma.user.findFirst.mockResolvedValue(user);
      process.env.PASSWORD_HASH_COST = '12';

      await service.resetPassword({
        token: 'good-token',
        newPassword: 'Str0ng!Pass',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('Str0ng!Pass', 12);
      delete process.env.PASSWORD_HASH_COST;
    });
  });
});
