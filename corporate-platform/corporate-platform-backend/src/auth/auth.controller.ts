import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import {
  LoginRateLimit,
  RegisterRateLimit,
  RefreshRateLimit,
  ForgotPasswordRateLimit,
  ResetPasswordRateLimit,
  ChangePasswordRateLimit,
  MeRateLimit,
  SessionsRateLimit,
  TerminateSessionRateLimit,
} from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   * Rate limit: 3 attempts per hour per IP
   */
  @Post('register')
  @UseGuards(RateLimitGuard)
  @RegisterRateLimit()
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.getMetadata(req));
  }

  /**
   * Login user
   * Rate limit: 5 attempts per 15 minutes per IP + email
   */
  @UseGuards(LocalAuthGuard, RateLimitGuard)
  @LoginRateLimit()
  @Post('login')
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    return this.authService.login(dto, this.getMetadata(req));
  }

  /**
   * Refresh access token
   * Rate limit: 10 attempts per hour
   */
  @Post('refresh')
  @UseGuards(RateLimitGuard)
  @RefreshRateLimit()
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  /**
   * Logout user
   * Rate limit: 10 attempts per hour (no rate limit needed but keep consistent)
   */
  @Post('logout')
  @UseGuards(RateLimitGuard)
  @RefreshRateLimit()
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  /**
   * Change password
   * Rate limit: 5 attempts per hour (authenticated)
   */
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @ChangePasswordRateLimit()
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto);
  }

  /**
   * Forgot password
   * Rate limit: 3 attempts per hour per IP + email
   */
  @Post('forgot-password')
  @UseGuards(RateLimitGuard)
  @ForgotPasswordRateLimit()
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * Reset password
   * Rate limit: 3 attempts per hour per IP + token
   */
  @Post('reset-password')
  @UseGuards(RateLimitGuard)
  @ResetPasswordRateLimit()
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * Get current user profile
   * Rate limit: 30 attempts per minute (authenticated)
   */
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @MeRateLimit()
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    return { user: await this.authService.me(user.sub) };
  }

  /**
   * List user sessions
   * Rate limit: 10 attempts per minute (authenticated)
   */
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @SessionsRateLimit()
  @Get('sessions')
  async sessions(@CurrentUser() user: JwtPayload) {
    return this.authService.listSessions(user.sub);
  }

  /**
   * Terminate a session
   * Rate limit: 5 attempts per minute (authenticated)
   */
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @TerminateSessionRateLimit()
  @Delete('sessions/:id')
  async terminateSession(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const sessionId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    return this.authService.terminateSession(user.sub, sessionId);
  }

  private getMetadata(req: Request) {
    return {
      ipAddress:
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        undefined,
      userAgent: req.headers['user-agent'],
    };
  }
}
