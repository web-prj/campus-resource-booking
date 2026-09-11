import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { CheckIcon, ClockIcon } from "@/components/icons";
import { getCurrentUser } from "@/features/auth/api/server";
import { LogoutButton } from "@/features/auth/components/logout-button";

export const metadata: Metadata = {
  title: "Campus workspace",
  description: "Your protected Campus Resource Booking workspace.",
};

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/welcome");

  return (
    <main className="welcome-page">
      <div className="welcome-page__atmosphere" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="welcome-card">
        <BrandMark />
        <div className="welcome-card__symbol">
          <CheckIcon />
        </div>
        <p className="welcome-card__eyebrow">Session verified</p>
        <h1>Welcome, {user.fullName}.</h1>
        <p className="welcome-card__lead">
          Your protected campus workspace is ready. Resource search,
          availability, and booking management will connect here in the next
          product slice.
        </p>
        <div className="welcome-card__notice">
          <ClockIcon />
          <p>
            <strong>Signed in as {user.role}</strong>
            Your session is verified by the API using the protected browser
            cookie.
          </p>
        </div>
        <LogoutButton />
        <p className="welcome-card__note">
          No access token is exposed to this page or stored in browser storage.
        </p>
      </div>
    </main>
  );
}
