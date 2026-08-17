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

export function formatDateTime(value?: string | null) {
  const raw = text(value);
  if (!raw) return "未紀錄時間";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

export function maskNationalId(id?: string | null): string {
  const val = text(id);
  if (!val) return "未填";
  if (val.length < 5) return "***";
  return val.slice(0, 3) + "***" + val.slice(-3);
}

export function isFullyDocumented(student: Student): boolean {
  return (
    student.basicConfirmed === true &&
    student.contactConfirmed === true &&
    student.backgroundConfirmed === true &&
    student.businessConfirmed === true &&
    student.noteConfirmed === true
  );
}

export function getStudentCompleteness(student: Student) {
  const hasName = text(student.name) !== "";
  const hasNationalId = text(student.nationalId) !== "";
  const hasPhone = text(student.phone) !== "";
  const hasBirthday = text(student.birthday) !== "";
  const hasAddress = text(student.address || student.mailingAddress) !== "";

  const requiredComplete = hasName && hasNationalId && hasPhone && hasBirthday && hasAddress;
  const fullyDocumented = isFullyDocumented(student);

  // 1. 待補基本：姓名、完整證件號、手機、生日、通訊地址缺任一項
  if (!requiredComplete) {
    return {
      label: "待補基本",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  // 2. 資料完整：五大區塊全部完成確認
  if (fullyDocumented) {
    return {
      label: "資料完整",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  // 3. 填完基本：必填都填了，但五大區塊未全確認
  return {
    label: "填完基本",
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
