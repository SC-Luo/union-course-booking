import type { Student } from "@/lib/types";

export function text(value: unknown) {
  return String(value ?? "").trim();
}

export function formatDate(value?: string | null) {
  const raw = text(value);
  if (!raw) return "未填";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10).replaceAll("-", "/");
  return raw;
}

export function getStudentStatus(student: Student) {
  if (student.isActive === false) {
    return {
      key: "inactive",
      label: "已停用",
      className: "border-zinc-200 bg-zinc-50 text-zinc-600",
    };
  }
  if (student.needsReview) {
    return {
      key: "review",
      label: "待確認",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    key: "active",
    label: "啟用中",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

export function getStudentCompleteness(student: Student) {
  const hasName = text(student.name) !== "";
  const hasId = text(student.nationalId || student.idNumberLast3) !== "";
  const hasPhone = text(student.phone) !== "";
  const hasAddress = text(student.address || student.mailingAddress) !== "";

  if (!hasName || !hasId || !hasPhone || !hasAddress) {
    return {
      label: "待補資料",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  const basicConfirmed = student.basicConfirmed === true;
  const contactConfirmed = student.contactConfirmed === true;

  if (!basicConfirmed || !contactConfirmed) {
    return {
      label: "待行政確認",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "資料完整",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

export function matchesStudent(student: Student, query: string) {
  const normalized = text(query).toLowerCase();
  if (!normalized) return true;
  return [
    student.name,
    student.englishName,
    student.phone,
    student.email,
    student.memberNo,
    student.nationalId,
    student.idNumberLast3,
    student.note,
  ]
    .map((value) => text(value).toLowerCase())
    .some((value) => value.includes(normalized));
}
