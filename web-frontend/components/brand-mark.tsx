import Link from "next/link";

interface BrandMarkProps {
  compact?: boolean;
  href?: string;
  inverse?: boolean;
}

export function BrandMark({
  compact = false,
  href = "/",
  inverse = false,
}: BrandMarkProps) {
  return (
    <Link
      className={`brand-mark${inverse ? " brand-mark--inverse" : ""}`}
      href={href}
      prefetch={false}
      aria-label="Campus Resource Booking home"
    >
      <svg
        className="brand-mark__symbol"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <path className="brand-mark__frame" d="M7 7h24v24H7z" />
        <path className="brand-mark__room" d="M17 17h24v24H17z" />
        <path className="brand-mark__slot" d="M17 17h14v14H17z" />
        <circle className="brand-mark__signal" cx="37" cy="11" r="4" />
      </svg>
      {!compact && (
        <span className="brand-mark__copy">
          <strong>Campus</strong>
          <span>Resource Booking</span>
        </span>
      )}
    </Link>
  );
}
