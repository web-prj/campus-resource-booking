import { registerDecorator, ValidationOptions } from 'class-validator';

export function hasNoNullByte(value: unknown): boolean {
  return typeof value === 'string' && !value.includes('\u0000');
}

export function IsWithoutNullByte(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isWithoutNullByte',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return hasNoNullByte(value);
        },
        defaultMessage() {
          return 'must not contain a null byte';
        },
      },
    });
  };
}
