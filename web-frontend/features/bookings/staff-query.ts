export interface StaffQueuePages {
  pendingPage: number;
  operationsPage: number;
}

export function staffQueueHref(pages: StaffQueuePages): string {
  const params = new URLSearchParams();
  if (pages.pendingPage > 1) params.set("pendingPage", String(pages.pendingPage));
  if (pages.operationsPage > 1) {
    params.set("operationsPage", String(pages.operationsPage));
  }
  const query = params.toString();
  return query ? `/staff?${query}` : "/staff";
}
