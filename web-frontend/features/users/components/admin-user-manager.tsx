"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { PeopleIcon, SearchIcon, ShieldCheckIcon } from "@/components/icons";
import { LogoutButton } from "@/features/auth/components/logout-button";
import type { User, UserRole } from "@/features/auth/types";
import {
  updateUserRole,
  updateUserStatus,
  UserMutationError,
} from "../api/browser";
import type { AdminUser, AdminUserFilters, AdminUserPage } from "../types";
import styles from "./admin-user-manager.module.css";

const roleLabels: Record<UserRole, string> = {
  student: "Student",
  staff: "Staff",
  admin: "Administrator",
};

type PendingChange =
  | { kind: "role"; user: AdminUser; role: UserRole }
  | { kind: "status"; user: AdminUser; isActive: boolean };

function directoryHref(filters: AdminUserFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/users${query ? `?${query}` : ""}`;
}

export function AdminUserManager({
  currentUser,
  directory,
  filters,
}: {
  currentUser: User;
  directory: AdminUserPage;
  filters: AdminUserFilters;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(directory.items);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const range = useMemo(() => {
    if (directory.total === 0) return "No accounts";
    const start = (directory.page - 1) * directory.pageSize + 1;
    const end = start + users.length - 1;
    return `${start}–${end} of ${directory.total} accounts`;
  }, [directory, users.length]);

  function beginRole(user: AdminUser, role: UserRole) {
    if (role === user.role) return;
    setError(null);
    setResult(null);
    setPending({ kind: "role", user, role });
  }

  function beginStatus(user: AdminUser) {
    setError(null);
    setResult(null);
    setPending({ kind: "status", user, isActive: !user.isActive });
  }

  async function confirmChange() {
    if (!pending) return;
    setIsMutating(true);
    setError(null);
    try {
      const updated =
        pending.kind === "role"
          ? await updateUserRole(pending.user.id, pending.role)
          : await updateUserStatus(pending.user.id, pending.isActive);
      setUsers((current) =>
        current.map((user) => (user.id === updated.id ? updated : user)),
      );
      setResult(
        pending.kind === "role"
          ? `${updated.fullName} is now ${roleLabels[updated.role].toLowerCase()}.`
          : `${updated.fullName}'s account is now ${updated.isActive ? "active" : "inactive"}.`,
      );
      setPending(null);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof UserMutationError
          ? caught.message
          : "The account could not be updated.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  function resetPageOnFilter(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const page = form.elements.namedItem("page");
    if (page instanceof HTMLInputElement) page.value = "1";
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandMark />
        <nav aria-label="Administrator sections">
          <Link href="/admin/resources">Resources</Link>
          <Link href="/admin/users" aria-current="page">Users</Link>
        </nav>
        <div className={styles.identity}>
          <span><strong>{currentUser.fullName}</strong><small>Administrator</small></span>
          <LogoutButton className={styles.logout} errorClassName={styles.logoutError} />
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.intro} aria-labelledby="user-admin-title">
          <div>
            <p className={styles.context}>Campus access directory</p>
            <h1 id="user-admin-title">Put the right access in the right hands</h1>
            <p>Search USTH accounts, assign operational roles, and suspend access without deleting booking history.</p>
          </div>
          <div className={styles.accessPrinciple}>
            <ShieldCheckIcon />
            <p><strong>Protected administration</strong><span>Your own role and access cannot be changed here.</span></p>
          </div>
        </section>

        <form className={styles.filters} method="get" action="/admin/users" onSubmit={resetPageOnFilter}>
          <label className={styles.searchField}>
            <span>Search users</span>
            <span><SearchIcon /><input name="q" type="search" defaultValue={filters.q} maxLength={120} placeholder="Name or @usth.edu.vn email" /></span>
          </label>
          <label><span>Role</span><select name="role" defaultValue={filters.role ?? ""}><option value="">All roles</option><option value="student">Students</option><option value="staff">Staff</option><option value="admin">Administrators</option></select></label>
          <label><span>Access</span><select name="status" defaultValue={filters.status ?? ""}><option value="">All accounts</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <input type="hidden" name="page" value="1" />
          <button type="submit">Search directory</button>
          {(filters.q || filters.role || filters.status) && <Link href="/admin/users">Clear filters</Link>}
        </form>

        {result && <p ref={resultRef} className={styles.result} role="status" tabIndex={-1}>{result}</p>}
        {error && <p className={styles.error} role="alert">{error}{error.includes("session") && <> <Link href="/login?next=/admin/users">Sign in again</Link>.</>}</p>}

        <section className={styles.directory} aria-labelledby="directory-title">
          <div className={styles.sectionHeading}>
            <div><p className={styles.context}>Identity and permissions</p><h2 id="directory-title">User directory</h2></div>
            <p>{range}</p>
          </div>

          {users.length === 0 ? (
            <div className={styles.empty}><PeopleIcon /><h3>No matching accounts</h3><p>Try a broader name, email, role, or access filter.</p><Link href="/admin/users">View all users</Link></div>
          ) : (
            <div className={styles.tableWrap} role="region" aria-label="Scrollable user directory" tabIndex={0}>
              <table>
                <caption className={styles.srOnly}>USTH user accounts and access controls</caption>
                <thead><tr><th scope="col">Account</th><th scope="col">Joined</th><th scope="col">Role</th><th scope="col">Access</th></tr></thead>
                <tbody>{users.map((user) => {
                  const self = user.id === currentUser.id;
                  return <tr key={user.id} data-active={user.isActive}>
                    <td><div className={styles.account}><span aria-hidden="true">{user.fullName.slice(0, 1).toUpperCase()}</span><p><strong>{user.fullName}</strong><small>{user.email}</small>{self && <em>Current administrator</em>}</p></div></td>
                    <td><strong>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(user.createdAt))}</strong><small>Account created</small></td>
                    <td><label className={styles.control}><span className={styles.srOnly}>Role for {user.fullName}</span><select value={user.role} disabled={self || isMutating} onChange={(event) => beginRole(user, event.target.value as UserRole)}><option value="student">Student</option><option value="staff">Staff</option><option value="admin">Administrator</option></select></label></td>
                    <td><div className={styles.access}><span data-active={user.isActive}>{user.isActive ? "Active" : "Inactive"}</span><button type="button" disabled={self || isMutating} onClick={() => beginStatus(user)}>{user.isActive ? "Deactivate" : "Activate"}</button></div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}

          {directory.totalPages > 1 && <nav className={styles.pagination} aria-label="User directory pages"><Link aria-disabled={directory.page === 1} tabIndex={directory.page === 1 ? -1 : undefined} href={directoryHref(filters, Math.max(1, directory.page - 1))}>Previous</Link><span>Page {directory.page} of {directory.totalPages}</span><Link aria-disabled={directory.page === directory.totalPages} tabIndex={directory.page === directory.totalPages ? -1 : undefined} href={directoryHref(filters, Math.min(directory.totalPages, directory.page + 1))}>Next</Link></nav>}
        </section>
      </div>

      {pending && <div className={styles.overlay} role="presentation"><div ref={confirmRef} className={styles.confirmation} role="alertdialog" aria-modal="true" aria-labelledby="change-title" aria-describedby="change-description" tabIndex={-1}><p className={styles.context}>Confirm access change</p><h2 id="change-title">{pending.kind === "role" ? `Assign ${roleLabels[pending.role]} role?` : `${pending.isActive ? "Activate" : "Deactivate"} this account?`}</h2><p id="change-description">{pending.kind === "role" ? `${pending.user.fullName} will receive ${roleLabels[pending.role].toLowerCase()} permissions on their next request.` : pending.isActive ? `${pending.user.fullName} will be able to sign in and use their assigned role again.` : `${pending.user.fullName} will be signed out on their next request. Their bookings and history will remain recorded.`}</p><div><button type="button" disabled={isMutating} onClick={() => setPending(null)}>Keep current access</button><button type="button" disabled={isMutating} onClick={() => void confirmChange()}>{isMutating ? "Saving…" : "Confirm change"}</button></div>{error && <p className={styles.error} role="alert">{error}</p>}</div></div>}
    </main>
  );
}
