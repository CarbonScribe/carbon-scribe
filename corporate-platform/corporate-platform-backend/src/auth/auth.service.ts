import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../shared/database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponse, AuthUser } from './interfaces/auth-result.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { randomBytes } from 'crypto';
import { SecurityService } from '../security/security.service';
import { SecurityEvents } from '../security/constants/security-events.constants';
import {
  InvalidCredentialsError,
  UserNotFoundError,
  InvalidRefreshTokenError,
  SessionExpiredError,
  EmailAlreadyInUseError,
  ValidationError,
  AccountInactiveError,
} from '../shared/exceptions/error-classes';

interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

type User = {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  isActive: boolean;
};

@Injectable()
export class AuthService {
  // ============================================================================
  // REMOVED: In-memory brute force protection (loginAttempts Map, maxAttempts,
  // lockMinutes, ensureNotLocked, registerFailedAttempt, clearFailedAttempts)
  //
  // REPLACED BY: Redis-backed RateLimitGuard with distributed rate limiting
  // - Login: 5 attempts per 15 minutes per IP + email
  // - Register: 3 attempts per hour per IP
  // - Forgot password: 3 attempts per hour per IP + email
  // - Reset password: 3 attempts per hour per IP + token
  // ============================================================================

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly securityService: SecurityService,
  ) {}

  async register(
    dto: RegisterDto,
    metadata: RequestMetadata,
  ): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new EmailAlreadyInUseError(dto.email);
    }

    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
      },
    });

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        companyId: company.id,
        role: 'viewer',
      },
    });

    const session = await this.createSession(user.id, metadata);
    const { accessToken, refreshToken } = this.generateTokens(user, session.id);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: session.id },
        data: {
          refreshToken: hashedRefreshToken,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken: hashedRefreshToken,
          lastLoginAt: new Date(),
          lastLoginIp: metadata.ipAddress,
        },
      }),
    ]);

    const response: AuthResponse = {
      user: this.toAuthUser(user),
      accessToken,
      refreshToken,
    };

    await this.securityService.logEvent({
      eventType: SecurityEvents.UserCreated,
      companyId: user.companyId,
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      resource: '/api/v1/auth/register',
      method: 'POST',
      status: 'success',
      statusCode: 201,
    });

    return response;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return null;
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return null;
    }

    return user;
  }

  async login(dto: LoginDto, metadata: RequestMetadata): Promise<AuthResponse> {
    // Rate limiting is now handled by RateLimitGuard
    // No in-memory brute force protection here

    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      await this.securityService.logEvent({
        eventType: SecurityEvents.AuthLoginFailed,
        companyId: undefined,
        userId: undefined,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        resource: '/api/v1/auth/login',
        method: 'POST',
        status: 'failure',
        statusCode: 401,
      });
      throw new InvalidCredentialsError();
    }

    const session = await this.createSession(user.id, metadata);
    const { accessToken, refreshToken } = this.generateTokens(user, session.id);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: session.id },
        data: {
          refreshToken: hashedRefreshToken,
          lastUsedAt: new Date(),
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken: hashedRefreshToken,
          lastLoginAt: new Date(),
          lastLoginIp: metadata.ipAddress,
        },
      }),
    ]);

    const response: AuthResponse = {
      user: this.toAuthUser(user),
      accessToken,
      refreshToken,
    };

    await this.securityService.logEvent({
      eventType: SecurityEvents.AuthLoginSuccess,
      companyId: user.companyId,
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      resource: '/api/v1/auth/login',
      method: 'POST',
      status: 'success',
      statusCode: 200,
    });

    return response;
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponse> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken);
    } catch {
      throw new InvalidRefreshTokenError();
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || !session.isValid) {
      throw new InvalidRefreshTokenError();
    }

    if (session.expiresAt <= new Date()) {
      throw new SessionExpiredError();
    }

    const matches = await bcrypt.compare(
      dto.refreshToken,
      session.refreshToken,
    );
    if (!matches) {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UserNotFoundError(payload.sub);
    }

    if (!user.isActive) {
      throw new AccountInactiveError();
    }

    const { accessToken, refreshToken } = this.generateTokens(user, session.id);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: session.id },
        data: {
          refreshToken: hashedRefreshToken,
          lastUsedAt: new Date(),
          expiresAt: this.computeRefreshExpiry(),
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken: hashedRefreshToken,
        },
      }),
    ]);

    return {
      user: this.toAuthUser(user),
      accessToken,
      refreshToken,
    };
  }

  async logout(dto: RefreshTokenDto): Promise<{ success: boolean }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken);
    } catch {
      throw new InvalidRefreshTokenError();
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session) {
      return { success: true };
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        isValid: false,
      },
    });

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: {
        refreshToken: null,
      },
    });

    await this.securityService.logEvent({
      eventType: SecurityEvents.AuthLogout,
      companyId: payload.companyId,
      userId: payload.sub,
      status: 'success',
      statusCode: 200,
    });

    return { success: true };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.password);
    if (!matches) {
      throw new InvalidCredentialsError();
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: newHash,
          refreshToken: null,
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id },
        data: {
          isValid: false,
        },
      }),
    ]);

    await this.securityService.logEvent({
      eventType: SecurityEvents.AuthPasswordChange,
      companyId: user.companyId,
      userId: user.id,
      status: 'success',
      statusCode: 200,
    });

    return { success: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UserNotFoundError(userId);
    }
    return this.toAuthUser(user);
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, isValid: true },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      expiresAt: session.expiresAt,
      isValid: session.isValid,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
    }));
  }

  async terminateSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isValid: false,
      },
    });

    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      return {
        message:
          'If an account exists for this email, a reset link has been sent',
      };
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    await this.securityService.logEvent({
      eventType: SecurityEvents.AuthPasswordReset,
      companyId: user.companyId,
      userId: user.id,
      status: 'success',
      statusCode: 200,
    });

    return {
      message:
        'If an account exists for this email, a reset link has been sent',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: newHash,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id },
        data: {
          isValid: false,
        },
      }),
    ]);

    await this.securityService.logEvent({
      eventType: SecurityEvents.AuthPasswordChange,
      companyId: user.companyId,
      userId: user.id,
      status: 'success',
      statusCode: 200,
    });

    return { success: true };
  }

  private generateTokens(user: User, sessionId: string) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
      sessionId,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return { accessToken, refreshToken, payload };
  }

  private computeRefreshExpiry() {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  private async createSession(userId: string, metadata: RequestMetadata) {
    return this.prisma.session.create({
      data: {
        userId,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        refreshToken: '',
        expiresAt: this.computeRefreshExpiry(),
      },
    });
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      companyId: user.companyId,
    };
  }
}
