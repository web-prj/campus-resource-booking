"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
} from "@/components/icons";
import { login, LoginError } from "../api/browser";
import { isUsthEmail } from "../schema";

interface LoginFormProps {
  redirectTo?: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

export function LoginForm({ redirectTo = "/dashboard" }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!isUsthEmail(email)) {
      nextErrors.email = "Enter a valid @usth.edu.vn email address.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
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
      await login({ email, password });
      router.replace(redirectTo);
    } catch (error) {
      setFormError(
        error instanceof LoginError
          ? error.message
          : "Sign-in could not be completed. Try again in a moment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="email">USTH email</label>
        <div className={`field-control${errors.email ? " field-control--error" : ""}`}>
          <MailIcon width={20} height={20} />
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="your.name@usth.edu.vn"
            value={email}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : "email-hint"}
            onChange={(event) => {
              setEmail(event.target.value);
              if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
            }}
          />
        </div>
        {errors.email ? (
          <p className="field-message field-message--error" id="email-error">
            {errors.email}
          </p>
        ) : (
          <p className="field-message" id="email-hint">
            Use the account issued by the university.
          </p>
        )}
      </div>

      <div className="form-field">
        <div className="field-label-row">
          <label htmlFor="password">Password</label>
          <span>Case-sensitive</span>
        </div>
        <div className={`field-control${errors.password ? " field-control--error" : ""}`}>
          <LockIcon width={20} height={20} />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) {
                setErrors((current) => ({ ...current, password: undefined }));
              }
            }}
          />
          <button
            className="password-toggle"
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {errors.password && (
          <p className="field-message field-message--error" id="password-error">
            {errors.password}
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

      <button className="button button--primary login-form__submit" type="submit" disabled={isSubmitting}>
        <span>{isSubmitting ? "Signing in…" : "Sign in securely"}</span>
        {isSubmitting ? (
          <span className="button-spinner" aria-hidden="true" />
        ) : (
          <ArrowRightIcon width={20} height={20} />
        )}
      </button>

      <p className="login-form__privacy">
        Your session stays in a protected browser cookie. This page never stores
        your password or access token.
      </p>
    </form>
  );
}
