import { RouteState } from "@/components/route-state";

export default function ResourcesLoading() {
  return (
    <RouteState
      busy
      eyebrow="Loading live resource data"
      title="Checking the campus directory"
      description="Fetching active rooms, laboratories, equipment, and current availability filters."
    />
  );
}
