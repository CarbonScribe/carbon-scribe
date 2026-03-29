import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../cache/redis.service';
import { ActivityLiveGateway } from './activity-live.gateway';

describe('ActivityLiveGateway', () => {
  let gateway: ActivityLiveGateway;
  let jwt: { verify: jest.Mock };
  let redis: { getClient: jest.Mock; isHealthy: jest.Mock };

  beforeEach(async () => {
    jwt = { verify: jest.fn() };
    redis = { getClient: jest.fn(), isHealthy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLiveGateway,
        { provide: JwtService, useValue: jwt },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    gateway = module.get(ActivityLiveGateway);
  });

  it('joins the tenant room when a valid JWT is provided', async () => {
    jwt.verify.mockReturnValue({ sub: 'u1', companyId: 'c1' });

    const client: any = {
      handshake: { auth: { token: 'Bearer token-1' }, headers: {} },
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client);

    expect(jwt.verify).toHaveBeenCalledWith('token-1');
    expect(client.join).toHaveBeenCalledWith('company:c1');
    expect(client.emit).toHaveBeenCalledWith('connected', { companyId: 'c1', userId: 'u1' });
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects when JWT verification fails', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('bad token');
    });

    const client: any = {
      handshake: { auth: { token: 'token-1' }, headers: {} },
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});

