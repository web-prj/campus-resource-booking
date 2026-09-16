import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LogoutButton } from "@/features/auth/components/logout-button";
import type { User } from "@/features/auth/types";
import type { AnalyticsSummary } from "../types";
import styles from "./admin-analytics.module.css";

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  no_show: "No-show",
  rejected: "Rejected",
  cancelled: "Cancelled",
} as const;

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

export function AdminAnalytics({ user, summary }: { user: User; summary: AnalyticsSummary }) {
  const peakMax = Math.max(...summary.peakHours.map((item) => item.bookingCount), 1);
  const statusMax = Math.max(...summary.statuses.map((item) => item.count), 1);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandMark />
        <nav aria-label="Administrator sections">
          <Link href="/admin/resources">Resources</Link>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/analytics" aria-current="page">Analytics</Link>
        </nav>
        <div className={styles.identity}>
          <span><strong>{user.fullName}</strong><small>Administrator</small></span>
          <LogoutButton className={styles.logout} errorClassName={styles.logoutError} />
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.intro} aria-labelledby="analytics-title">
          <div>
            <p className={styles.context}>Campus operations evidence</p>
            <h1 id="analytics-title">See where campus time is being reserved</h1>
            <p>Compare demand, outcomes, and scheduled use across rooms, laboratories, and equipment.</p>
          </div>
          <p className={styles.rangeText}><strong>{displayDate(summary.from)}–{displayDate(summary.to)}</strong><span>Campus dates · ICT (UTC+7)</span></p>
        </section>

        <form className={styles.filters} method="get" action="/admin/analytics">
          <label><span>From</span><input type="date" name="from" defaultValue={summary.from} required /></label>
          <label><span>To</span><input type="date" name="to" defaultValue={summary.to} required /></label>
          <button type="submit">Update analytics</button>
          <Link href="/admin/analytics">Last 30 campus days</Link>
        </form>

        <section className={styles.summary} aria-label="Booking analytics summary">
          <article className={styles.primaryMetric}>
            <span>Total requests</span><strong>{summary.totalBookings}</strong>
            <p>Every booking request scheduled in this range.</p>
          </article>
          <article><span>Cancellation rate</span><strong>{summary.cancellationRate.toFixed(1)}%</strong><p>{summary.cancelledBookings} cancelled of {summary.totalBookings} total.</p></article>
          <article><span>Scheduled utilization</span><strong>{summary.utilizationRate === null ? "Not available" : `${summary.utilizationRate.toFixed(1)}%`}</strong><p>{summary.capacityHours === 0 ? "No active resource capacity in this range." : `${summary.scheduledHours} of ${summary.capacityHours} operating hours.`}</p></article>
          <article><span>Resources reserved</span><strong>{summary.resourcesRepresented}</strong><p>Catalog resources with scheduled demand.</p></article>
        </section>

        {summary.totalBookings === 0 ? (
          <section className={styles.empty} aria-labelledby="empty-title">
            <p className={styles.context}>No scheduled requests</p>
            <h2 id="empty-title">No bookings fall inside this range</h2>
            <p>Choose another date range to compare booking outcomes and resource demand.</p>
          </section>
        ) : (
          <>
            <div className={styles.analysisGrid}>
              <section className={styles.panel} aria-labelledby="status-title">
                <div className={styles.panelHeading}><div><p className={styles.context}>Request outcomes</p><h2 id="status-title">Booking status breakdown</h2></div><span>{summary.totalBookings} total</span></div>
                <ul className={styles.statusList}>{summary.statuses.map((item) => <li key={item.status}><span>{STATUS_LABELS[item.status]}</span><div aria-hidden="true"><i style={{ "--value": `${(item.count / statusMax) * 100}%` } as React.CSSProperties} /></div><strong>{item.count}</strong><small>{item.percentage.toFixed(1)}%</small></li>)}</ul>
              </section>

              <section className={styles.panel} aria-labelledby="peak-title">
                <div className={styles.panelHeading}><div><p className={styles.context}>Operating-day rhythm</p><h2 id="peak-title">Peak booking hours</h2></div><span>Concurrent scheduled bookings</span></div>
                {summary.peakHours.length ? <div className={styles.hourChart} role="img" aria-label={summary.peakHours.map((item) => `${item.label}: ${item.bookingCount} bookings`).join(", ")}>
                  {summary.peakHours.map((item) => <div key={item.hour}><span>{item.bookingCount}</span><i style={{ "--value": `${Math.max(8, (item.bookingCount / peakMax) * 100)}%` } as React.CSSProperties} /><small>{item.label}</small></div>)}
                </div> : <p className={styles.inlineEmpty}>No scheduled occupancy hours in this range.</p>}
              </section>
            </div>

            <section className={styles.ranking} aria-labelledby="popular-title">
              <div className={styles.panelHeading}><div><p className={styles.context}>Resource demand</p><h2 id="popular-title">Most-booked resources</h2></div><span>Cancelled and rejected requests excluded</span></div>
              {summary.popularResources.length ? <ol>{summary.popularResources.map((resource, index) => <li key={resource.id}><span>{index + 1}</span><div><strong>{resource.name}</strong><small>{resource.code} · {resource.building}</small></div><p><strong>{resource.bookingCount}</strong><span>bookings</span></p><p><strong>{resource.bookedHours}</strong><span>hours</span></p></li>)}</ol> : <p className={styles.inlineEmpty}>No resources have scheduled occupancy in this range.</p>}
            </section>
          </>
        )}

        <aside className={styles.definition} aria-labelledby="definition-title"><div><p className={styles.context}>How to read this report</p><h2 id="definition-title">Metric definitions</h2></div><p>{summary.definition}</p></aside>
      </div>
    </main>
  );
}
