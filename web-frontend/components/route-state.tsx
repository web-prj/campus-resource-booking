import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

interface RouteStateProps {
  action?: React.ReactNode;
  description: string;
  eyebrow: string;
  title: string;
  busy?: boolean;
  announceAs?: "alert" | "status";
}

export function RouteState({
  action,
  description,
  eyebrow,
  title,
  busy = false,
  announceAs,
}: RouteStateProps) {
  return (
    <main className="route-state" aria-busy={busy || undefined}>
      <header className="route-state__header">
        <BrandMark />
        <Link href="/dashboard">Return to workspace</Link>
      </header>
      <section
        className="route-state__panel"
        aria-labelledby="route-state-title"
        aria-live={busy ? "polite" : undefined}
        role={announceAs}
      >
        <div className="route-state__signal" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="route-state__eyebrow">{eyebrow}</p>
          <h1 id="route-state-title">{title}</h1>
          <p>{description}</p>
        </div>
        {action && <div className="route-state__actions">{action}</div>}
      </section>
    </main>
  );
}
