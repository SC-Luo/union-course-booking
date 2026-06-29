/* eslint-disable @next/next/no-html-link-for-pages */
import type { ReactNode } from "react";

type IconName =
  | "home"
  | "today"
  | "work"
  | "training"
  | "skill"
  | "other"
  | "course"
  | "category"
  | "master"
  | "term"
  | "session"
  | "roster"
  | "student"
  | "teacher"
  | "attendance"
  | "dashboard"
  | "history"
  | "external";

type AdminShellProps = {
  children: ReactNode;
  resumeHref?: string;
  resumeLabel?: string;
  currentSection?: string;
};

type NavLink = {
  href: string;
  label: string;
  key: string;
  description?: string;
  icon: IconName;
};

type NavGroup = {
  title: string;
  description?: string;
  href?: string;
  key: string;
  icon: IconName;
  items?: NavLink[];
};

function isCurrent(currentSection: string | undefined, key: string) {
  if (!currentSection) return false;
  return currentSection === key || currentSection.startsWith(`${key}.`);
}

function LineIcon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...common}
    >
      {name === "home" ? (
        <>
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6.5 9.5V20h11V9.5" />
          <path d="M10 20v-6h4v6" />
        </>
      ) : null}
      {name === "today" ? (
        <>
          <path d="M7 3.5v3M17 3.5v3" />
          <path d="M4.5 8h15" />
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="m9 13 2 2 4-4" />
        </>
      ) : null}
      {name === "work" ? (
        <>
          <rect x="4" y="7" width="16" height="12" rx="3" />
          <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
          <path d="M4 12h16" />
        </>
      ) : null}
      {name === "training" ? (
        <>
          <path d="M12 4 3.5 8.5 12 13l8.5-4.5L12 4Z" />
          <path d="M6.5 10.5v4.2c0 1.8 2.4 3.3 5.5 3.3s5.5-1.5 5.5-3.3v-4.2" />
        </>
      ) : null}
      {name === "skill" ? (
        <>
          <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />
        </>
      ) : null}
      {name === "other" ? (
        <>
          <circle cx="6" cy="12" r="1.2" />
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="18" cy="12" r="1.2" />
        </>
      ) : null}
      {name === "course" ? (
        <>
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <path d="M8 9h8M8 13h5" />
          <path d="M7 5v14" />
        </>
      ) : null}
      {name === "category" ? (
        <>
          <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
        </>
      ) : null}
      {name === "master" ? (
        <>
          <path d="M6 4.5h9.5L19 8v11.5H6z" />
          <path d="M15.5 4.5V8H19" />
          <path d="M9 12h6M9 15.5h4" />
        </>
      ) : null}
      {name === "term" ? (
        <>
          <path d="M7 4v3M17 4v3" />
          <rect x="4" y="6" width="16" height="14" rx="3" />
          <path d="M8 11h3M13 11h3M8 15h3M13 15h3" />
        </>
      ) : null}
      {name === "session" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7.5V12l3 2" />
          <path d="M4 12h2M18 12h2" />
        </>
      ) : null}
      {name === "roster" ? (
        <>
          <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M2.8 19c.6-3.2 2.5-5 5.2-5s4.6 1.8 5.2 5" />
          <path d="M15 8h6M15 12h6M15 16h4" />
        </>
      ) : null}
      {name === "student" ? (
        <>
          <path d="M12 4 3.5 8.5 12 13l8.5-4.5L12 4Z" />
          <path d="M7 11v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V11" />
        </>
      ) : null}
      {name === "teacher" ? (
        <>
          <circle cx="8" cy="8" r="3" />
          <path d="M3 19c.5-3.2 2.4-5 5-5s4.5 1.8 5 5" />
          <path d="M15 6h5v8h-5z" />
          <path d="M16 17h3" />
        </>
      ) : null}
      {name === "attendance" ? (
        <>
          <path d="M5 12.5 9.2 17 19 7" />
          <path d="M4 5h10" />
          <path d="M4 9h6" />
        </>
      ) : null}
      {name === "dashboard" ? (
        <>
          <path d="M4 14a8 8 0 1 1 16 0" />
          <path d="M12 14 16 9" />
          <path d="M7 19h10" />
        </>
      ) : null}
      {name === "history" ? (
        <>
          <path d="M5 6v5h5" />
          <path d="M5.5 11a7 7 0 1 0 2-5" />
          <path d="M12 8v4l3 2" />
        </>
      ) : null}
      {name === "external" ? (
        <>
          <path d="M8 6h10v10" />
          <path d="M18 6 7 17" />
          <path d="M6 9v9h9" />
        </>
      ) : null}
    </svg>
  );
}

function NavItem({
  href,
  label,
  description,
  icon,
  active,
}: {
  href: string;
  label: string;
  description?: string;
  icon: IconName;
  active: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-150",
        active
          ? "border-[#B46F4A]/35 bg-gradient-to-r from-[#fff3e6] to-white shadow-sm"
          : "border-transparent bg-white/0 hover:border-[#E7892B]/25 hover:bg-white/80",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
          active
            ? "bg-gradient-to-br from-[#E85F00] via-[#E7892B] to-[#B46F4A] text-white shadow-sm"
            : "bg-[#f6eee8] text-[#5A3726] group-hover/navgroup:bg-[#fff3e6] group-hover/navgroup:text-[#E85F00]",
        ].join(" ")}
        aria-hidden="true"
      >
        <LineIcon name={icon} />
      </span>
      <span className="min-w-0">
        <span
          className={[
            "block text-base font-black leading-5",
            active ? "text-[#8B5035]" : "text-zinc-900",
          ].join(" ")}
        >
          {label}
        </span>
        {description ? (
          <span className="mt-1 block text-sm leading-5 text-zinc-500">
            {description}
          </span>
        ) : null}
      </span>
    </a>
  );
}

function GroupHeader({ group, active }: { group: NavGroup; active: boolean }) {
  const className = [
    "flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition-all duration-150",
    active
      ? "border-[#B46F4A]/45 bg-gradient-to-r from-[#fff2e3] via-white to-[#fff9f3] shadow-sm"
      : "border-transparent bg-transparent hover:border-[#E7892B]/25 hover:bg-white/80",
  ].join(" ");

  const content = (
    <>
      <span
        className={[
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors",
          active
            ? "bg-gradient-to-br from-[#E85F00] via-[#E7892B] to-[#B46F4A] text-white shadow-sm"
            : "bg-[#fff3e6] text-[#5A3726] group-hover/navgroup:bg-gradient-to-br group-hover/navgroup:from-[#E85F00] group-hover/navgroup:via-[#E7892B] group-hover/navgroup:to-[#B46F4A] group-hover/navgroup:text-white",
        ].join(" ")}
        aria-hidden="true"
      >
        <LineIcon name={group.icon} className="h-5.5 w-5.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={[
            "block text-lg font-black leading-6",
            active ? "text-[#8B5035]" : "text-zinc-950",
          ].join(" ")}
        >
          {group.title}
        </span>
        {group.description ? (
          <span className="mt-1 block text-sm leading-5 text-zinc-500">
            {group.description}
          </span>
        ) : null}
      </span>
      {group.items?.length ? (
        <span className="shrink-0 text-xl font-black text-[#B46F4A] transition-transform duration-150 group-hover/navgroup:rotate-90 group-focus-within/navgroup:rotate-90">
          ›
        </span>
      ) : null}
    </>
  );

  if (group.href) {
    return (
      <a
        href={group.href}
        className={className}
        aria-current={active ? "page" : undefined}
      >
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}

function SidebarGroup({
  group,
  currentSection,
}: {
  group: NavGroup;
  currentSection?: string;
}) {
  const active = isCurrent(currentSection, group.key);
  const hasItems = Boolean(group.items?.length);

  return (
    <section className="group/navgroup rounded-[24px]">
      <GroupHeader group={group} active={active} />

      {hasItems ? (
        <div
          className={[
            "ml-6 overflow-hidden border-l border-[#E7892B]/25 pl-4 transition-all duration-200 ease-out",
            active ? "mt-2 max-h-[720px] opacity-100" : "max-h-0 opacity-0",
            "group-hover/navgroup:mt-2 group-hover/navgroup:max-h-[720px] group-hover/navgroup:opacity-100",
            "group-focus-within/navgroup:mt-2 group-focus-within/navgroup:max-h-[720px] group-focus-within/navgroup:opacity-100",
          ].join(" ")}
        >
          <div className="space-y-1 py-1">
            {group.items?.map((item) => (
              <NavItem
                key={item.key}
                href={item.href}
                label={item.label}
                description={item.description}
                icon={item.icon}
                active={isCurrent(currentSection, item.key)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function StudentShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8f0_0,#f7efe7_45%,#f3e7da_100%)] text-stone-950">
      <header className="sticky top-0 z-40 border-b border-[#ead8c6] bg-[#fffaf5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-3 rounded-2xl px-2 py-1 text-[#3a2a20] transition hover:bg-white/70"
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E85F00] via-[#E7892B] to-[#B46F4A] text-white shadow-sm ring-1 ring-white/70"
              aria-hidden="true"
            >
              <LineIcon name="course" className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-black leading-tight tracking-tight sm:text-lg">
                學員中心
              </span>
              <span className="mt-0.5 block text-sm font-bold leading-tight text-[#8B5035]">
                課程預約、查詢與取消
              </span>
            </span>
          </a>
          <div className="flex w-full sm:w-auto sm:items-center">
            <a
              href="/booking/search"
              className="w-full rounded-full border border-[#d8bda4] bg-white/85 px-5 py-3 text-center text-sm font-bold text-[#6f4325] shadow-sm transition hover:bg-[#fff4e8] sm:w-auto"
            >
              我的預約
            </a>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </main>
  );
}

export function AdminShell({
  children,
  currentSection = "dashboard",
}: AdminShellProps) {
  const groups: NavGroup[] = [
    {
      key: "dashboard",
      title: "秘書處工作台",
      description: "行政總覽與待辦入口",
      href: "/admin",
      icon: "home",
    },
    {
      key: "course-settings",
      title: "課程行政",
      description: "開課、排程與場次",
      icon: "course",
      items: [
        {
          href: "/admin/course-categories",
          label: "課程類別",
          key: "course-settings.category",
          description: "分類、顏色、代碼前綴",
          icon: "category",
        },
        {
          href: "/admin/course-masters",
          label: "課程目錄",
          key: "course-settings.master",
          description: "課程種類與預設資料",
          icon: "master",
        },
        {
          href: "/admin/course-offerings",
          label: "年度課程",
          key: "course-settings.offering",
          description: "實際開課班級與名額",
          icon: "term",
        },
        {
          href: "/admin/course-sessions",
          label: "課堂詳情",
          key: "course-settings.session",
          description: "日期、講師、停課調課",
          icon: "session",
        },
      ],
    },
    {
      key: "booking",
      title: "報名管理",
      description: "報名、鎖定與名單",
      icon: "roster",
      items: [
        {
          href: "/admin/weekly-bookings",
          label: "報名總覽",
          key: "booking.weekly",
          description: "近期課程報名狀況",
          icon: "today",
        },
        {
          href: "/admin/booking-locks",
          label: "鎖定管理",
          key: "booking.locking",
          description: "預約即將不可更改",
          icon: "session",
        },
        {
          href: "/admin/course-offerings",
          label: "報名名單",
          key: "booking.list",
          description: "從年度課程進入名單",
          icon: "student",
        },
      ],
    },
    {
      key: "attendance",
      title: "點名出勤",
      description: "點名、出勤與課堂紀錄",
      icon: "attendance",
      items: [
        {
          href: "/admin",
          label: "今日點名",
          key: "attendance.today",
          description: "今日課堂點名入口",
          icon: "today",
        },
        {
          href: "/admin/stats?report=attendance",
          label: "出勤紀錄",
          key: "attendance.dashboard",
          description: "出席、未到與完成率",
          icon: "dashboard",
        },
      ],
    },
    {
      key: "roster",
      title: "名冊資料",
      description: "學員與講師",
      icon: "roster",
      items: [
        {
          href: "/admin/students",
          label: "學員名冊",
          key: "roster.students",
          description: "匯入與新增學員基本資料",
          icon: "student",
        },
        {
          href: "/admin/students?mode=instructors",
          label: "講師名冊",
          key: "roster.instructors",
          description: "預留講師資料庫入口",
          icon: "teacher",
        },
      ],
    },
    {
      key: "reports",
      title: "統計報表",
      description: "統計、備份與同步",
      icon: "dashboard",
      items: [
        {
          href: "/admin/stats",
          label: "統計分析",
          key: "reports.overview",
          description: "報名、出席與課程分析",
          icon: "dashboard",
        },
        {
          href: "/admin/exports",
          label: "備份同步",
          key: "reports.exports",
          description: "Google Sheet、XLSX 與 CSV",
          icon: "external",
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff3e6_0,#fff9f3_34%,#f8efe6_100%)] text-zinc-900">
      <div className="flex min-h-screen">
        <aside
          className="sticky top-0 z-30 hidden h-screen w-[320px] shrink-0 overflow-y-auto border-r border-[#E7892B]/20 bg-[#fffaf5]/92 px-5 py-6 shadow-[14px_0_45px_rgba(90,55,38,0.06)] backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block"
          style={{ msOverflowStyle: "none" }}
        >
          <a
            href="/admin"
            className="mb-5 flex items-center gap-3 rounded-[24px] border border-[#E7892B]/25 bg-gradient-to-br from-white to-[#fff1e0] px-3 py-3 shadow-sm"
            title="工會課程後台"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E85F00] via-[#E7892B] to-[#B46F4A] text-white shadow-sm">
              <LineIcon name="course" className="h-7 w-7" />
            </span>
            <span className="min-w-0">
              <span className="block text-2xl font-black tracking-tight text-zinc-950">
                秘書處後台
              </span>
              <span className="mt-1 block text-sm leading-5 text-zinc-500">
                課程建制、名冊與統計管理
              </span>
            </span>
          </a>

          <nav className="space-y-3 pb-6" aria-label="工會後台功能導覽">
            {groups.map((group) => (
              <SidebarGroup
                key={group.key}
                group={group}
                currentSection={currentSection}
              />
            ))}

            <section className="border-t border-[#E7892B]/20 pt-5">
              <p className="mb-3 px-2 text-xs font-black tracking-[0.18em] text-[#B46F4A]">
                角色切換
              </p>
              <div className="grid gap-2">
                <a
                  href="/"
                  className="flex items-center gap-3 rounded-[22px] border border-[#B46F4A]/35 bg-gradient-to-br from-[#5A3726] via-[#8B5035] to-[#B46F4A] px-3 py-4 text-white shadow-sm transition-all duration-150 hover:brightness-105 hover:shadow-md"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/95 text-[#8B5035]">
                    <LineIcon name="external" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-black leading-6">
                      學員中心
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-[#fff8f1]">
                      預約、查詢與取消
                    </span>
                  </span>
                  <span className="text-xl font-black">→</span>
                </a>
                <a
                  href="/teaching/login"
                  className="flex items-center gap-3 rounded-[22px] border border-[#E7892B]/25 bg-white/85 px-3 py-4 text-[#5A3726] shadow-sm transition-all duration-150 hover:bg-[#fff4e8] hover:shadow-md"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#fff3e6] text-[#8B5035]">
                    <LineIcon name="training" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-black leading-6">
                      授課工作台
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-[#8a6a55]">
                      講師與助教點名、紀錄
                    </span>
                  </span>
                  <span className="text-xl font-black">→</span>
                </a>
              </div>
            </section>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[#E7892B]/20 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
            <a
              href="/admin"
              className="inline-flex items-center gap-2 text-base font-semibold text-zinc-900"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#E85F00] via-[#E7892B] to-[#B46F4A] text-white">
                <LineIcon name="course" className="h-4.5 w-4.5" />
              </span>
              <span>秘書處後台</span>
            </a>
          </header>

          <div className="flex-1 overflow-x-hidden">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
