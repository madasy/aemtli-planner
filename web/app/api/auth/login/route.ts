// app/_api/auth/login/route.ts
import { NextResponse } from "next/server";

function isHttps(req: Request) {
  // Works behind reverse proxies too
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim().toLowerCase() === "https";
  try {
    const url = new URL(req.url);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const supplied = String(body.password ?? "");
  const expected = process.env.ADMIN_PASSWORD ?? "";

  // Optional: quick sanity logging (comment out after confirming)
  // console.log("ADMIN_PASSWORD set?", Boolean(expected));

  if (!expected || supplied !== expected) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });

  // Only set Secure when the current request is HTTPS
  const secure = isHttps(req);
  res.cookies.set({
    name: "admin",
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    path: "/",       // visible to middleware & /admin
    secure,          // <— IMPORTANT
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return res;
}
