import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';
import { authConfig } from '../config';
import { User } from '../users/entities/user.entity';
import { UserAccessEvents } from '../users/user-access-events';
import { UsersService } from '../users/users.service';
import {
  EventsGateway,
  MAX_AVAILABILITY_ROOMS_PER_SOCKET,
  MAX_DASHBOARD_ROOMS_PER_SOCKET,
} from './events.gateway';

const RESOURCE_ID = '20000000-0000-4000-8000-000000000001';
const USER_ID = '30000000-0000-4000-8000-000000000001';

interface FakeSocket {
  id: string;
  handshake: { headers: { cookie?: string } };
  data: Record<string, unknown>;
  rooms: Set<string>;
  disconnect: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
}

function fakeSocket(cookie?: string, id = 'socket1'): FakeSocket {
  const socket: FakeSocket = {
    id,
    handshake: { headers: cookie === undefined ? {} : { cookie } },
    data: {},
    rooms: new Set([id]),
    disconnect: jest.fn(),
    join: jest.fn((room: string) => {
      socket.rooms.add(room);
    }),
    leave: jest.fn((room: string) => {
      socket.rooms.delete(room);
    }),
  };
  return socket;
}

const asSocket = (socket: FakeSocket) => socket as unknown as Socket;

describe('EventsGateway', () => {
  let module: TestingModule;
  let gateway: EventsGateway;
  let jwtService: { verify: jest.Mock };
  let usersService: { findById: jest.Mock };
  let userAccessEvents: UserAccessEvents;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    module = await Test.createTestingModule({
      providers: [
        EventsGateway,
        UserAccessEvents,
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        {
          provide: authConfig.KEY,
          useValue: { cookie: { name: 'session.token' } },
        },
      ],
    }).compile();
    await module.init();

    gateway = module.get(EventsGateway);
    jwtService = module.get(JwtService);
    usersService = module.get(UsersService);
    userAccessEvents = module.get(UserAccessEvents);
  });

  afterEach(async () => {
    await module.close();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function validSession(expiresInSeconds = 900) {
    jwtService.verify.mockReturnValue({
      sub: USER_ID,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });
    usersService.findById.mockResolvedValue({
      id: USER_ID,
      isActive: true,
    } as User);
  }

  describe('handleConnection', () => {
    it.each([
      ['no cookie header', undefined],
      ['no auth cookie', 'other=123'],
      ['an empty auth cookie', 'session.token='],
      ['a cookie whose name only matches as a pattern', 'sessionxtoken=abc'],
    ])('disconnects with %s', async (_case, cookie) => {
      const client = fakeSocket(cookie);
      await gateway.handleConnection(asSocket(client));
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('disconnects if token is invalid', async () => {
      const client = fakeSocket('session.token=invalid');
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      await gateway.handleConnection(asSocket(client));
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects if user not found', async () => {
      const client = fakeSocket('session.token=valid');
      validSession();
      usersService.findById.mockResolvedValue(null);
      await gateway.handleConnection(asSocket(client));
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects if user is inactive', async () => {
      const client = fakeSocket('session.token=valid');
      validSession();
      usersService.findById.mockResolvedValue({ isActive: false } as User);
      await gateway.handleConnection(asSocket(client));
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('authenticates, records the user, and joins the private user room', async () => {
      const client = fakeSocket('a=1; session.token=valid%2Etoken');
      validSession();
      await gateway.handleConnection(asSocket(client));

      expect(jwtService.verify).toHaveBeenCalledWith('valid.token');
      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.userId).toBe(USER_ID);
      expect(client.join).toHaveBeenCalledWith(`user:${USER_ID}`);
    });

    it('disconnects when the token expires and clears the timer on disconnect', async () => {
      jest.useFakeTimers();
      const expiring = fakeSocket('session.token=valid', 'expiring');
      validSession(60);
      await gateway.handleConnection(asSocket(expiring));

      jest.advanceTimersByTime(59_000);
      expect(expiring.disconnect).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2_000);
      expect(expiring.disconnect).toHaveBeenCalledWith(true);

      const departed = fakeSocket('session.token=valid', 'departed');
      validSession(60);
      await gateway.handleConnection(asSocket(departed));
      gateway.handleDisconnect(asSocket(departed));
      jest.advanceTimersByTime(120_000);
      expect(departed.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('deactivation', () => {
    it('disconnects every socket of a deactivated user', () => {
      const disconnectSockets = jest.fn();
      const inRoom = jest.fn().mockReturnValue({ disconnectSockets });
      gateway.server = { in: inRoom } as never;

      userAccessEvents.publishDeactivated(USER_ID);

      expect(inRoom).toHaveBeenCalledWith(`user:${USER_ID}`);
      expect(disconnectSockets).toHaveBeenCalledWith(true);
    });

    it('stops listening once the module is destroyed', () => {
      const inRoom = jest.fn();
      gateway.server = { in: inRoom } as never;

      gateway.onModuleDestroy();
      userAccessEvents.publishDeactivated(USER_ID);

      expect(inRoom).not.toHaveBeenCalled();
    });
  });

  describe('availability subscriptions', () => {
    it('joins and leaves a validated availability room', () => {
      const client = fakeSocket();
      const payload = { resourceId: RESOURCE_ID, date: '2026-10-10' };

      gateway.handleJoinAvailability(asSocket(client), payload);
      expect(client.join).toHaveBeenCalledWith(
        `availability:${RESOURCE_ID}:2026-10-10`,
      );

      gateway.handleLeaveAvailability(asSocket(client), payload);
      expect(client.leave).toHaveBeenCalledWith(
        `availability:${RESOURCE_ID}:2026-10-10`,
      );
    });

    it.each([
      [undefined],
      ['not-an-object'],
      [{ resourceId: 'res1', date: '2026-10-10' }],
      [{ resourceId: RESOURCE_ID, date: '2026-02-30' }],
      [{ resourceId: RESOURCE_ID, date: '2026-10-10T00:00:00Z' }],
      [{ resourceId: RESOURCE_ID, date: 20261010 }],
      [{ resourceId: RESOURCE_ID }],
    ])('ignores an invalid availability payload %p', (payload) => {
      const client = fakeSocket();
      gateway.handleJoinAvailability(asSocket(client), payload);
      gateway.handleLeaveAvailability(asSocket(client), payload);
      expect(client.join).not.toHaveBeenCalled();
      expect(client.leave).not.toHaveBeenCalled();
    });

    it('caps the availability rooms a socket can join', () => {
      const client = fakeSocket();
      client.rooms.add(`user:${USER_ID}`);
      for (let day = 1; day <= MAX_AVAILABILITY_ROOMS_PER_SOCKET + 5; day++) {
        gateway.handleJoinAvailability(asSocket(client), {
          resourceId: RESOURCE_ID,
          date: `2026-10-${String(day).padStart(2, '0')}`,
        });
      }
      expect(client.join).toHaveBeenCalledTimes(
        MAX_AVAILABILITY_ROOMS_PER_SOCKET,
      );

      // Rejoining an existing room is a no-op, and leaving frees a slot.
      gateway.handleJoinAvailability(asSocket(client), {
        resourceId: RESOURCE_ID,
        date: '2026-10-01',
      });
      expect(client.join).toHaveBeenCalledTimes(
        MAX_AVAILABILITY_ROOMS_PER_SOCKET,
      );
      gateway.handleLeaveAvailability(asSocket(client), {
        resourceId: RESOURCE_ID,
        date: '2026-10-01',
      });
      gateway.handleJoinAvailability(asSocket(client), {
        resourceId: RESOURCE_ID,
        date: '2026-10-31',
      });
      expect(client.join).toHaveBeenLastCalledWith(
        `availability:${RESOURCE_ID}:2026-10-31`,
      );
    });
  });

  describe('dashboard subscriptions', () => {
    it('joins and leaves a validated dashboard room', () => {
      const client = fakeSocket();
      gateway.handleJoinDashboard(asSocket(client), { date: '2026-10-10' });
      expect(client.join).toHaveBeenCalledWith(
        'dashboard:availability:2026-10-10',
      );
      gateway.handleLeaveDashboard(asSocket(client), { date: '2026-10-10' });
      expect(client.leave).toHaveBeenCalledWith(
        'dashboard:availability:2026-10-10',
      );
    });

    it('ignores invalid dates and caps dashboard rooms', () => {
      const client = fakeSocket();
      gateway.handleJoinDashboard(asSocket(client), { date: '2026-13-01' });
      gateway.handleJoinDashboard(asSocket(client), { date: 'today' });
      expect(client.join).not.toHaveBeenCalled();

      for (let day = 1; day <= MAX_DASHBOARD_ROOMS_PER_SOCKET + 3; day++) {
        gateway.handleJoinDashboard(asSocket(client), {
          date: `2026-10-${String(day).padStart(2, '0')}`,
        });
      }
      expect(client.join).toHaveBeenCalledTimes(MAX_DASHBOARD_ROOMS_PER_SOCKET);
    });
  });
});
