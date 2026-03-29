import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../../cache/redis.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
@WebSocketGateway({
  namespace: '/api/v1/team/activity/live',
  cors: { origin: '*', credentials: true },
})
export class ActivityLiveGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ActivityLiveGateway.name);
  private redisSubscriber: any;

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  async afterInit() {
    await this.initRedisSubscription();
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      const room = this.companyRoom(payload.companyId);
      client.data.companyId = payload.companyId;
      client.data.userId = payload.sub;
      client.join(room);
      client.emit('connected', { companyId: payload.companyId, userId: payload.sub });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const companyId = client.data.companyId as string | undefined;
    if (companyId) {
      client.leave(this.companyRoom(companyId));
    }
  }

  private async initRedisSubscription() {
    try {
      const base: any = this.redis.getClient();
      if (!base || !this.redis.isHealthy() || typeof base.duplicate !== 'function') {
        return;
      }
      this.redisSubscriber = base.duplicate();
      await this.redisSubscriber.psubscribe('team-activity:*');
      this.redisSubscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
        const companyId = channel.split(':')[1];
        if (!companyId) return;
        try {
          const parsed = JSON.parse(message);
          this.server.to(this.companyRoom(companyId)).emit('activity', parsed);
        } catch {
          this.server.to(this.companyRoom(companyId)).emit('activity', message);
        }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(message);
    }
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = (client.handshake.auth as any)?.token;
    if (typeof authToken === 'string' && authToken) {
      return authToken.startsWith('Bearer ') ? authToken.slice(7) : authToken;
    }
    const header = client.handshake.headers['authorization'];
    if (typeof header === 'string' && header) {
      return header.startsWith('Bearer ') ? header.slice(7) : header;
    }
    return undefined;
  }

  private companyRoom(companyId: string) {
    return `company:${companyId}`;
  }
}

