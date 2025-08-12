import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Guard only /admin (and children)
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // Allow the login page itself
  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  const cookie = req.cookies.get("admin-authed");
  const isAuthed = cookie?.value === "1";
  if (!isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ""));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
