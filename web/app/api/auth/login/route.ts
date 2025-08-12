import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({}));
  const ok = password && password === process.env.ADMIN_PASSWORD;

  if (!ok) {
    return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  // HttpOnly cookie so client JS cannot read it
  res.cookies.set("admin-authed", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}
