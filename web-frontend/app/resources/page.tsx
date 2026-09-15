import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import { getResourceDirectory } from "@/features/resources/api/server";
import {
  discoveryHref,
  normalizeDiscoveryFilters,
  type DiscoverySearchParams,
} from "@/features/resources/discovery-query";
import { ResourceDirectory } from "@/features/resources/components/resource-directory";

export const metadata: Metadata = {
  title: "Resource directory",
  description:
    "Search active USTH rooms, laboratories, and equipment by building, capacity, and amenities.",
};

interface ResourcesPageProps {
  searchParams: Promise<DiscoverySearchParams>;
}

export default async function ResourcesPage({
  searchParams,
}: ResourcesPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/resources");

  const filters = normalizeDiscoveryFilters(await searchParams);
  const directory = await getResourceDirectory(filters);

  const lastPage = Math.max(1, directory.page.totalPages);
  if (directory.page.page > lastPage) {
    redirect(discoveryHref(filters, { page: lastPage }));
  }

  return <ResourceDirectory user={user} filters={filters} {...directory} />;
}
