export type CourseStatus = "available" | "full" | "closed" | "locked";

export type AttendanceStatus = "pending" | "unchecked" | "attended" | "absent" | "late" | "leave";

export type ReservationStatus = "booked" | "cancelled";

export type CourseCapacityMode = "course" | "session";

export type ReservationSource = "online" | "manual" | "excel" | "excel_import";

export type CourseMode =
  | "booking_flexible"
  | "fixed_roster"
  | "subsidy_roster"
  // Legacy compatibility
  | "booking"
  | "roster_fixed"
  | "fixed_roster_exam"
  | string;

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
  defaultInstructorId?: string;
  defaultInstructorName?: string;
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
  name?: string;
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
  primaryInstructorId?: string;
  primaryInstructorName?: string;
  defaultInstructorId?: string;
  defaultInstructorName?: string;
  assistantInstructorIds?: string[];
  assistantInstructorNames?: string[];
  bookingStatus?: "open" | "closed" | "draft" | string;
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
  instructorId?: string;
  instructorName?: string;
  assistantInstructorIds?: string[];
  assistantInstructorNames?: string[];
  sessionStatus?: "scheduled" | "suspended" | "rescheduled" | "makeup" | string;
  attendanceStatus?: "not_started" | "in_progress" | "completed" | string;
  teachingContent?: string;
  teacherNote?: string;
  assistantNote?: string;
  adminNote?: string;
  abnormalStatus?: string;
  followUpNote?: string;
  abnormalResolvedStatus?: "unresolved" | "processing" | "resolved" | string;
  status?: "scheduled" | "suspended" | "rescheduled" | "makeup" | "cancelled" | string;
  changeReason?: string;
  originalSessionId?: string;
  rescheduledToSessionId?: string;
  makeupForSessionId?: string;
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
  status?: "scheduled" | "suspended" | "rescheduled" | "makeup" | "cancelled" | string;
  instructorId?: string;
  instructorName?: string;
  assistantInstructorIds?: string[];
  assistantInstructorNames?: string[];
  sessionStatus?: "scheduled" | "suspended" | "rescheduled" | "makeup" | string;
  attendanceStatus?: "not_started" | "in_progress" | "completed" | string;
  teachingContent?: string;
  teacherNote?: string;
  assistantNote?: string;
  adminNote?: string;
  abnormalStatus?: string;
  followUpNote?: string;
  abnormalResolvedStatus?: "unresolved" | "processing" | "resolved" | string;
  changeReason?: string;
  originalSessionId?: string;
  rescheduledToSessionId?: string;
  makeupForSessionId?: string;
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
  primaryInstructorId?: string;
  primaryInstructorName?: string;
  assistantInstructorIds?: string[];
  assistantInstructorNames?: string[];
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
  lateTime?: string;
  leaveHours?: number;
  leaveStartTime?: string;
  leaveEndTime?: string;
  source?: ReservationSource;
  homework?: string;
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
  studentNo?: string;
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
  lateTime?: string;
  leaveHours?: number;
  leaveStartTime?: string;
  leaveEndTime?: string;
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

export type Instructor = {
  id: string;
  name: string;
  phone?: string;
  specialties?: string[];
  courseSeriesIds?: string[];
  courseOfferingIds?: string[];
  note?: string;
  source?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AssignmentSubmissionType = "text" | "url" | "image";

export type AssignmentStatus = "draft" | "open" | "closed" | "archived" | string;

export type AssignmentSubmissionStatus =
  | "not_submitted"
  | "submitted"
  | "needs_revision"
  | "approved"
  | string;

export type CourseAssignment = {
  id: string;
  courseId?: string;
  offeringId?: string;
  sessionId?: string;
  title: string;
  description?: string;
  dueAt?: string;
  submissionTypes: AssignmentSubmissionType[];
  isRequired?: boolean;
  status: AssignmentStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type AssignmentSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  courseId?: string;
  offeringId?: string;
  sessionId?: string;
  textAnswer?: string;
  urlAnswer?: string;
  imageUrls?: string[];
  status: AssignmentSubmissionStatus;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt?: string;
  updatedAt?: string;
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
  instructors?: Instructor[];
  courseAssignments?: CourseAssignment[];
  assignmentSubmissions?: AssignmentSubmission[];
};
