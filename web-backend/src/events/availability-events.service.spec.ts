import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityEventsService } from './availability-events.service';
import { EventsGateway } from './events.gateway';

describe('AvailabilityEventsService', () => {
  let service: AvailabilityEventsService;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityEventsService,
        {
          provide: EventsGateway,
          useValue: { server: mockServer },
        },
      ],
    }).compile();

    service = module.get<AvailabilityEventsService>(AvailabilityEventsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('notifyAvailabilityChanged', () => {
    it('emits to correct rooms', () => {
      service.notifyAvailabilityChanged('res1', '2023-10-10');
      expect(mockServer.to).toHaveBeenCalledWith(
        'availability:res1:2023-10-10',
      );
      expect(mockServer.to).toHaveBeenCalledWith(
        'dashboard:availability:2023-10-10',
      );
      expect(mockServer.emit).toHaveBeenCalledWith('availability:changed', {
        resourceId: 'res1',
        date: '2023-10-10',
      });
    });
  });

  describe('notifyResourceChanged', () => {
    it('broadcasts to all', () => {
      service.notifyResourceChanged('res1');
      expect(mockServer.emit).toHaveBeenCalledWith('resource:changed', {
        resourceId: 'res1',
      });
    });
  });
});
