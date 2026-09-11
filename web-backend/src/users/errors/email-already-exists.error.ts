export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('A user with this email already exists');
    this.name = 'EmailAlreadyExistsError';
  }
}
