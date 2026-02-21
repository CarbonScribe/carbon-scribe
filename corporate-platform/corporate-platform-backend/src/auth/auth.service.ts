import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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

interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

interface BruteForceState {
  count: number;
  lockUntil?: Date;
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
  private readonly loginAttempts = new Map<string, BruteForceState>();
  private readonly maxAttempts = 5;
  private readonly lockMinutes = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(
    dto: RegisterDto,
    metadata: RequestMetadata,
  ): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
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

    return {
      user: this.toAuthUser(user),
      accessToken,
      refreshToken,
    };
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
    this.ensureNotLocked(dto.email);

    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      this.registerFailedAttempt(dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.clearFailedAttempts(dto.email);

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

    return {
      user: this.toAuthUser(user),
      accessToken,
      refreshToken,
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponse> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || !session.isValid) {
      throw new UnauthorizedException('Invalid session');
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    const matches = await bcrypt.compare(
      dto.refreshToken,
      session.refreshToken,
    );
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found');
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
      throw new UnauthorizedException('Invalid refresh token');
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
      throw new NotFoundException('User not found');
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.password);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
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

    return { success: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
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
      throw new BadRequestException('Invalid or expired reset token');
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

  private ensureNotLocked(email: string) {
    const state = this.loginAttempts.get(email);
    if (!state || !state.lockUntil) {
      return;
    }
    if (state.lockUntil > new Date()) {
      throw new UnauthorizedException(
        'Too many failed attempts, please try again later',
      );
    }
    this.loginAttempts.delete(email);
  }

  private registerFailedAttempt(email: string) {
    const state = this.loginAttempts.get(email) || { count: 0 };
    state.count += 1;
    if (state.count >= this.maxAttempts) {
      state.lockUntil = new Date(Date.now() + this.lockMinutes * 60 * 1000);
    }
    this.loginAttempts.set(email, state);
  }

  private clearFailedAttempts(email: string) {
    this.loginAttempts.delete(email);
  }
}
