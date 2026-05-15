export type CourseStatus = "available" | "full" | "closed";

export type AttendanceStatus = "pending" | "attended" | "absent";

export type ReservationStatus = "booked" | "cancelled";

export type CourseCategory = {
  id: string;
  code?: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
};

export type CourseSession = {
  id: string;
  courseId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  bookedCount: number;
  bookingDeadline: string;
  isActive: boolean;
  topic?: string;
};

export type Course = {
  id: string;
  code?: string;
  courseType?: string;
  title: string;
  categoryId: string;
  description: string;
  defaultLocation: string;
  notes: string;
  isActive: boolean;
  sessions: CourseSession[];
};

export type Reservation = {
  id: string;
  courseId: string;
  sessionId: string;
  studentName: string;
  phoneLastThree: string;
  bookedAt: string;
  cancelledAt?: string;
  status: ReservationStatus;
  attendanceStatus: AttendanceStatus;
};

export type Student = {
  id: string;
  classId?: string;
  examGroup: string;
  seatNumber: number;
  name: string;
  source: string;
  note?: string;
  needsReview?: boolean;
  isActive?: boolean;
};

export type BookingData = {
  categories: CourseCategory[];
  courses: Course[];
  reservations: Reservation[];
  students?: Student[];
};
