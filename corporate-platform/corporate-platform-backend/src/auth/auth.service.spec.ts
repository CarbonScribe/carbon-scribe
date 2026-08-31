import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../shared/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { SecurityService } from '../security/security.service';
import * as bcrypt from 'bcrypt';
import {
  InvalidRefreshTokenError,
  RefreshTokenReuseError,
  SessionLockedError,
} from '../shared/exceptions/error-classes';
import { SecurityEvents } from '../security/constants/security-events.constants';

jest.mock('bcrypt');

describe('AuthService Refresh Token Reuse', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwt: jest.Mocked<JwtService>;
  let security: jest.Mocked<SecurityService>;

  beforeEach(async () => {
    const prismaMock = {
      session: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    const jwtMock = {
      verify: jest.fn(),
      sign: jest.fn(),
    };

    const securityMock = {
      logEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: SecurityService, useValue: securityMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);
    security = module.get(SecurityService);
  });

  it('should detect reuse and invalidate sessions', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sessionId: 'session-1', sub: 'user-1' });

    (prisma.session.findUnique as jest.Mock).mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      isValid: true,
      expiresAt: new Date(Date.now() + 10000),
      refreshToken: 'current-hash',
      previousRefreshToken: 'old-hash',
      lockedUntil: null,
      failedAttempts: 0,
    } as any);

    (bcrypt.compare as jest.Mock)
      .mockResolvedValueOnce(false) // current does not match
      .mockResolvedValueOnce(true); // previous DOES match

    await expect(
      service.refresh({ refreshToken: 'old-token' }),
    ).rejects.toThrow(RefreshTokenReuseError);

    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { isValid: false },
    });

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { isValid: false },
    });

    expect(security.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityEvents.AuthRefreshTokenReuse,
      }),
    );
  });

  it('should lock session after 5 failed attempts', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sessionId: 'session-1', sub: 'user-1' });

    (prisma.session.findUnique as jest.Mock).mockResolvedValue({
      id: 'session-1',
      isValid: true,
      expiresAt: new Date(Date.now() + 10000),
      refreshToken: 'current-hash',
      previousRefreshToken: 'old-hash',
      lockedUntil: null,
      failedAttempts: 4, // Next failure makes it 5
    } as any);

    (bcrypt.compare as jest.Mock).mockResolvedValue(false); // neither matches

    await expect(
      service.refresh({ refreshToken: 'bad-token' }),
    ).rejects.toThrow(InvalidRefreshTokenError);

    expect(prisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          failedAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      }),
    );
  });

  it('should reject locked sessions', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sessionId: 'session-1', sub: 'user-1' });

    (prisma.session.findUnique as jest.Mock).mockResolvedValue({
      id: 'session-1',
      isValid: true,
      expiresAt: new Date(Date.now() + 10000),
      lockedUntil: new Date(Date.now() + 10000), // currently locked
    } as any);

    await expect(
      service.refresh({ refreshToken: 'any-token' }),
    ).rejects.toThrow(SessionLockedError);
  });
});