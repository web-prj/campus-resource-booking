"use client";

import Link from "next/link";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { PaginationNav } from "@/components/pagination-nav";
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
  const [total, setTotal] = useState(directory.total);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<UserMutationError["code"] | null>(
    null,
  );
  const [result, setResult] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const range = useMemo(() => {
    if (total === 0) return "No accounts";
    const start = (directory.page - 1) * directory.pageSize + 1;
    const end = start + users.length - 1;
    return `${start}–${end} of ${total} accounts`;
  }, [directory.page, directory.pageSize, total, users.length]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / directory.pageSize);

  function matchesFilters(user: AdminUser): boolean {
    return (
      (!filters.role || user.role === filters.role) &&
      (!filters.status ||
        user.isActive === (filters.status === "active"))
    );
  }

  function beginRole(
    user: AdminUser,
    role: UserRole,
    trigger: HTMLElement,
  ) {
    if (role === user.role) return;
    triggerRef.current = trigger;
    setError(null);
    setErrorCode(null);
    setResult(null);
    setPending({ kind: "role", user, role });
  }

  function beginStatus(user: AdminUser, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setError(null);
    setErrorCode(null);
    setResult(null);
    setPending({ kind: "status", user, isActive: !user.isActive });
  }

  function closeConfirmation() {
    if (isMutating) return;
    setPending(null);
    setError(null);
    setErrorCode(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeConfirmation();
      return;
    }
    if (event.key !== "Tab") return;

    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href]',
      ),
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function confirmChange() {
    if (!pending) return;
    setIsMutating(true);
    setError(null);
    setErrorCode(null);
    try {
      const updated =
        pending.kind === "role"
          ? await updateUserRole(pending.user.id, pending.role)
          : await updateUserStatus(pending.user.id, pending.isActive);
      if (matchesFilters(updated)) {
        setUsers((current) =>
          current.map((user) => (user.id === updated.id ? updated : user)),
        );
      } else {
        setUsers((current) =>
          current.filter((user) => user.id !== updated.id),
        );
        setTotal((current) => Math.max(0, current - 1));
      }
      setResult(
        pending.kind === "role"
          ? `${updated.fullName} is now ${roleLabels[updated.role].toLowerCase()}.`
          : `${updated.fullName}'s account is now ${updated.isActive ? "active" : "inactive"}.`,
      );
      setPending(null);
    } catch (caught) {
      const mutationError =
        caught instanceof UserMutationError ? caught : null;
      setError(
        mutationError?.message ?? "The account could not be updated.",
      );
      setErrorCode(mutationError?.code ?? "unexpected");
      requestAnimationFrame(() => confirmRef.current?.focus());
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
          <Link href="/admin/analytics">Analytics</Link>
          <Link href="/staff">Approvals</Link>
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
        {error && !pending && <p className={styles.error} role="alert">{error}{errorCode === "session" && <> <Link href="/login?next=/admin/users">Sign in again</Link>.</>}</p>}

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
                    <td><label className={styles.control}><span className={styles.srOnly}>Role for {user.fullName}</span><select value={user.role} disabled={self || isMutating} onChange={(event) => beginRole(user, event.target.value as UserRole, event.currentTarget)}><option value="student">Student</option><option value="staff">Staff</option><option value="admin">Administrator</option></select></label></td>
                    <td><div className={styles.access}><span data-active={user.isActive}>{user.isActive ? "Active" : "Inactive"}</span><button type="button" disabled={self || isMutating} onClick={(event) => beginStatus(user, event.currentTarget)}>{user.isActive ? "Deactivate" : "Activate"}</button></div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}

          {directory.page <= totalPages && <PaginationNav className={styles.pagination} label="User directory pages" page={directory.page} totalPages={totalPages} hrefFor={(page) => directoryHref(filters, page)} />}
        </section>
      </div>

      {pending && <div className={styles.overlay} role="presentation"><div ref={confirmRef} className={styles.confirmation} role="alertdialog" aria-modal="true" aria-labelledby="change-title" aria-describedby="change-description" tabIndex={-1} onKeyDown={handleDialogKeyDown}><p className={styles.context}>Confirm access change</p><h2 id="change-title">{pending.kind === "role" ? `Assign ${roleLabels[pending.role]} role?` : `${pending.isActive ? "Activate" : "Deactivate"} this account?`}</h2><p id="change-description">{pending.kind === "role" ? `${pending.user.fullName} will receive ${roleLabels[pending.role].toLowerCase()} permissions on their next request.` : pending.isActive ? `${pending.user.fullName} will be able to sign in and use their assigned role again.` : `${pending.user.fullName} will be signed out on their next request. Their bookings and history will remain recorded.`}</p><div><button type="button" disabled={isMutating} onClick={closeConfirmation}>Keep current access</button><button type="button" disabled={isMutating} onClick={() => void confirmChange()}>{isMutating ? "Saving…" : "Confirm change"}</button></div>{error && <div className={styles.dialogRecovery}><p className={styles.error} role="alert">{error}</p>{errorCode === "session" ? <Link href="/login?next=/admin/users">Sign in again</Link> : errorCode === "validation" || errorCode === "not-found" || errorCode === "forbidden" ? <button type="button" onClick={() => router.refresh()}>Refresh user directory</button> : null}</div>}</div></div>}
    </main>
  );
}
