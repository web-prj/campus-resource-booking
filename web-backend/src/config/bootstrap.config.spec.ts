import { bootstrapConfig } from './bootstrap.config';

describe('bootstrapConfig', () => {
  const original = process.env.BOOTSTRAP_ADMIN_EMAIL;

  afterEach(() => {
    if (original === undefined) delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    else process.env.BOOTSTRAP_ADMIN_EMAIL = original;
  });

  it('treats unset and empty values as not configured', () => {
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    expect(bootstrapConfig().adminEmail).toBeUndefined();

    process.env.BOOTSTRAP_ADMIN_EMAIL = '   ';
    expect(bootstrapConfig().adminEmail).toBeUndefined();
  });

  it('normalizes the configured email like the authentication DTOs', () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = ' First.Admin@USTH.edu.vn ';
    expect(bootstrapConfig().adminEmail).toBe('first.admin@usth.edu.vn');
  });
});
