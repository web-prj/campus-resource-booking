export class ResourceCodeAlreadyExistsError extends Error {
  constructor() {
    super('A resource with this code already exists');
    this.name = 'ResourceCodeAlreadyExistsError';
  }
}
