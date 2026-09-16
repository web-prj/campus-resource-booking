import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import { getAdminResourceCatalog } from "@/features/resources/api/server";
import { AdminResourceManager } from "@/features/resources/components/admin-resource-manager";

export const metadata: Metadata = {
  title: "Manage resources",
  description: "Manage campus rooms, laboratories, and equipment.",
};

export default async function AdminResourcesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/resources");
  if (user.role !== "admin") redirect("/dashboard");

  const catalog = await getAdminResourceCatalog();
  return <AdminResourceManager user={user} {...catalog} />;
}
