"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboardUpdates } from "@/lib/realtime/use-dashboard-updates";
import styles from "./dashboard-live-region.module.css";

interface DashboardLiveRegionProps {
  campusDate: string;
}

export function DashboardLiveRegion({ campusDate }: DashboardLiveRegionProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  const handleUpdate = useCallback(() => {
    setNotice("Campus availability refreshed.");
    router.refresh();
  }, [router]);

  useDashboardUpdates(campusDate, handleUpdate);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);



  return (
    <div role="status" aria-live="polite">
      {notice && <p className={styles.notice}>{notice}</p>}
    </div>
  );
}
