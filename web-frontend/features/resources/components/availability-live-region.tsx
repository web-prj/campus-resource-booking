"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAvailabilityUpdates } from "@/lib/realtime/use-availability-updates";
import styles from "./availability-live-region.module.css";

interface AvailabilityLiveRegionProps {
  resourceId: string;
  date: string | undefined;
}

export function AvailabilityLiveRegion({
  resourceId,
  date,
}: AvailabilityLiveRegionProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  const handleUpdate = useCallback(() => {
    setNotice("Availability refreshed.");
    router.refresh();
  }, [router]);

  useAvailabilityUpdates(resourceId, date, handleUpdate);

  // Auto-dismiss the notice after 4 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);



  if (!date) return null;

  return (
    <div role="status" aria-live="polite">
      {notice && <p className={styles.notice}>{notice}</p>}
    </div>
  );
}
