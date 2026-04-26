import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';
import { CheckComplianceDto } from './dto/check-compliance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import {
  COMPLIANCE_SUBMIT,
  COMPLIANCE_VIEW,
  COMPLIANCE_AUDIT,
} from '../rbac/constants/permissions.constants';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';
import { SecurityService } from '../security/security.service';
import { SecurityEvents } from '../security/constants/security-events.constants';
import {
  VerifyRetirementDto,
  ComplianceFramework,
} from './dto/retirement-verification.dto';

@ApiTags('Compliance - Retirement Verification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, IpWhitelistGuard)
@Controller('api/v1/compliance')
export class ComplianceController {
  constructor(
    private complianceService: ComplianceService,
    private securityService: SecurityService,
  ) {}

  /**
   * Run compliance checks on a transaction or credit
   * POST /api/v1/compliance/check
   */
  @Post('check')
  @Permissions(COMPLIANCE_SUBMIT)
  async checkCompliance(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CheckComplianceDto,
  ) {
    if (!dto.framework || !dto.entityType || !dto.entityId) {
      throw new BadRequestException(
        'framework, entityType, and entityId are required',
      );
    }

    const result = await this.complianceService.checkCompliance(
      user.companyId,
      dto,
    );

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId: user.companyId,
      userId: user.sub,
      resource: `/api/v1/compliance/check`,
      method: 'POST',
      status: 'success',
      statusCode: 200,
      details: {
        framework: dto.framework,
        entityType: dto.entityType,
        entityId: dto.entityId,
      },
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  /**
   * Get compliance status for an entity
   * GET /api/v1/compliance/status/:entityId
   */
  @Get('status/:entityId')
  @Permissions(COMPLIANCE_VIEW)
  async getComplianceStatus(
    @CurrentUser() user: JwtPayload,
    @Param('entityId') entityId: string,
  ) {
    if (!entityId) {
      throw new BadRequestException('entityId is required');
    }

    const result = await this.complianceService.getComplianceStatus(
      user.companyId,
      entityId,
    );

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId: user.companyId,
      userId: user.sub,
      resource: `/api/v1/compliance/status/${entityId}`,
      method: 'GET',
      status: 'success',
      statusCode: 200,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  /**
   * Generate or retrieve compliance report for an entity
   * GET /api/v1/compliance/report/:entityId
   */
  @Get('report/:entityId')
  @Permissions(COMPLIANCE_VIEW)
  async getComplianceReport(
    @CurrentUser() user: JwtPayload,
    @Param('entityId') entityId: string,
  ) {
    if (!entityId) {
      throw new BadRequestException('entityId is required');
    }

    const result = await this.complianceService.getComplianceReport(
      user.companyId,
      entityId,
    );

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId: user.companyId,
      userId: user.sub,
      resource: `/api/v1/compliance/report/${entityId}`,
      method: 'GET',
      status: 'success',
      statusCode: 200,
      details: {
        reportId: result.reportId,
        frameworks: result.frameworks,
      },
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  @Post('verify-retirement')
  @Permissions(COMPLIANCE_VIEW)
  @ApiOperation({
    summary: 'Verify retirement status for a batch of token IDs',
    description:
      'Validates on-chain retirement status for a list of carbon credit tokens before offset claims. Prevents double-counting by checking each token against the Soroban Retirement Tracker contract.',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification results returned successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input — at least one token required',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async verifyRetirement(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VerifyRetirementDto,
  ) {
    if (!dto.tokens || dto.tokens.length === 0) {
      throw new BadRequestException('At least one token must be provided');
    }

    const result = await this.complianceService.verifyRetirementsForCompliance(
      user.companyId,
      dto,
    );

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId: user.companyId,
      userId: user.sub,
      resource: '/api/v1/compliance/verify-retirement',
      method: 'POST',
      status: result.verified ? 'success' : 'warning',
      statusCode: 200,
      details: {
        totalTokens: result.totalTokens,
        verifiedTokens: result.verifiedTokens,
        claimedTokens: result.claimedTokens,
        framework: dto.framework,
      },
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  @Get('retirement-status/:tokenId')
  @Permissions(COMPLIANCE_VIEW)
  @ApiOperation({
    summary: 'Check retirement and claim status for a single token',
    description:
      'Returns the full retirement status for a specific token including on-chain verification, claim history, and audit trail.',
  })
  @ApiParam({ name: 'tokenId', description: 'Token ID to check' })
  @ApiQuery({
    name: 'framework',
    enum: ComplianceFramework,
    required: false,
    description: 'Filter claims by compliance framework',
  })
  @ApiResponse({ status: 200, description: 'Retirement status returned' })
  @ApiResponse({ status: 404, description: 'Token not found' })
  async getRetirementStatus(
    @CurrentUser() user: JwtPayload,
    @Param('tokenId') tokenId: string,
    @Query('framework') framework?: ComplianceFramework,
  ) {
    if (!tokenId) {
      throw new BadRequestException('tokenId is required');
    }

    const result = await this.complianceService.getRetirementStatus(
      user.companyId,
      tokenId,
      framework,
    );

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId: user.companyId,
      userId: user.sub,
      resource: `/api/v1/compliance/retirement-status/${tokenId}`,
      method: 'GET',
      status: 'success',
      statusCode: 200,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  @Post('double-claim-check')
  @Permissions(COMPLIANCE_AUDIT)
  @ApiOperation({
    summary: 'Check double-claim risk for a list of tokens',
    description:
      'Assesses the risk that the given tokens have already been claimed under the specified compliance framework. Returns LOW, MEDIUM, or HIGH risk level with a list of at-risk token IDs.',
  })
  @ApiResponse({ status: 200, description: 'Risk assessment completed' })
  @ApiResponse({ status: 400, description: 'Missing tokenIds or framework' })
  async checkDoubleClaimRisk(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      tokenIds: string[];
      framework: ComplianceFramework;
    },
  ) {
    if (!body.tokenIds || body.tokenIds.length === 0) {
      throw new BadRequestException('At least one tokenId must be provided');
    }

    if (!body.framework) {
      throw new BadRequestException('framework is required');
    }

    const result = await this.complianceService.checkDoubleClaimRisk(
      user.companyId,
      body.tokenIds,
      body.framework,
    );

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId: user.companyId,
      userId: user.sub,
      resource: '/api/v1/compliance/double-claim-check',
      method: 'POST',
      status: result.riskLevel === 'LOW' ? 'success' : 'warning',
      statusCode: 200,
      details: {
        riskLevel: result.riskLevel,
        atRiskTokens: result.atRiskTokens,
        framework: body.framework,
      },
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  @Post('validate-tokens')
  @Permissions(COMPLIANCE_SUBMIT)
  @ApiOperation({
    summary: 'Validate tokens for compliance use',
    description:
      'Validates that each token is properly retired on-chain, not already claimed under the specified framework, and has sufficient remaining amount. Returns per-token validation results.',
  })
  @ApiResponse({ status: 200, description: 'Validation results returned' })
  @ApiResponse({ status: 400, description: 'Missing tokenIds or framework' })
  async validateTokens(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      tokenIds: string[];
      framework: ComplianceFramework;
      requiredAmounts?: Record<string, number>;
    },
  ) {
    if (!body.tokenIds || body.tokenIds.length === 0) {
      throw new BadRequestException('At least one tokenId must be provided');
    }

    if (!body.framework) {
      throw new BadRequestException('framework is required');
    }

    const result = await this.complianceService.validateTokensForCompliance(
      user.companyId,
      body.tokenIds,
      body.framework,
      body.requiredAmounts,
    );

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId: user.companyId,
      userId: user.sub,
      resource: '/api/v1/compliance/validate-tokens',
      method: 'POST',
      status: result.valid ? 'success' : 'warning',
      statusCode: 200,
      details: {
        framework: body.framework,
        totalTokens: body.tokenIds.length,
        validTokens: result.results.filter((r) => r.valid).length,
      },
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  @Get('verification-history')
  @Permissions(COMPLIANCE_AUDIT)
  @ApiOperation({
    summary: 'Query retirement verification audit history',
    description:
      'Retrieves an immutable audit trail of all retirement verification calls made against the Soroban Retirement Tracker contract. Supports pagination and filtering by token ID or framework.',
  })
  @ApiQuery({
    name: 'tokenId',
    required: false,
    description: 'Filter by token ID',
  })
  @ApiQuery({
    name: 'framework',
    enum: ComplianceFramework,
    required: false,
    description: 'Filter by compliance framework',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max results (default 50, max 100)',
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Pagination offset',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'Verification history returned' })
  async getVerificationHistory(
    @CurrentUser() user: JwtPayload,
    @Query('tokenId') tokenId?: string,
    @Query('framework') framework?: ComplianceFramework,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.complianceService.getVerificationHistory(
      user.companyId,
      {
        tokenId,
        framework,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
    );

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId: user.companyId,
      userId: user.sub,
      resource: '/api/v1/compliance/verification-history',
      method: 'GET',
      status: 'success',
      statusCode: 200,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }
}
