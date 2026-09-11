import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function hasMaxUtf8ByteLength(
  value: unknown,
  maxBytes: number,
): boolean {
  return (
    typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= maxBytes
  );
}

export function MaxUtf8ByteLength(
  maxBytes: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxUtf8ByteLength',
      target: object.constructor,
      propertyName,
      constraints: [maxBytes],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return hasMaxUtf8ByteLength(value, maxBytes);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must not exceed ${maxBytes} UTF-8 bytes`;
        },
      },
    });
  };
}
