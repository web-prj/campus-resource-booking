import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';

/**
 * Socket.IO adapter whose CORS policy comes from validated configuration
 * rather than from `process.env` at decorator-evaluation time. Credentialed
 * handshakes (the session cookie) require exact origins, never `*`.
 */
export class ConfigIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigins, credentials: true },
    }) as Server;
  }
}
