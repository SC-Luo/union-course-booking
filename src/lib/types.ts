export type CourseStatus = "available" | "full" | "closed";

export type AttendanceStatus = "pending" | "unchecked" | "attended" | "absent" | "leave";

export type ReservationStatus = "booked" | "cancelled";

export type CourseCapacityMode = "course" | "session";

export type ReservationSource = "online" | "manual" | "excel" | "excel_import";

export type CourseMode = "booking_flexible" | "roster_fixed" | "fixed_roster_exam" | string;

export type CourseCategory = {
  id: string;
  code?: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  color?: string;
};

export type CourseSeries = {
  id: string;
  code?: string;
  title: string;
  name?: string;
  categoryId: string;
  courseType?: string;
  defaultCourseMode?: CourseMode;
  defaultColor?: string;
  defaultCapacity?: number;
  defaultLocation?: string;
  description?: string;
  color?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CourseOffering = {
  id: string;
  seriesId: string;
  courseSeriesId?: string;
  courseMasterId?: string;
  legacyCourseId?: string;
  categoryId?: string;
  code?: string;
  title: string;
  displayTitle?: string;
  displayName?: string;
  shortName?: string;
  year?: number;
  term?: string | number;
  termNumber?: number;
  termLabel?: string;
  classIdentifier?: string;
  classDisplayName?: string;
  rosterType?: "fixed" | "booking" | string;
  courseType?: string;
  courseMode?: CourseMode;
  sourceSheet?: string;
  sourceRocYear?: number;
  sourceWesternYear?: number;
  examDate?: string | null;
  location?: string;
  capacity?: number;
  color?: string;
  startDate?: string;
  endDate?: string;
  bookingOpen?: boolean;
  status?: "active" | "open" | "closed" | "archived" | string;
  entitlementPolicy?: EntitlementPolicy;
  rosterPolicy?: RosterPolicy;
  notes?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CourseSession = {
  id: string;
  courseId: string;
  offeringId?: string;
  seriesId?: string;
  categoryId?: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  bookedCount: number;
  bookingDeadline: string;
  isActive: boolean;
  topic?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CourseSessionRecord = {
  id: string;
  offeringId: string;
  seriesId: string;
  legacyCourseId?: string;
  categoryId?: string;
  title?: string;
  unitName?: string;
  location?: string;
  startsAt?: string;
  endsAt?: string;
  date?: string;
  capacity?: number;
  bookingDeadline?: string;
  status?: string;
  stats?: {
    reservedCount?: number;
    attendedCount?: number;
    absentCount?: number;
    uncheckedCount?: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type EntitlementPolicy = {
  enabled: boolean;
  validMonths: number;
  startFrom: "first_attendance" | string;
};

export type RosterPolicy = {
  requireRosterBeforeAttendance: boolean;
  allowWalkIn: boolean;
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
  color?: string;
  capacityMode?: CourseCapacityMode;
  totalCapacity?: number;
  sessions: CourseSession[];
  seriesId?: string;
  courseSeriesId?: string;
  courseMasterId?: string;
  offeringId?: string;
  year?: number;
  term?: string | number;
  termNumber?: number;
  termLabel?: string;
  displayTitle?: string;
  displayName?: string;
  shortTitle?: string;
  shortName?: string;
  classIdentifier?: string;
  classDisplayName?: string;
  courseMode?: CourseMode;
  rosterType?: string;
  bookingOpen?: boolean;
  status?: string;
  entitlementPolicy?: EntitlementPolicy;
  rosterPolicy?: RosterPolicy;
  createdAt?: string;
  updatedAt?: string;
};

export type Reservation = {
  id: string;
  courseId: string;
  sessionId: string;
  studentName: string;
  phoneLastThree: string;
  idNumberLast3?: string;
  studentId?: string;
  offeringId?: string;
  seriesId?: string;
  reservationType?: string;
  bookedAt: string;
  cancelledAt?: string;
  status: ReservationStatus;
  attendanceStatus: AttendanceStatus;
  source?: ReservationSource;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Student = {
  id: string;
  name: string;
  phone?: string;
  idNumberLast3?: string;
  birthday?: string | null;
  address?: string;
  memberNo?: string;
  memberId?: string;
  externalMemberNo?: string;
  branch?: string;
  note?: string;
  notes?: string;
  source?: string;
  needsReview?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  nationalIdHash?: string;
  registeredAt?: string;
  /** Legacy compatibility only. Formal roster seat number lives on Enrollment.seatNumber. */
  classId?: string;
  /** Legacy compatibility only. Formal roster seat number lives on Enrollment.seatNumber. */
  seatNumber?: number;
  examGroup?: string;
  offeringId?: string;
  seriesId?: string;
  courseMasterId?: string;
  sourceSheet?: string;
  sourceRow?: number;
  classTitle?: string;
  classShortTitle?: string;
  year?: number;
  term?: string | number;
  termLabel?: string;
};

export type EnrollmentStatus = "active" | "withdrawn" | "completed" | "expired" | string;

export type Enrollment = {
  id: string;
  studentId: string;
  courseOfferingId?: string;
  offeringId: string;
  courseId?: string;
  seriesId?: string;
  courseMasterId?: string;
  enrollmentType?: string;
  seatNo?: string;
  seatNumber?: number;
  groupLabel?: string;
  source?: string;
  sourceSheet?: string;
  sourceRow?: number;
  importedBatchId?: string;
  status: EnrollmentStatus;
  joinedAt?: string;
  leftAt?: string;
  notes?: string;
  note?: string;
  year?: number;
  term?: string | number;
  termLabel?: string;
  classDisplayName?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StudentCourseRecordType =
  | "first_attendance_date"
  | "term_code"
  | "marker"
  | "registered_not_started"
  | "absence_or_no_show"
  | "note"
  | "roster"
  | "unknown";

export type StudentCourseRecord = {
  id: string;
  studentId: string;
  seriesId: string;
  offeringId?: string;
  courseId?: string;
  courseMasterId?: string;
  sourceSheet?: string;
  sourceRocYear?: number;
  sourceWesternYear?: number;
  sourceRow?: number;
  sourceColumn: string;
  sourceCell?: string;
  rawValue: string;
  normalizedValue?: string;
  recordType?: StudentCourseRecordType;
  firstAttendanceAt?: string;
  entitlementId?: string;
  enrollmentId?: string;
  importBatchId?: string;
  importedAt?: string;
  note?: string;
  year?: number;
  term?: string | number;
  termLabel?: string;
  classDisplayName?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AttendanceRecord = {
  id: string;
  enrollmentId?: string;
  studentId: string;
  offeringId: string;
  seriesId?: string;
  sessionId: string;
  courseSessionId?: string;
  reservationId?: string;
  source?: string;
  status: Exclude<AttendanceStatus, "pending">;
  checkedAt?: string;
  checkedBy?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Entitlement = {
  id: string;
  studentId: string;
  seriesId: string;
  offeringId?: string;
  sourceSheet?: string;
  sourceRocYear?: number;
  sourceRecordId?: string;
  entitlementType: string;
  activatedBySessionId?: string;
  activatedByAttendanceId?: string;
  startsAt: string;
  endsAt: string;
  status: "active" | "expired" | "revoked" | string;
  createdAt?: string;
  updatedAt?: string;
};

export type ImportBatch = {
  id: string;
  importType?: string;
  fileName?: string;
  sourceFile?: string;
  sourceSheets?: string[];
  importedAt?: string;
  importedBy?: string;
  totalRows?: number;
  totalCourseCells?: number;
  createdStudents?: number;
  updatedStudents?: number;
  createdCourseSeries?: number;
  createdCourseOfferings?: number;
  createdStudentCourseRecords?: number;
  createdEntitlements?: number;
  createdCount?: number;
  matchedCount?: number;
  skippedCount?: number;
  warningCount?: number;
  errorCount?: number;
  status?: string;
  note?: string;
  createdAt?: string;
};

export type BookingData = {
  categories: CourseCategory[];
  /** Legacy compatibility layer for older front/admin routes. */
  courses: Course[];
  reservations: Reservation[];
  students: Student[];
  courseSeries: CourseSeries[];
  courseOfferings: CourseOffering[];
  courseSessions: CourseSessionRecord[];
  studentCourseRecords: StudentCourseRecord[];
  enrollments: Enrollment[];
  attendanceRecords: AttendanceRecord[];
  entitlements: Entitlement[];
  importBatches: ImportBatch[];
};
