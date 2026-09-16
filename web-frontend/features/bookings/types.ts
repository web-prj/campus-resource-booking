export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "no_show"
  | "rejected"
  | "cancelled";

export type ActiveBookingStatus = "pending" | "confirmed";

export interface BookingResourceSummary {
  id: string;
  code: string;
  name: string;
  type: "room" | "laboratory" | "equipment";
  location: string;
  buildingCode: string;
  buildingName: string;
}

export interface StudentBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: "Asia/Ho_Chi_Minh";
  status: BookingStatus;
  canCancel: boolean;
  canRequestCheckIn: boolean;
  hasEnded: boolean;
  checkInCode: string | null;
  checkInRequestedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  noShowAt: string | null;
  cancelledAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  resource: BookingResourceSummary;
}

export interface StudentBookingTimeline {
  upcoming: StudentBooking[];
  history: StudentBooking[];
}

export interface BookingRequestInput {
  resourceId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface BookingRequestResult extends BookingRequestInput {
  id: string;
  requesterId: string;
  timeZone: "Asia/Ho_Chi_Minh";
  status: ActiveBookingStatus;
  createdAt: string;
}

export interface StaffBookingPerson {
  id: string;
  email: string;
  fullName: string;
}

export interface StaffBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: "Asia/Ho_Chi_Minh";
  status: BookingStatus;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  canReview: boolean;
  checkInRequested: boolean;
  canConfirmCheckIn: boolean;
  canCheckOut: boolean;
  canMarkNoShow: boolean;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  noShowAt: string | null;
  resource: BookingResourceSummary;
  requester: StaffBookingPerson;
  reviewer: StaffBookingPerson | null;
}

export interface StaffBookingQueue {
  items: StaffBooking[];
  total: number;
}

export type StaffOperationsQueue = StaffBookingQueue;

export interface StaffResourceSchedule {
  resourceId: string;
  date: string;
  bookings: StaffBooking[];
}
