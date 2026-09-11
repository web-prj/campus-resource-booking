"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "../api/browser";

export function LogoutButton() {
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
        className="button button--primary"
        type="button"
        disabled={isPending}
        onClick={handleLogout}
      >
        {isPending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p className="welcome-card__note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
