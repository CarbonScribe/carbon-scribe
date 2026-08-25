import { Test, TestingModule } from '@nestjs/testing';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';

describe('AuctionController', () => {
  let controller: AuctionController;
  let service: AuctionService;

  const mockAuctionService = {
    getAuctions: jest.fn(),
    getAuctionById: jest.fn(),
    createAuction: jest.fn(),
    startAuction: jest.fn(),
    placeBid: jest.fn(),
    getAuctionBids: jest.fn(),
    settleAuction: jest.fn(),
  };

  const mockUser: JwtPayload = {
    sub: 'real-user-id',
    companyId: 'real-company-id',
    role: 'manager',
    email: 'test@example.com',
    sessionId: 'session-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuctionController],
      providers: [
        {
          provide: AuctionService,
          useValue: mockAuctionService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(IpWhitelistGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuctionController>(AuctionController);
    service = module.get<AuctionService>(AuctionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('placeBid', () => {
    it("should call auctionService.placeBid with the authenticated user's real identity", async () => {
      const auctionId = 'auction-123';
      const dto: PlaceBidDto = { bidPrice: 1000, quantity: 50 };

      await controller.placeBid(auctionId, mockUser, dto);

      expect(service.placeBid).toHaveBeenCalledWith(
        auctionId,
        'real-user-id',
        'real-company-id',
        dto,
      );
      expect(service.placeBid).not.toHaveBeenCalledWith(
        expect.anything(),
        'mock-user-id',
        expect.anything(),
        expect.anything(),
      );
      expect(service.placeBid).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'mock-company-id',
        expect.anything(),
      );
    });
  });

  describe('Guard and Decorator Tests (Metadata)', () => {
    it('should have JwtAuthGuard applied to the controller', () => {
      const guards = Reflect.getMetadata('__guards__', AuctionController);
      expect(guards).toBeDefined();
      const guardNames = guards.map((g: any) => g.name || g.constructor.name);
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('PermissionsGuard');
      expect(guardNames).toContain('IpWhitelistGuard');
    });

    it('should have correct permissions on methods', () => {
      const getAuctionsPerms = Reflect.getMetadata('permissions', controller.getAuctions);
      expect(getAuctionsPerms).toEqual(['portfolio:view']);

      const placeBidPerms = Reflect.getMetadata('permissions', controller.placeBid);
      expect(placeBidPerms).toEqual(['credit:purchase']);
    });
  });
});
