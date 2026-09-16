import type { BookingStatus } from "@/features/bookings/types";

export interface AnalyticsStatus {
  status: BookingStatus;
  count: number;
  percentage: number;
}

export interface PopularResource {
  id: string;
  code: string;
  name: string;
  building: string;
  bookingCount: number;
  bookedHours: number;
}

export interface PeakHour {
  hour: number;
  label: string;
  bookingCount: number;
}

export interface AnalyticsSummary {
  from: string;
  to: string;
  timeZone: "Asia/Ho_Chi_Minh";
  totalBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  scheduledHours: number;
  capacityHours: number;
  utilizationRate: number | null;
  resourcesRepresented: number;
  statuses: AnalyticsStatus[];
  popularResources: PopularResource[];
  peakHours: PeakHour[];
  definition: string;
}

export interface AnalyticsRange {
  from: string;
  to: string;
}
