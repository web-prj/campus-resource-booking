import type { UserRole } from "@/features/auth/types";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserPage {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminUserFilters {
  q?: string;
  role?: UserRole;
  status?: "active" | "inactive";
  page?: number;
}
