import { Test, TestingModule } from '@nestjs/testing';
import { EventsGateway } from './events.gateway';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { appConfig, authConfig } from '../config';

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<UsersService>;

  const mockAppConfig = { corsOrigins: ['http://localhost:18321'] };
  const mockAuthConfig = { cookie: { name: 'access_token' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsGateway,
        {
          provide: JwtService,
          useValue: { verify: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: { findById: jest.fn() },
        },
        {
          provide: appConfig.KEY,
          useValue: mockAppConfig,
        },
        {
          provide: authConfig.KEY,
          useValue: mockAuthConfig,
        },
      ],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
    jwtService = module.get(JwtService);
    usersService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('disconnects if no cookie header', async () => {
      const client = {
        handshake: { headers: {} },
        disconnect: jest.fn(),
      } as any;
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects if no auth cookie', async () => {
      const client = {
        handshake: { headers: { cookie: 'other=123' } },
        disconnect: jest.fn(),
      } as any;
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects if token is invalid', async () => {
      const client = {
        handshake: { headers: { cookie: 'access_token=invalid' } },
        disconnect: jest.fn(),
      } as any;
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects if user not found', async () => {
      const client = {
        handshake: { headers: { cookie: 'access_token=valid' } },
        disconnect: jest.fn(),
      } as any;
      jwtService.verify.mockReturnValue({ sub: 'user1' });
      usersService.findById.mockResolvedValue(null);
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects if user is inactive', async () => {
      const client = {
        handshake: { headers: { cookie: 'access_token=valid' } },
        disconnect: jest.fn(),
      } as any;
      jwtService.verify.mockReturnValue({ sub: 'user1' });
      usersService.findById.mockResolvedValue({ isActive: false } as any);
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('authenticates successfully', async () => {
      const client = {
        id: 'socket1',
        handshake: { headers: { cookie: 'access_token=valid' } },
        disconnect: jest.fn(),
      } as any;
      jwtService.verify.mockReturnValue({ sub: 'user1' });
      usersService.findById.mockResolvedValue({ isActive: true } as any);
      await gateway.handleConnection(client);
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinAvailability', () => {
    it('joins the availability room', () => {
      const client = { join: jest.fn() } as any;
      gateway.handleJoinAvailability(client, {
        resourceId: 'res1',
        date: '2023-10-10',
      });
      expect(client.join).toHaveBeenCalledWith('availability:res1:2023-10-10');
    });
  });

  describe('handleLeaveAvailability', () => {
    it('leaves the availability room', () => {
      const client = { leave: jest.fn() } as any;
      gateway.handleLeaveAvailability(client, {
        resourceId: 'res1',
        date: '2023-10-10',
      });
      expect(client.leave).toHaveBeenCalledWith('availability:res1:2023-10-10');
    });
  });

  describe('handleJoinDashboard', () => {
    it('joins the dashboard room', () => {
      const client = { join: jest.fn() } as any;
      gateway.handleJoinDashboard(client, { date: '2023-10-10' });
      expect(client.join).toHaveBeenCalledWith(
        'dashboard:availability:2023-10-10',
      );
    });
  });

  describe('handleLeaveDashboard', () => {
    it('leaves the dashboard room', () => {
      const client = { leave: jest.fn() } as any;
      gateway.handleLeaveDashboard(client, { date: '2023-10-10' });
      expect(client.leave).toHaveBeenCalledWith(
        'dashboard:availability:2023-10-10',
      );
    });
  });
});
