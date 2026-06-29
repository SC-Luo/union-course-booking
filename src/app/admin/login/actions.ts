"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function adminLoginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "").trim();
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!expectedPassword || !sessionSecret || password !== expectedPassword) {
    redirect(`/admin/login?error=invalid${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  const cookieStore = await cookies();
  cookieStore.set("admin_session", sessionSecret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 8,
  });

  if (next && next.startsWith("/admin")) {
    redirect(next);
  } else {
    redirect("/admin");
  }
}
