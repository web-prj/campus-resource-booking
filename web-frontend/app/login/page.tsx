import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/features/auth/components/login-form";
import {
  CheckIcon,
  ChevronLeftIcon,
  EquipmentIcon,
  LaboratoryIcon,
  RoomIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { getSafeRedirect } from "@/features/auth/routing";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in with your USTH account to access campus resources.",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = getSafeRedirect(params.next);

  return (
    <main className="login-page">
      <section className="login-showcase" aria-labelledby="login-showcase-title">
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
              Campus access
            </p>
            <h1 id="login-showcase-title">
              Everything you need, one sign-in away.
            </h1>
            <p>
              Check live availability, reserve with confidence, and keep every
              campus booking in view.
            </p>
          </div>

          <div className="login-resource-stack" aria-label="Available resource types">
            <div className="login-resource-card login-resource-card--first">
              <span><RoomIcon /></span>
              <div><strong>Study room A101</strong><small>Open at 10:00</small></div>
              <CheckIcon />
            </div>
            <div className="login-resource-card login-resource-card--second">
              <span><LaboratoryIcon /></span>
              <div><strong>Biology lab B204</strong><small>Approval required</small></div>
              <span className="login-resource-card__status">Pending</span>
            </div>
            <div className="login-resource-card login-resource-card--third">
              <span><EquipmentIcon /></span>
              <div><strong>Projector kit P-12</strong><small>Available today</small></div>
              <CheckIcon />
            </div>
          </div>

          <p className="login-showcase__footnote">
            <ShieldCheckIcon /> Protected access for USTH students and staff
          </p>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel__inner">
          <Link className="back-link" href="/">
            <ChevronLeftIcon width={18} height={18} />
            Back to overview
          </Link>

          <div className="login-panel__heading">
            <p className="login-panel__eyebrow">Welcome back</p>
            <h2 id="login-title">Sign in to your account</h2>
            <p>Use your university credentials to continue.</p>
          </div>

          <LoginForm redirectTo={redirectTo} />

          <div className="login-panel__help">
            <span />
            <p>
              Having trouble signing in? Visit the{" "}
              <a
                href="https://usth.edu.vn/lien-he/"
                target="_blank"
                rel="noreferrer"
              >
                USTH contact page
              </a>{" "}
              for account support.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
