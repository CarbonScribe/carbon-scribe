import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { RetirementRecordingService } from './retirement-recording.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { COMPLIANCE_VIEW } from '../../rbac/constants/permissions.constants';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/retirements')
export class RetirementRecordingController {
  constructor(
    private readonly retirementRecordingService: RetirementRecordingService,
  ) {}

  @Post('record')
  @Permissions(COMPLIANCE_VIEW)
  async recordRetirement(@Body() body: any, @CurrentUser() user: any) {
    if (Array.isArray(body)) {
      // Batch
      return this.retirementRecordingService.batchRetire(body, user?.sub);
    }
    // Single
    return this.retirementRecordingService.recordRetirement({
      ...body,
      userId: user?.sub,
    });
  }

  @Get(':tokenId')
  async getRetirementByToken(@Param('tokenId') _tokenId: string) {
    // TODO: Fetch from DB or contract
    return {};
  }

  @Get('entity/:address')
  async listRetirementsByEntity(@Param('address') _address: string) {
    // TODO: Fetch from DB or contract
    return [];
  }
}
