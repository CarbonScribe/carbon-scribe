import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
// Fixed linting issues
import { StellarWebhookService } from './services/stellar-webhook.service';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import {
  StellarWebhookDto,
  TransactionStatusResponseDto,
} from './dto/stellar-webhook.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { Roles } from '../rbac/decorators/roles.decorator';

@Controller('api/v1/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly stellarWebhookService: StellarWebhookService,
    private readonly dispatcherService: WebhookDispatcherService,
  ) {}

  // --- Webhook Management ---

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async registerWebhook(@Body() registrationDto: any) {
    this.logger.debug(
      `Registering webhook: ${JSON.stringify(registrationDto)}`,
    );
    return { success: true, message: 'Webhook registered successfully' };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async listWebhooks() {
    return [];
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async unregisterWebhook(@Param('id') id: string) {
    this.logger.debug(`Unregistering webhook: ${id}`);
    return { success: true };
  }

  // --- Webhook Delivery (External) ---

  @Post('stellar')
  async receiveStellarWebhook(@Body() dto: StellarWebhookDto) {
    return this.stellarWebhookService.registerTransaction(dto);
  }

  @Post('soroban')
  async receiveSorobanEvent(@Body() event: any) {
    await this.dispatcherService.dispatch({
      eventType: 'soroban.event',
      timestamp: new Date().toISOString(),
      data: event,
    });
    return { received: true };
  }

  // --- Status Queries ---

  @Get('transactions/:hash/status')
  async getTransactionStatus(
    @Param('hash') hash: string,
  ): Promise<TransactionStatusResponseDto> {
    return this.stellarWebhookService.getTransactionStatus(hash);
  }

  @Get('deliveries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async listDeliveries() {
    return this.stellarWebhookService.listDeliveries();
  }
}
