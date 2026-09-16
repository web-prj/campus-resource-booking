import { RouteState } from "@/components/route-state";

export default function Loading() {
  return (
    <RouteState
      busy
      eyebrow="Loading live campus data"
      title="Preparing your workspace"
      description="Fetching the latest resources, availability, bookings, and operational updates. Nothing is being changed while this page loads."
    />
  );
}
