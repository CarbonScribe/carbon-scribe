const fs = require('fs');
const content = fs.readFileSync('src/auth/auth.service.ts', 'utf8');

const newRefresh = \  async refresh(
    dto: RefreshTokenDto,
    metadata?: RequestMetadata,
  ): Promise<AuthResponse> {
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

    if (session.lockedUntil && session.lockedUntil > new Date()) {
      throw new SessionLockedError();
    }

    if (session.expiresAt <= new Date()) {
      throw new SessionExpiredError();
    }

    // Context mismatch check
    if (
      metadata &&
      (metadata.ipAddress !== session.ipAddress ||
        metadata.userAgent !== session.userAgent)
    ) {
      await this.securityService.logEvent({
        eventType: SecurityEvents.SuspiciousPatternDetected,
        companyId: payload.companyId,
        userId: payload.sub,
        status: 'warning',
        statusCode: 401,
      });
      // Optionally block or just flag. We just flagged it.
    }

    const isCurrentMatch = await bcrypt.compare(
      dto.refreshToken,
      session.refreshToken,
    );

    let isPreviousMatch = false;
    if (!isCurrentMatch && session.previousRefreshToken) {
      isPreviousMatch = await bcrypt.compare(
        dto.refreshToken,
        session.previousRefreshToken,
      );
    }

    if (isPreviousMatch) {
      // Reuse detected!
      await this.prisma.session.update({
        where: { id: session.id },
        data: { isValid: false },
      });

      // Optionally invalidate all sessions
      await this.prisma.session.updateMany({
        where: { userId: session.userId },
        data: { isValid: false },
      });

      await this.securityService.logEvent({
        eventType: SecurityEvents.AuthRefreshTokenReuse,
        companyId: payload.companyId,
        userId: payload.sub,
        status: 'failure',
        statusCode: 401,
      });

      throw new RefreshTokenReuseError();
    }

    if (!isCurrentMatch) {
      // Increment failed attempts
      const failedAttempts = session.failedAttempts + 1;
      const lockedUntil =
        failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await this.prisma.session.update({
        where: { id: session.id },
        data: { failedAttempts, lockedUntil },
      });

      await this.securityService.logEvent({
        eventType: SecurityEvents.AuthRefreshFailed,
        companyId: payload.companyId,
        userId: payload.sub,
        status: 'failure',
        statusCode: 401,
      });

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

    await this.prisma.\([
      this.prisma.session.update({
        where: { id: session.id },
        data: {
          previousRefreshToken: session.refreshToken,
          refreshToken: hashedRefreshToken,
          lastUsedAt: new Date(),
          expiresAt: this.computeRefreshExpiry(session.createdAt),
          failedAttempts: 0,
          lockedUntil: null,
          deviceId: metadata?.deviceId || session.deviceId,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken: hashedRefreshToken,
        },
      }),
    ]);

    await this.securityService.logEvent({
      eventType: SecurityEvents.AuthRefreshSuccess,
      companyId: payload.companyId,
      userId: payload.sub,
      status: 'success',
      statusCode: 200,
    });

    return {
      user: this.toAuthUser(user),
      accessToken,
      refreshToken,
    };
  }\;

const replaced = content.replace(/  async refresh\(dto: RefreshTokenDto\): Promise<AuthResponse> \{[\s\S]*?    return \{\n      user: this\.toAuthUser\(user\),\n      accessToken,\n      refreshToken,\n    \};\n  \}/, newRefresh);

fs.writeFileSync('src/auth/auth.service.ts', replaced);
