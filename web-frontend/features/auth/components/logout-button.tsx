"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "../api/browser";

interface LogoutButtonProps {
  className?: string;
  errorClassName?: string;
}

export function LogoutButton({
  className = "button button--primary",
  errorClassName = "field-message field-message--error",
}: LogoutButtonProps = {}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (isPending) return;
    setIsPending(true);
    setError("");

    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Sign-out could not be completed. Try again.");
      setIsPending(false);
    }
  }

  return (
    <div>
      <button
        className={className}
        type="button"
        disabled={isPending}
        onClick={handleLogout}
      >
        {isPending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p className={errorClassName} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
