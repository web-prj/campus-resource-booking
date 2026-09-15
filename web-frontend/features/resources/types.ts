export type ResourceType = "room" | "laboratory" | "equipment";
export type ResourceStatus = "active" | "maintenance" | "inactive";
export type ResourceSort = "name_asc" | "capacity_asc" | "capacity_desc";
export type AvailabilityBlockedReason =
  | "maintenance"
  | "inactive"
  | "closure"
  | "closed_day";

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
}

export interface ResourceAvailability {
  resourceId: string;
  date: string;
  timeZone: "Asia/Ho_Chi_Minh";
  opensAt: string;
  closesAt: string;
  blockedReason: AvailabilityBlockedReason | null;
  closureReason: string | null;
  requiresApproval: boolean;
  slots: AvailabilitySlot[];
}

export interface ResourceClosure {
  id: string;
  resourceId: string;
  date: string;
  reason: string;
  createdAt: string;
}

export interface Building {
  id: string;
  code: string;
  name: string;
  address: string;
}

export interface Resource {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: ResourceType;
  status: ResourceStatus;
  capacity: number;
  location: string;
  amenities: string[];
  requiresApproval: boolean;
  operatingDays: number[];
  opensAt: string;
  closesAt: string;
  building: Building;
  createdAt: string;
  updatedAt: string;
}

export interface ResourcePage {
  items: Resource[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ResourceDiscoveryFilters {
  q?: string;
  buildingId?: string;
  type?: ResourceType;
  minCapacity?: number;
  amenity?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  sort?: ResourceSort;
  page?: number;
}

export interface ResourceInput {
  code: string;
  name: string;
  description: string;
  type: ResourceType;
  capacity: number;
  location: string;
  amenities?: string[];
  requiresApproval?: boolean;
  operatingDays?: number[];
  opensAt?: string;
  closesAt?: string;
  buildingId: string;
}
