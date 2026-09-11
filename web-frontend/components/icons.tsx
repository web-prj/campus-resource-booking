import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const sharedProps: IconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function EquipmentIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <rect x="3.5" y="4" width="17" height="11.5" rx="2" />
      <path d="M8 20h8M12 15.5V20M8 8h8" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="m3 3 18 18" />
      <path d="M10.6 6.7A9 9 0 0 1 12 6.5c6 0 9.5 5.5 9.5 5.5a16 16 0 0 1-2 2.6M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 5.5 9.5 5.5a9.5 9.5 0 0 0 3.2-.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function LaboratoryIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M9 3h6M10 3v6l-5 8.2A2.5 2.5 0 0 0 7.1 21h9.8a2.5 2.5 0 0 0 2.1-3.8L14 9V3" />
      <path d="M7.5 15h9" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19" />
      <path d="M15 5.4a3 3 0 0 1 0 5.2M16.5 13.4a4.5 4.5 0 0 1 4 4.5V19" />
    </svg>
  );
}

export function RoomIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
      <path d="M8 21V8h8v13M2 21h20M13 14h.01" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  );
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  );
}

export function StatusIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M4 5h16M4 12h10M4 19h7" />
      <circle cx="18" cy="15" r="3" />
      <path d="m16.7 15 1 1 1.8-2" />
    </svg>
  );
}
