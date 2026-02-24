import { Test, TestingModule } from '@nestjs/testing';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

describe('SecurityController', () => {
  let controller: SecurityController;
  let service: SecurityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityController],
      providers: [
        {
          provide: SecurityService,
          useValue: {
            listWhitelist: jest.fn(),
            addWhitelist: jest.fn(),
            removeWhitelist: jest.fn(),
            queryAuditLogs: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SecurityController>(SecurityController);
    service = module.get<SecurityService>(SecurityService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lists whitelist entries', async () => {
    const user = { companyId: 'c1', role: 'admin' } as any;
    const entries = [{ id: '1' }];
    (service.listWhitelist as jest.Mock).mockResolvedValue(entries);

    const result = await controller.listWhitelist(user);
    expect(result).toEqual(entries);
    expect(service.listWhitelist).toHaveBeenCalledWith('c1');
  });

  it('adds whitelist entry', async () => {
    const user = { companyId: 'c1', sub: 'u1', role: 'admin' } as any;
    const body = { cidr: '192.168.0.0/24', description: 'office' };
    const created = { id: '1', cidr: body.cidr };
    (service.addWhitelist as jest.Mock).mockResolvedValue(created);

    const result = await controller.addWhitelist(user, body);
    expect(result).toEqual(created);
    expect(service.addWhitelist).toHaveBeenCalledWith(
      'c1',
      'u1',
      body.cidr,
      body.description,
    );
  });

  it('removes whitelist entry', async () => {
    const user = { companyId: 'c1', sub: 'u1', role: 'admin' } as any;
    await controller.removeWhitelist(user, 'id1');
    expect(service.removeWhitelist).toHaveBeenCalledWith('id1', 'c1', 'u1');
  });
});
