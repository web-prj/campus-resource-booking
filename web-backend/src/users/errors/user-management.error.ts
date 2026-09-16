export class UserNotFoundError extends Error {
  constructor() {
    super('User not found');
    this.name = 'UserNotFoundError';
  }
}

export class SelfManagementNotAllowedError extends Error {
  constructor() {
    super('Administrators cannot change their own role or access status');
    this.name = 'SelfManagementNotAllowedError';
  }
}

export class LastActiveAdminError extends Error {
  constructor() {
    super('At least one active administrator must remain');
    this.name = 'LastActiveAdminError';
  }
}
