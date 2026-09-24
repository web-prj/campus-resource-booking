import { Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
import { isDateString, isUUID } from 'class-validator';
import { Subscription } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { JwtPayloadWithTiming } from '../auth/interfaces/jwt-payload.interface';
import { readCookie } from '../common/utils/cookie.util';
import { AuthConfig, authConfig } from '../config';
import { DATE_PATTERN } from '../resources/dto/resource-availability-query.dto';
import { UserAccessEvents } from '../users/user-access-events';
import { UsersService } from '../users/users.service';

/** Upper bound on availability rooms (resource/date pairs) per socket. */
export const MAX_AVAILABILITY_ROOMS_PER_SOCKET = 20;
/** Upper bound on dashboard date rooms per socket. */
export const MAX_DASHBOARD_ROOMS_PER_SOCKET = 20;
/** Largest delay `setTimeout` accepts without firing immediately. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

const AVAILABILITY_ROOM_PREFIX = 'availability:';
const DASHBOARD_ROOM_PREFIX = 'dashboard:availability:';

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

interface AvailabilitySubscription {
  resourceId: string;
  date: string;
}

/**
 * WebSocket gateway for real-time availability notifications.
 *
 * CORS is applied by `ConfigIoAdapter` (registered in `configureApp`) from the
 * validated application configuration.
 */
@WebSocketGateway({ namespace: '/ws' })
export class EventsGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();
  private deactivationSubscription?: Subscription;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly userAccessEvents: UserAccessEvents,
    @Inject(authConfig.KEY) private readonly authConfiguration: AuthConfig,
  ) {}

  onModuleInit(): void {
    this.deactivationSubscription =
      this.userAccessEvents.deactivated$.subscribe((userId) =>
        this.disconnectUser(userId),
      );
  }

  onModuleDestroy(): void {
    this.deactivationSubscription?.unsubscribe();
    for (const timer of this.expiryTimers.values()) clearTimeout(timer);
    this.expiryTimers.clear();
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const rawToken = readCookie(
        client.handshake.headers.cookie,
        this.authConfiguration.cookie.name,
      );
      if (!rawToken) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<JwtPayloadWithTiming>(rawToken);

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        client.disconnect(true);
        return;
      }

      client.data.userId = user.id;
      await client.join(userRoom(user.id));
      this.scheduleExpiry(client, payload.exp);

      this.logger.log(`Client connected: ${client.id}`);
    } catch {
      this.logger.warn(`WebSocket connection rejected: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.clearExpiry(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:availability')
  handleJoinAvailability(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: unknown,
  ): void {
    const subscription = this.availabilitySubscription(payload);
    if (!subscription) return;
    this.joinCapped(
      client,
      `${AVAILABILITY_ROOM_PREFIX}${subscription.resourceId}:${subscription.date}`,
      AVAILABILITY_ROOM_PREFIX,
      MAX_AVAILABILITY_ROOMS_PER_SOCKET,
    );
  }

  @SubscribeMessage('leave:availability')
  handleLeaveAvailability(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: unknown,
  ): void {
    const subscription = this.availabilitySubscription(payload);
    if (!subscription) return;
    void client.leave(
      `${AVAILABILITY_ROOM_PREFIX}${subscription.resourceId}:${subscription.date}`,
    );
  }

  @SubscribeMessage('join:dashboard')
  handleJoinDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: unknown,
  ): void {
    const date = this.dashboardDate(payload);
    if (!date) return;
    this.joinCapped(
      client,
      `${DASHBOARD_ROOM_PREFIX}${date}`,
      DASHBOARD_ROOM_PREFIX,
      MAX_DASHBOARD_ROOMS_PER_SOCKET,
    );
  }

  @SubscribeMessage('leave:dashboard')
  handleLeaveDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: unknown,
  ): void {
    const date = this.dashboardDate(payload);
    if (!date) return;
    void client.leave(`${DASHBOARD_ROOM_PREFIX}${date}`);
  }

  /** Drops every socket of a user, e.g. right after deactivation. */
  disconnectUser(userId: string): void {
    if (!this.server) return;
    this.server.in(userRoom(userId)).disconnectSockets(true);
  }

  private scheduleExpiry(client: Socket, exp: number | undefined): void {
    this.clearExpiry(client.id);
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return;

    const delay = Math.max(0, exp * 1000 - Date.now());
    const timer = setTimeout(
      () => {
        this.expiryTimers.delete(client.id);
        client.disconnect(true);
      },
      Math.min(delay, MAX_TIMER_DELAY_MS),
    );
    timer.unref?.();
    this.expiryTimers.set(client.id, timer);
  }

  private clearExpiry(socketId: string): void {
    const timer = this.expiryTimers.get(socketId);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(socketId);
  }

  private joinCapped(
    client: Socket,
    room: string,
    prefix: string,
    limit: number,
  ): void {
    if (client.rooms.has(room)) return;
    let joined = 0;
    for (const existing of client.rooms) {
      if (existing.startsWith(prefix)) joined += 1;
    }
    if (joined >= limit) return;
    void client.join(room);
  }

  private availabilitySubscription(
    payload: unknown,
  ): AvailabilitySubscription | null {
    if (!payload || typeof payload !== 'object') return null;
    const { resourceId, date } = payload as Record<string, unknown>;
    if (!isUUID(resourceId) || !isCalendarDate(date)) return null;
    return { resourceId: resourceId as string, date };
  }

  private dashboardDate(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const { date } = payload as Record<string, unknown>;
    return isCalendarDate(date) ? date : null;
  }
}

/** A real `YYYY-MM-DD` calendar date, validated like the REST query DTOs. */
function isCalendarDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    DATE_PATTERN.test(value) &&
    isDateString(value, { strict: true })
  );
}
