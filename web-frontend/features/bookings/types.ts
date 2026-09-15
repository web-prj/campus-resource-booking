export type BookingStatus = "pending" | "confirmed";

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
  status: BookingStatus;
  createdAt: string;
}
