import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import {
  CheckIcon,
  ChevronLeftIcon,
  EquipmentIcon,
  LaboratoryIcon,
  RoomIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getSafeRedirect } from "@/features/auth/routing";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a student account with your USTH email address.",
};

interface RegisterPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const redirectTo = getSafeRedirect(params.next);

  return (
    <main className="login-page register-page">
      <section className="login-showcase" aria-labelledby="register-showcase-title">
        <div className="login-showcase__atmosphere" aria-hidden="true">
          <span className="login-showcase__grid" />
          <span className="login-showcase__glow login-showcase__glow--one" />
          <span className="login-showcase__glow login-showcase__glow--two" />
        </div>

        <div className="login-showcase__content">
          <BrandMark inverse />
          <div className="login-showcase__message">
            <p className="section-kicker section-kicker--light">
              <span className="section-kicker__dot" />
              Student registration
            </p>
            <h1 id="register-showcase-title">Plan campus time around what you need.</h1>
            <p>
              Create one student account to search rooms, laboratories, and
              equipment, check operational availability, and send booking
              requests.
            </p>
          </div>

          <div className="login-resource-stack" aria-label="Campus resource types">
            <div className="login-resource-card login-resource-card--first">
              <span><RoomIcon /></span>
              <div><strong>Study rooms</strong><small>Compare capacity and location</small></div>
              <CheckIcon />
            </div>
            <div className="login-resource-card login-resource-card--second">
              <span><LaboratoryIcon /></span>
              <div><strong>Laboratories</strong><small>See approval requirements</small></div>
              <span className="login-resource-card__status">Review</span>
            </div>
            <div className="login-resource-card login-resource-card--third">
              <span><EquipmentIcon /></span>
              <div><strong>Equipment</strong><small>Review collection points</small></div>
              <CheckIcon />
            </div>
          </div>

          <p className="login-showcase__footnote">
            <ShieldCheckIcon /> Registration is restricted to @usth.edu.vn accounts
          </p>
        </div>
      </section>

      <section className="login-panel login-panel--register" aria-labelledby="register-title">
        <div className="login-panel__inner">
          <Link className="back-link" href="/">
            <ChevronLeftIcon width={18} height={18} />
            Back to overview
          </Link>

          <div className="login-panel__heading">
            <p className="login-panel__eyebrow">Start booking</p>
            <h2 id="register-title">Create your student account</h2>
            <p>Use your university email and choose a password.</p>
          </div>

          <RegisterForm redirectTo={redirectTo} />

          <p className="auth-switch">
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(redirectTo)}`}>
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
