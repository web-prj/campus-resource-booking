import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import { adminResourcesHref } from "@/features/resources/admin-query";
import { getAdminResourceCatalog } from "@/features/resources/api/server";
import { AdminResourceManager } from "@/features/resources/components/admin-resource-manager";
import { loginRedirectPath, withSessionRedirect } from "@/lib/api/session";
import { lastPageFor, parsePageParam } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Manage resources",
  description: "Manage campus rooms, laboratories, and equipment.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const requestedPage = parsePageParam((await searchParams).page);
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(adminResourcesHref(requestedPage)));
  if (user.role !== "admin") redirect("/dashboard");

  const catalog = await withSessionRedirect(adminResourcesHref(requestedPage), () =>
    getAdminResourceCatalog(requestedPage),
  );
  const lastPage = lastPageFor(catalog.page.totalPages);
  if (requestedPage > lastPage) redirect(adminResourcesHref(lastPage));

  return <AdminResourceManager user={user} {...catalog} />;
}
