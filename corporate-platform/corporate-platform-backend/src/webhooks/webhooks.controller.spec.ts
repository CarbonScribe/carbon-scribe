import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { StellarWebhookService } from './services/stellar-webhook.service';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';

describe('WebhooksController', () => {
  let controller: WebhooksController;

  const mockStellarWebhookService = {
    registerTransaction: jest.fn(),
    getTransactionStatus: jest.fn(),
    listDeliveries: jest.fn(),
  };

  const mockWebhookDispatcherService = {
    dispatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: StellarWebhookService,
          useValue: mockStellarWebhookService,
        },
        {
          provide: WebhookDispatcherService,
          useValue: mockWebhookDispatcherService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
