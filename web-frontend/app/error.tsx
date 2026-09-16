"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RouteState } from "@/components/route-state";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const reference = error.digest;
  function retry() {
    reset();
    router.refresh();
  }
  return (
    <RouteState
      announceAs="alert"
      eyebrow="Live data could not be loaded"
      title="This workspace is temporarily unavailable"
      description={`The latest campus data could not be retrieved. Your bookings and account have not been changed.${reference ? ` Support reference: ${reference}.` : ""}`}
      action={
        <>
          <button type="button" onClick={retry}>Try again</button>
          <Link href="/dashboard">Return to dashboard</Link>
        </>
      }
    />
  );
}
