import { RouteState } from "@/components/route-state";

export default function Loading() {
  return (
    <RouteState
      busy
      eyebrow="Loading live campus data"
      title="Preparing your workspace"
      description="Fetching the latest campus information for this page. Nothing is being changed while it loads."
    />
  );
}
