import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../shared/database/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import {
  ApiKeyAuthContext,
  ApiKeyPublic,
  ApiKeyRateLimitInfo,
  ApiKeyValidationResult,
} from './interfaces/api-key.interface';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

type ApiKeyEntity = {
  id: string;
  name: string;
  key: string;
  prefix: string;
  companyId: string;
  createdBy: string;
  permissions: string[];
  lastUsedAt: Date | null;
  requestCount: number;
  expiresAt: Date | null;
  rateLimit: number;
  ipWhitelist: string[];
  isActive: boolean;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RateLimitWindow = {
  windowStartMs: number;
  count: number;
};

type ApiKeyRequestMetadata = {
  ipAddress?: string;
};

@Injectable()
export class ApiKeyService {
  private readonly rateLimitWindows = new Map<string, RateLimitWindow>();
  private readonly keyPrefixLength = 12;
  private readonly adminRoles = new Set(['admin', 'owner', 'super_admin']);

  constructor(private readonly prisma: PrismaService) {}

  private get apiKeyRepo() {
    return (this.prisma as any).apiKey;
  }

  async create(dto: CreateApiKeyDto, actor: JwtPayload) {
    this.assertAdmin(actor);

    const generated = this.generateApiKey(dto.environment ?? 'live');
    const now = new Date();

    const created = (await this.apiKeyRepo.create({
      data: {
        name: dto.name,
        key: this.hashKey(generated.key),
        prefix: generated.key.slice(0, this.keyPrefixLength),
        companyId: actor.companyId,
        createdBy: actor.sub,
        permissions: dto.permissions ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        rateLimit: dto.rateLimit ?? 100,
        ipWhitelist: this.normalizeIpWhitelist(dto.ipWhitelist),
        isActive: true,
        createdAt: now,
      },
    })) as ApiKeyEntity;

    return {
      apiKey: this.toPublic(created),
      secret: generated.key,
    };
  }

  async list(actor: JwtPayload): Promise<ApiKeyPublic[]> {
    this.assertAdmin(actor);

    const records = (await this.apiKeyRepo.findMany({
      where: { companyId: actor.companyId },
      orderBy: { createdAt: 'desc' },
    })) as ApiKeyEntity[];

    return records.map((record) => this.toPublic(record));
  }

  async getById(id: string, actor: JwtPayload): Promise<ApiKeyPublic> {
    this.assertAdmin(actor);
    const record = await this.findCompanyKeyOrThrow(id, actor.companyId);
    return this.toPublic(record);
  }

  async update(
    id: string,
    dto: UpdateApiKeyDto,
    actor: JwtPayload,
  ): Promise<ApiKeyPublic> {
    this.assertAdmin(actor);
    await this.findCompanyKeyOrThrow(id, actor.companyId);

    const updated = (await this.apiKeyRepo.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.permissions !== undefined
          ? { permissions: dto.permissions }
          : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: new Date(dto.expiresAt) }
          : {}),
        ...(dto.rateLimit !== undefined ? { rateLimit: dto.rateLimit } : {}),
        ...(dto.ipWhitelist !== undefined
          ? { ipWhitelist: this.normalizeIpWhitelist(dto.ipWhitelist) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    })) as ApiKeyEntity;

    return this.toPublic(updated);
  }

  async revoke(
    id: string,
    actor: JwtPayload,
    reason?: string,
  ): Promise<ApiKeyPublic> {
    this.assertAdmin(actor);
    await this.findCompanyKeyOrThrow(id, actor.companyId);

    const updated = (await this.apiKeyRepo.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason?.trim() || 'Revoked by administrator',
      },
    })) as ApiKeyEntity;
    this.rateLimitWindows.delete(id);

    return this.toPublic(updated);
  }

  async rotate(id: string, actor: JwtPayload) {
    this.assertAdmin(actor);
    const existing = await this.findCompanyKeyOrThrow(id, actor.companyId);

    if (!existing.isActive || existing.revokedAt) {
      throw new BadApiKeyStateException(
        'Cannot rotate a revoked or inactive key',
      );
    }

    const environment = existing.prefix.startsWith('sk_test_')
      ? 'test'
      : 'live';
    const generated = this.generateApiKey(environment);
    const updated = (await this.apiKeyRepo.update({
      where: { id },
      data: {
        key: this.hashKey(generated.key),
        prefix: generated.key.slice(0, this.keyPrefixLength),
        revokedAt: null,
        revokedReason: null,
      },
    })) as ApiKeyEntity;
    this.rateLimitWindows.delete(id);

    return {
      apiKey: this.toPublic(updated),
      secret: generated.key,
    };
  }

  async getUsage(id: string, actor: JwtPayload) {
    this.assertAdmin(actor);
    const record = await this.findCompanyKeyOrThrow(id, actor.companyId);

    return {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      requestCount: record.requestCount,
      lastUsedAt: record.lastUsedAt,
      rateLimit: record.rateLimit,
      isActive: record.isActive,
      expiresAt: record.expiresAt,
      isExpired: this.isExpired(record.expiresAt),
      revokedAt: record.revokedAt,
    };
  }

  async authenticate(
    rawKey: string,
    metadata: ApiKeyRequestMetadata,
    requiredPermissions: string[] = [],
  ): Promise<ApiKeyValidationResult> {
    const hashed = this.hashKey(rawKey);

    const record = (await this.apiKeyRepo.findFirst({
      where: { key: hashed },
    })) as ApiKeyEntity | null;

    if (!record) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!record.isActive || record.revokedAt) {
      throw new UnauthorizedException('API key revoked');
    }

    if (this.isExpired(record.expiresAt)) {
      throw new UnauthorizedException('API key expired');
    }

    this.validateIpWhitelist(record, metadata.ipAddress);

    if (requiredPermissions.length > 0) {
      const missingPermissions = requiredPermissions.filter(
        (permission) => !record.permissions.includes(permission),
      );

      if (missingPermissions.length > 0) {
        throw new ForbiddenException('API key lacks required permissions');
      }
    }

    const rateLimit = this.consumeRateLimit(record.id, record.rateLimit);

    await this.apiKeyRepo.update({
      where: { id: record.id },
      data: {
        lastUsedAt: new Date(),
        requestCount: { increment: 1 },
      },
    });

    return {
      apiKey: this.toAuthContext(record),
      rateLimit,
    };
  }

  private async findCompanyKeyOrThrow(
    id: string,
    companyId: string,
  ): Promise<ApiKeyEntity> {
    const record = (await this.apiKeyRepo.findFirst({
      where: { id, companyId },
    })) as ApiKeyEntity | null;

    if (!record) {
      throw new NotFoundException('API key not found');
    }

    return record;
  }

  private assertAdmin(user: JwtPayload) {
    if (!this.adminRoles.has(user.role)) {
      throw new ForbiddenException('Admin access required');
    }
  }

  private generateApiKey(environment: 'live' | 'test') {
    const envPrefix = environment === 'test' ? 'sk_test_' : 'sk_live_';
    const randomPart = randomBytes(24).toString('base64url');
    const key = `${envPrefix}${randomPart}`;

    if (key.length < 32) {
      return this.generateApiKey(environment);
    }

    return { key };
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private normalizeIpWhitelist(ipWhitelist?: string[]): string[] {
    if (!ipWhitelist) {
      return [];
    }

    return ipWhitelist.map((ip) => ip.trim()).filter(Boolean);
  }

  private validateIpWhitelist(record: ApiKeyEntity, ipAddress?: string) {
    if (!record.ipWhitelist || record.ipWhitelist.length === 0) {
      return;
    }

    if (!ipAddress) {
      throw new UnauthorizedException('IP address required for API key');
    }

    const normalizedIp = ipAddress.trim();
    const allowed = record.ipWhitelist.some(
      (allowedIp) => allowedIp === normalizedIp,
    );

    if (!allowed) {
      throw new UnauthorizedException('IP address not allowed');
    }
  }

  private consumeRateLimit(keyId: string, limit: number): ApiKeyRateLimitInfo {
    const now = Date.now();
    const windowMs = 60_000;
    const current = this.rateLimitWindows.get(keyId);

    let state: RateLimitWindow;
    if (!current || now - current.windowStartMs >= windowMs) {
      state = { windowStartMs: now, count: 0 };
    } else {
      state = current;
    }

    if (state.count >= limit) {
      const reset = Math.ceil((state.windowStartMs + windowMs) / 1000);
      throw new HttpException(
        {
          message: 'API key rate limit exceeded',
          rateLimit: {
            limit,
            remaining: 0,
            reset,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    state.count += 1;
    this.rateLimitWindows.set(keyId, state);

    const remaining = Math.max(limit - state.count, 0);
    const reset = Math.ceil((state.windowStartMs + windowMs) / 1000);

    return { limit, remaining, reset };
  }

  private toPublic(record: ApiKeyEntity): ApiKeyPublic {
    return {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      companyId: record.companyId,
      createdBy: record.createdBy,
      permissions: record.permissions ?? [],
      lastUsedAt: record.lastUsedAt ?? null,
      requestCount: record.requestCount ?? 0,
      expiresAt: record.expiresAt ?? null,
      rateLimit: record.rateLimit,
      ipWhitelist: record.ipWhitelist ?? [],
      isActive: record.isActive,
      revokedAt: record.revokedAt ?? null,
      revokedReason: record.revokedReason ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      isExpired: this.isExpired(record.expiresAt),
    };
  }

  private toAuthContext(record: ApiKeyEntity): ApiKeyAuthContext {
    return {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      companyId: record.companyId,
      createdBy: record.createdBy,
      permissions: record.permissions ?? [],
      rateLimit: record.rateLimit,
      ipWhitelist: record.ipWhitelist ?? [],
    };
  }

  private isExpired(expiresAt?: Date | null): boolean {
    return !!expiresAt && expiresAt.getTime() <= Date.now();
  }
}

class BadApiKeyStateException extends ForbiddenException {
  constructor(message: string) {
    super(message);
  }
}
