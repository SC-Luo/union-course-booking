"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type SessionInfoModalCardProps = {
  title: string;
  description?: string;
  summaryItems?: string[];
  children: ReactNode;
  triggerLabel?: string;
  eyebrow?: string;
  closeLabel?: string;
  triggerClassName?: string;
  panelClassName?: string;
};

export function SessionInfoModalCard({
  title,
  description,
  children,
  triggerLabel,
  eyebrow = "課堂資料",
  closeLabel = "關閉",
  triggerClassName,
  panelClassName,
}: SessionInfoModalCardProps) {
  const [open, setOpen] = useState(false);

  const buttonClassName =
    triggerClassName ??
    "inline-flex h-11 items-center justify-center rounded-2xl bg-[#E85F00] px-5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#d95500] hover:shadow-md";

  const basePanelClassName =
    "max-h-[88vh] w-full overflow-y-auto rounded-[28px] border border-[#ead8ca] bg-white p-6 shadow-2xl";
  const hiddenScrollbarClassName =
    "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";
  const modalPanelClassName = `${basePanelClassName} ${hiddenScrollbarClassName} ${
    panelClassName ?? "max-w-4xl"
  }`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClassName}>
        {triggerLabel ?? title}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8"
          role="dialog"
          aria-modal="true"
        >
          <div className={modalPanelClassName}>
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#f1e2d6] pb-4">
              <div>
                <p className="text-xs font-black text-[#B46F4A]">{eyebrow}</p>
                <h3 className="mt-1 text-2xl font-black text-[#1f1712]">{title}</h3>
                {description ? (
                  <p className="mt-1 text-sm leading-6 text-[#8a7c72]">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-[#ead8ca] bg-[#fffaf5] px-4 py-2 text-sm font-black text-[#5A3726] hover:bg-[#fff1e7]"
              >
                {closeLabel}
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
