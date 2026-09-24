import { IoAdapter } from '@nestjs/platform-socket.io';
import { ConfigIoAdapter } from './config-io.adapter';

describe('ConfigIoAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('applies configured credentialed CORS origins to every server', () => {
    const createIOServer = jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue({});
    const adapter = new ConfigIoAdapter({} as never, [
      'http://localhost:18321',
    ]);

    adapter.createIOServer(0, {
      path: '/socket.io',
      cors: { origin: '*' },
    });

    expect(createIOServer).toHaveBeenCalledWith(0, {
      path: '/socket.io',
      cors: { origin: ['http://localhost:18321'], credentials: true },
    });
  });
});
