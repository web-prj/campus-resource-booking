import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/server";
import { getAdminUsers } from "@/features/users/api/server";
import { AdminUserManager } from "@/features/users/components/admin-user-manager";
import type { AdminUserFilters } from "@/features/users/types";
import { loginRedirectPath, withSessionRedirect } from "@/lib/api/session";

export const metadata: Metadata = {
  title: "Manage users",
  description: "Search campus accounts and manage access roles.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function usersHref(filters: AdminUserFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/users${query ? `?${query}` : ""}`;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = first(params.q)?.trim().slice(0, 120) || undefined;
  const roleValue = first(params.role);
  const statusValue = first(params.status);
  const parsedPage = Number(first(params.page));
  const filters: AdminUserFilters = {
    q,
    role:
      roleValue === "student" || roleValue === "staff" || roleValue === "admin"
        ? roleValue
        : undefined,
    status:
      statusValue === "active" || statusValue === "inactive"
        ? statusValue
        : undefined,
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };

  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(usersHref(filters, filters.page ?? 1)));
  if (user.role !== "admin") redirect("/dashboard");

  const directory = await withSessionRedirect(
    usersHref(filters, filters.page ?? 1),
    () => getAdminUsers(filters),
  );
  const lastPage = Math.max(1, directory.totalPages);
  if (directory.page > lastPage) {
    redirect(usersHref(filters, lastPage));
  }
  return (
    <AdminUserManager
      currentUser={user}
      directory={directory}
      filters={filters}
    />
  );
}
