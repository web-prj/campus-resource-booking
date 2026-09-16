import Link from "next/link";
import { RouteState } from "@/components/route-state";

export default function NotFound() {
  return (
    <RouteState
      announceAs="status"
      eyebrow="Page or record not found"
      title="This campus record is not available"
      description="The link may be outdated, the record may belong to another account, or the resource may no longer be listed."
      action={
        <>
          <Link href="/dashboard">Return to dashboard</Link>
          <Link href="/resources">Browse active resources</Link>
        </>
      }
    />
  );
}
