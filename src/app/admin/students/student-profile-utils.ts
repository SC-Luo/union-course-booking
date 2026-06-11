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
      label: "停用 / 歷史",
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
  const checks = [
    text(student.name),
    text(student.phone),
    text(student.birthday),
    text(student.nationalId || student.idNumberLast3),
    text(student.email),
    text(student.address || student.mailingAddress),
    text(student.emergencyContactName),
    text(student.memberNo),
  ];
  const filled = checks.filter(Boolean).length;
  const ratio = filled / checks.length;

  if (ratio >= 0.8) {
    return {
      label: "完整",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (ratio >= 0.45) {
    return {
      label: "待補資料",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    label: "基本資料中",
    className: "border-sky-200 bg-sky-50 text-sky-700",
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
