import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * The only email domain permitted to authenticate. Accounts are issued under
 * `@usth.edu.vn`, and access is restricted strictly to that domain.
 */
export const STUDENT_EMAIL_DOMAIN = 'usth.edu.vn';

const STUDENT_EMAIL_SUFFIX = `@${STUDENT_EMAIL_DOMAIN}`;

/**
 * True only for a syntactically valid, single-`@` email whose domain is exactly
 * `usth.edu.vn` (case-insensitive). Subdomains such as `x@mail.usth.edu.vn` are
 * intentionally rejected - the rule is strict.
 */
export function isStudentEmail(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const email = value.trim().toLowerCase();
  const atIndex = email.indexOf('@');

  // Exactly one '@', a non-empty local part, no whitespace, and the exact domain.
  if (
    atIndex <= 0 ||
    email.indexOf('@', atIndex + 1) !== -1 ||
    /\s/.test(email)
  ) {
    return false;
  }

  return email.endsWith(STUDENT_EMAIL_SUFFIX);
}

export function IsStudentEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStudentEmail',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isStudentEmail(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid ${STUDENT_EMAIL_SUFFIX} student email address`;
        },
      },
    });
  };
}
