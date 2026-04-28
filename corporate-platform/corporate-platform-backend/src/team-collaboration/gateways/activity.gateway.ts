import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../../cache/redis.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/team-activity',
})
export class ActivityGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ActivityGateway.name);
  private redisSubscriber: any;

  constructor(private readonly redis: RedisService) {}

  afterInit() {
    this.logger.log('Activity Gateway initialized');
    this.setupRedisSubscriber();
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    // Authenticate and join company room
    const companyId = client.handshake.query.companyId as string;
    if (companyId) {
      client.join(`company:${companyId}`);
      this.logger.log(`Client ${client.id} joined company:${companyId}`);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:activity')
  handleSubscribe(client: Socket, payload: { companyId: string }) {
    client.join(`company:${payload.companyId}`);
    this.logger.log(
      `Client ${client.id} subscribed to company:${payload.companyId}`,
    );
    return { event: 'subscribed', data: { companyId: payload.companyId } };
  }

  @SubscribeMessage('unsubscribe:activity')
  handleUnsubscribe(client: Socket, payload: { companyId: string }) {
    client.leave(`company:${payload.companyId}`);
    this.logger.log(
      `Client ${client.id} unsubscribed from company:${payload.companyId}`,
    );
    return { event: 'unsubscribed', data: { companyId: payload.companyId } };
  }

  broadcastToCompany(companyId: string, event: string, data: any) {
    this.server.to(`company:${companyId}`).emit(event, data);
  }

  private async setupRedisSubscriber() {
    try {
      this.redisSubscriber = this.redis.getClient().duplicate();
      await this.redisSubscriber.subscribe('activity:stream');

      this.redisSubscriber.on('message', (channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message);
          if (
            channel === 'activity:stream' &&
            parsed.event === 'activity:created'
          ) {
            this.broadcastToCompany(
              parsed.companyId,
              'activity:new',
              parsed.data,
            );
          }
        } catch (error) {
          this.logger.error('Error processing Redis message:', error);
        }
      });

      this.logger.log('Redis subscriber setup complete');
    } catch (error) {
      this.logger.error('Error setting up Redis subscriber:', error);
    }
  }
}
