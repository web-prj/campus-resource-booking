import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import {
  AppConfig,
  AuthConfig,
  appConfig,
  authConfig,
  DEFAULT_CORS_ORIGINS,
} from '../config';
import { UsersService } from '../users/users.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/**
 * WebSocket gateway for real-time availability notifications.
 *
 * CORS origins are resolved at decorator evaluation time from process.env
 * (before ConfigModule loads .env files). In practice this works because
 * Docker and CI set the variable directly, and local dev falls back to the
 * default. The injected AppConfig is used at runtime for any future needs.
 */
@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: (process.env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGINS)
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @Inject(appConfig.KEY) private readonly appConfiguration: AppConfig,
    @Inject(authConfig.KEY) private readonly authConfiguration: AuthConfig,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const cookieHeader = client.handshake.headers.cookie;
      if (!cookieHeader) {
        client.disconnect(true);
        return;
      }

      const cookieName = this.authConfiguration.cookie.name;
      const match = cookieHeader.match(
        new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`),
      );

      if (!match || !match[1]) {
        client.disconnect(true);
        return;
      }

      const rawToken = decodeURIComponent(match[1]);
      const payload: JwtPayload = this.jwtService.verify(rawToken);

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        client.disconnect(true);
        return;
      }

      this.logger.log(`Client connected: ${client.id}`);
    } catch {
      this.logger.warn(`WebSocket connection rejected: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:availability')
  handleJoinAvailability(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { resourceId?: string; date?: string },
  ) {
    if (!payload?.resourceId || !payload?.date) return;
    client.join(`availability:${payload.resourceId}:${payload.date}`);
  }

  @SubscribeMessage('leave:availability')
  handleLeaveAvailability(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { resourceId?: string; date?: string },
  ) {
    if (!payload?.resourceId || !payload?.date) return;
    client.leave(`availability:${payload.resourceId}:${payload.date}`);
  }

  @SubscribeMessage('join:dashboard')
  handleJoinDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { date?: string },
  ) {
    if (!payload?.date) return;
    client.join(`dashboard:availability:${payload.date}`);
  }

  @SubscribeMessage('leave:dashboard')
  handleLeaveDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { date?: string },
  ) {
    if (!payload?.date) return;
    client.leave(`dashboard:availability:${payload.date}`);
  }
}
