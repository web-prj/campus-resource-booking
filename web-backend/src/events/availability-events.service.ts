import { Injectable } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Injectable()
export class AvailabilityEventsService {
  constructor(private readonly eventsGateway: EventsGateway) {}

  notifyAvailabilityChanged(resourceId: string, date: string): void {
    if (!this.eventsGateway.server) return;
    const payload = { resourceId, date };
    this.eventsGateway.server
      .to(`availability:${resourceId}:${date}`)
      .to(`dashboard:availability:${date}`)
      .emit('availability:changed', payload);
  }

  notifyResourceChanged(resourceId: string): void {
    if (!this.eventsGateway.server) return;
    const payload = { resourceId };
    this.eventsGateway.server.emit('resource:changed', payload);
  }
}
