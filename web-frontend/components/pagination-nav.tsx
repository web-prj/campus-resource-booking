import Link from "next/link";
import styles from "./pagination-nav.module.css";

interface PaginationNavProps {
  /** Accessible name for the navigation landmark, e.g. "Resource pages". */
  label: string;
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  /** Show a compact window of numbered page links. */
  showPageLinks?: boolean;
  /** Show the "Page X of Y" position text inside the navigation. */
  showPosition?: boolean;
  className?: string;
}

function pageWindow(page: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(page - 1, totalPages - 2));
  const end = Math.min(totalPages, start + 2);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) =>
    Math.max(1, start + index),
  );
}

export function PaginationNav({
  label,
  page,
  totalPages,
  hrefFor,
  showPageLinks = false,
  showPosition = true,
  className,
}: PaginationNavProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      className={className ? `${styles.pagination} ${className}` : styles.pagination}
      aria-label={label}
    >
      {page > 1 ? (
        <Link className={styles.step} href={hrefFor(page - 1)} rel="prev" prefetch={false}>
          Previous
        </Link>
      ) : (
        <span className={styles.step} aria-disabled="true">
          Previous
        </span>
      )}

      {showPageLinks && (
        <div className={styles.numbers}>
          {pageWindow(page, totalPages).map((number) => (
            <Link
              href={hrefFor(number)}
              aria-current={number === page ? "page" : undefined}
              prefetch={false}
              key={number}
            >
              {number}
            </Link>
          ))}
        </div>
      )}

      {showPosition && (
        <span className={styles.position}>
          Page {page} of {totalPages}
        </span>
      )}

      {page < totalPages ? (
        <Link className={styles.step} href={hrefFor(page + 1)} rel="next" prefetch={false}>
          Next
        </Link>
      ) : (
        <span className={styles.step} aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
}
