import Link from "next/link";
import { AvailabilityRibbon } from "@/components/availability-ribbon";
import { BrandMark } from "@/components/brand-mark";
import { GlassPanel } from "@/components/glass-panel";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  EquipmentIcon,
  LaboratoryIcon,
  PeopleIcon,
  RoomIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersIcon,
  StatusIcon,
} from "@/components/icons";
import { SiteHeader } from "@/components/site-header";

const resources = [
  {
    eyebrow: "Focus",
    title: "Study rooms",
    description:
      "Find a quiet room by building, time, and group size — before your team arrives.",
    meta: "Capacity-aware",
    icon: RoomIcon,
    className: "resource-card--room",
  },
  {
    eyebrow: "Research",
    title: "Laboratories",
    description:
      "Request specialist spaces with approval requirements made clear from the start.",
    meta: "Approval-ready",
    icon: LaboratoryIcon,
    className: "resource-card--lab",
  },
  {
    eyebrow: "Create",
    title: "Equipment",
    description:
      "Reserve projectors, cameras, and shared kits for exactly the time you need them.",
    meta: "Time-slot booking",
    icon: EquipmentIcon,
    className: "resource-card--equipment",
  },
] as const;

const workflow = [
  {
    number: "01",
    title: "Discover the right fit",
    description:
      "Filter by date, time, building, capacity, resource type, or available equipment.",
    icon: SearchIcon,
  },
  {
    number: "02",
    title: "Reserve with confidence",
    description:
      "Choose an open slot. Conflict checks protect it from overlapping reservations.",
    icon: ShieldCheckIcon,
  },
  {
    number: "03",
    title: "Follow every status",
    description:
      "See pending and confirmed requests, check in, cancel, and revisit booking history.",
    icon: StatusIcon,
  },
] as const;

const roleCards = [
  {
    role: "Students",
    title: "Less searching. More doing.",
    description:
      "Book the space or equipment your work needs, then keep every request in one place.",
    tags: ["Search", "Book", "Check in"],
  },
  {
    role: "Staff",
    title: "Keep campus use moving.",
    description:
      "Review requests, confirm arrivals and check-outs, and resolve operational issues.",
    tags: ["Approve", "Confirm", "Resolve"],
  },
  {
    role: "Administrators",
    title: "See the whole system.",
    description:
      "Manage rooms, equipment, and users while monitoring demand and utilization.",
    tags: ["Manage", "Measure", "Improve"],
  },
] as const;

export default function HomePage() {
  return (
    <div className="landing-page">
      <SiteHeader />

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__atmosphere" aria-hidden="true">
            <span className="hero__orb hero__orb--one" />
            <span className="hero__orb hero__orb--two" />
            <span className="hero__grid" />
          </div>
          <div className="page-shell hero__inner">
            <div className="hero__copy">
              <p className="section-kicker section-kicker--light">
                <span className="section-kicker__dot" />
                One campus. Every resource.
              </p>
              <h1 id="hero-title">Your next room is already waiting.</h1>
              <p className="hero__lead">
                Find and reserve USTH study rooms, laboratories, and equipment
                with availability you can trust.
              </p>
              <div className="hero__actions">
                <Link className="button button--primary" href="/register">
                  Create student account
                  <ArrowRightIcon width={20} height={20} />
                </Link>
                <Link className="button button--glass" href="/login">
                  Sign in
                </Link>
              </div>
              <div className="hero__assurance" aria-label="Booking benefits">
                <span>
                  <CheckIcon /> Conflict-aware
                </span>
                <span>
                  <CheckIcon /> Campus access
                </span>
                <span>
                  <CheckIcon /> Status tracking
                </span>
              </div>
            </div>

            <GlassPanel className="hero__visual" tone="dark">
              <div className="hero__visual-label" aria-hidden="true">
                <span>Availability</span>
                <span>Rooms · Labs · Equipment</span>
              </div>
              <AvailabilityRibbon />
            </GlassPanel>
          </div>
          <div className="hero__edge" aria-hidden="true" />
        </section>

        <section className="resource-section" id="resources" aria-labelledby="resources-title">
          <div className="page-shell">
            <div className="section-heading section-heading--split">
              <div>
                <p className="section-kicker">
                  <span className="section-kicker__line" />
                  Built around campus life
                </p>
                <h2 id="resources-title">
                  The right resource,<br />right when you need it.
                </h2>
              </div>
              <p>
                Stop moving between spreadsheets, group chats, and office desks.
                Search every shared resource from one clear view.
              </p>
            </div>

            <div className="resource-grid">
              {resources.map(({ icon: Icon, ...resource }) => (
                <article
                  className={`resource-card ${resource.className}`}
                  key={resource.title}
                >
                  <div className="resource-card__topline">
                    <span>{resource.eyebrow}</span>
                    <Icon width={25} height={25} />
                  </div>
                  <div className="resource-card__figure" aria-hidden="true">
                    <Icon />
                    <span className="resource-card__pulse" />
                  </div>
                  <h3>{resource.title}</h3>
                  <p>{resource.description}</p>
                  <span className="resource-card__meta">
                    <CheckIcon width={16} height={16} /> {resource.meta}
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="workflow-section" id="workflow" aria-labelledby="workflow-title">
          <div className="workflow-section__glow" aria-hidden="true" />
          <div className="page-shell workflow-section__inner">
            <div className="section-heading section-heading--center">
              <p className="section-kicker section-kicker--light">
                <span className="section-kicker__dot" />
                A clear path to booked
              </p>
              <h2 id="workflow-title">From “where?” to reserved.</h2>
              <p>
                Three focused steps keep the process quick and every decision visible.
              </p>
            </div>

            <div className="workflow-grid">
              {workflow.map(({ icon: Icon, ...step }, index) => (
                <article className="workflow-card" key={step.number}>
                  <div className="workflow-card__head">
                    <span className="workflow-card__number">{step.number}</span>
                    <span className="workflow-card__icon">
                      <Icon />
                    </span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  {index < workflow.length - 1 && (
                    <span className="workflow-card__connector" aria-hidden="true">
                      <ArrowRightIcon />
                    </span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="confidence-section" aria-labelledby="confidence-title">
          <div className="page-shell confidence-grid">
            <div className="confidence-visual" aria-hidden="true">
              <div className="confidence-visual__orbit confidence-visual__orbit--outer" />
              <div className="confidence-visual__orbit confidence-visual__orbit--inner" />
              <div className="confidence-visual__core">
                <ShieldCheckIcon />
                <span>Slot protected</span>
              </div>
              <span className="confidence-visual__node confidence-visual__node--one">
                A101
              </span>
              <span className="confidence-visual__node confidence-visual__node--two">
                10:00
              </span>
              <span className="confidence-visual__node confidence-visual__node--three">
                Confirmed
              </span>
            </div>

            <div className="confidence-copy">
              <h2 id="confidence-title">A booking should mean it is yours.</h2>
              <p className="confidence-copy__lead">
                Availability checks and conflict prevention work together, so two
                requests cannot quietly claim the same resource at the same time.
              </p>
              <ul className="confidence-list">
                <li>
                  <span><SlidersIcon /></span>
                  <div>
                    <strong>Search with the details that matter</strong>
                    <p>Capacity, building, equipment, date, and time.</p>
                  </div>
                </li>
                <li>
                  <span><ShieldCheckIcon /></span>
                  <div>
                    <strong>Know each request’s real status</strong>
                    <p>Pending, confirmed, checked in, cancelled, or complete.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="roles-section" id="roles" aria-labelledby="roles-title">
          <div className="page-shell">
            <div className="section-heading section-heading--split section-heading--roles">
              <div>
                <h2 id="roles-title">A useful view for every role.</h2>
              </div>
              <PeopleIcon className="roles-section__heading-icon" />
            </div>

            <div className="roles-grid">
              {roleCards.map((item) => (
                <article className="role-card" key={item.role}>
                  <p className="role-card__role">{item.role}</p>
                  <h3>{item.title}</h3>
                  <p className="role-card__description">{item.description}</p>
                  <div className="role-card__tags">
                    {item.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta" aria-labelledby="cta-title">
          <div className="page-shell">
            <div className="final-cta__panel">
              <div className="final-cta__pattern" aria-hidden="true" />
              <div className="final-cta__copy">
                <h2 id="cta-title">Ready to find your space?</h2>
                <p>
                  Create a student account with your USTH email, or sign in if
                  you already have one.
                </p>
              </div>
              <div className="final-cta__actions">
                <Link className="button button--primary final-cta__button" href="/register">
                  Create account
                  <ArrowUpRightIcon width={20} height={20} />
                </Link>
                <Link className="button button--glass final-cta__button" href="/login">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-shell site-footer__inner">
          <BrandMark />
          <p>A clearer way to share the spaces and tools that power campus life.</p>
          <div className="site-footer__links">
            <a href="#resources">Resources</a>
            <a href="#workflow">How it works</a>
            <Link href="/register">Create account</Link>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
