"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  UserIcon,
} from "@/components/icons";
import { register, RegistrationError } from "../api/browser";
import {
  getUtf8ByteLength,
  isUsthEmail,
  isValidRegistrationPassword,
} from "../schema";

interface RegisterFormProps {
  redirectTo?: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function RegisterForm({ redirectTo = "/dashboard" }: RegisterFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};
    const normalizedName = fullName.trim();

    if (!normalizedName) {
      nextErrors.fullName = "Enter your full name.";
    } else if (normalizedName.length > 120) {
      nextErrors.fullName = "Full name must be 120 characters or fewer.";
    }

    if (!isUsthEmail(email)) {
      nextErrors.email = "Enter a valid @usth.edu.vn email address.";
    }

    if (!isValidRegistrationPassword(password)) {
      nextErrors.password =
        getUtf8ByteLength(password) > 72
          ? "Password must not exceed 72 UTF-8 bytes."
          : "Password must contain at least 8 characters.";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await register({ fullName, email, password });
      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof RegistrationError
          ? error.message
          : "Your account could not be created. Try again in a moment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form register-form" onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="register-full-name">Full name</label>
        <div className={`field-control${errors.fullName ? " field-control--error" : ""}`}>
          <UserIcon width={20} height={20} />
          <input
            id="register-full-name"
            name="fullName"
            type="text"
            autoComplete="name"
            maxLength={121}
            placeholder="Your full name"
            value={fullName}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? "register-name-error" : undefined}
            onChange={(event) => {
              setFullName(event.target.value);
              if (errors.fullName) {
                setErrors((current) => ({ ...current, fullName: undefined }));
              }
            }}
          />
        </div>
        {errors.fullName && (
          <p className="field-message field-message--error" id="register-name-error">
            {errors.fullName}
          </p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="register-email">USTH email</label>
        <div className={`field-control${errors.email ? " field-control--error" : ""}`}>
          <MailIcon width={20} height={20} />
          <input
            id="register-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="your.name@usth.edu.vn"
            value={email}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "register-email-error" : "register-email-hint"}
            onChange={(event) => {
              setEmail(event.target.value);
              if (errors.email) {
                setErrors((current) => ({ ...current, email: undefined }));
              }
            }}
          />
        </div>
        {errors.email ? (
          <p className="field-message field-message--error" id="register-email-error">
            {errors.email}
          </p>
        ) : (
          <p className="field-message" id="register-email-hint">
            Registration is limited to university-issued accounts.
          </p>
        )}
      </div>

      <div className="form-field">
        <div className="field-label-row">
          <label htmlFor="register-password">Password</label>
          <span>8–72 UTF-8 bytes</span>
        </div>
        <div className={`field-control${errors.password ? " field-control--error" : ""}`}>
          <LockIcon width={20} height={20} />
          <input
            id="register-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "register-password-error" : undefined}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) {
                setErrors((current) => ({ ...current, password: undefined }));
              }
              if (errors.confirmPassword) {
                setErrors((current) => ({ ...current, confirmPassword: undefined }));
              }
            }}
          />
          <button
            className="password-toggle"
            type="button"
            aria-label={showPassword ? "Hide passwords" : "Show passwords"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {errors.password && (
          <p className="field-message field-message--error" id="register-password-error">
            {errors.password}
          </p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="register-password-confirmation">Confirm password</label>
        <div className={`field-control${errors.confirmPassword ? " field-control--error" : ""}`}>
          <LockIcon width={20} height={20} />
          <input
            id="register-password-confirmation"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Enter the same password"
            value={confirmPassword}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? "register-confirm-error" : undefined}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (errors.confirmPassword) {
                setErrors((current) => ({ ...current, confirmPassword: undefined }));
              }
            }}
          />
        </div>
        {errors.confirmPassword && (
          <p className="field-message field-message--error" id="register-confirm-error">
            {errors.confirmPassword}
          </p>
        )}
      </div>

      <div className="login-form__status" aria-live="polite" aria-atomic="true">
        {formError && (
          <div className="form-alert" role="alert">
            <span aria-hidden="true">!</span>
            <p>{formError}</p>
          </div>
        )}
      </div>

      <button
        className="button button--primary login-form__submit"
        type="submit"
        disabled={isSubmitting}
      >
        <span>{isSubmitting ? "Creating account…" : "Create student account"}</span>
        {isSubmitting ? (
          <span className="button-spinner" aria-hidden="true" />
        ) : (
          <ArrowRightIcon width={20} height={20} />
        )}
      </button>

      <p className="login-form__privacy">
        Creating an account starts a protected session. Your password and access
        token are never stored in frontend browser storage.
      </p>
    </form>
  );
}
