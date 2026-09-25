import { bootstrapConfig } from './bootstrap.config';

const KEYS = [
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD',
  'BOOTSTRAP_ADMIN_NAME',
  'BOOTSTRAP_STAFF_EMAIL',
  'BOOTSTRAP_STAFF_PASSWORD',
  'BOOTSTRAP_STAFF_NAME',
] as const;

describe('bootstrapConfig', () => {
  const original = Object.fromEntries(
    KEYS.map((key) => [key, process.env[key]]),
  );

  beforeEach(() => {
    for (const key of KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('treats unset and empty emails as not configured', () => {
    expect(bootstrapConfig()).toEqual({ admin: undefined, staff: undefined });

    process.env.BOOTSTRAP_ADMIN_EMAIL = '   ';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'ignored-password';
    process.env.BOOTSTRAP_STAFF_EMAIL = '';
    expect(bootstrapConfig()).toEqual({ admin: undefined, staff: undefined });
  });

  it('normalizes emails like the authentication DTOs and defaults names', () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = ' First.Admin@USTH.edu.vn ';
    process.env.BOOTSTRAP_STAFF_EMAIL = 'Desk.Staff@usth.edu.vn';
    process.env.BOOTSTRAP_STAFF_PASSWORD = '';

    expect(bootstrapConfig()).toEqual({
      admin: {
        email: 'first.admin@usth.edu.vn',
        password: undefined,
        fullName: 'Campus Administrator',
      },
      staff: {
        email: 'desk.staff@usth.edu.vn',
        password: undefined,
        fullName: 'Campus Staff',
      },
    });
  });

  it('keeps passwords verbatim and trims configured names', () => {
    process.env.BOOTSTRAP_STAFF_EMAIL = 'desk.staff@usth.edu.vn';
    process.env.BOOTSTRAP_STAFF_PASSWORD = ' spaced pass ';
    process.env.BOOTSTRAP_STAFF_NAME = '  Lan Pham ';

    expect(bootstrapConfig().staff).toEqual({
      email: 'desk.staff@usth.edu.vn',
      password: ' spaced pass ',
      fullName: 'Lan Pham',
    });
  });
});
