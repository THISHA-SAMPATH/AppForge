import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((request) => {
  const isLoggedIn = !!request.auth;
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  const isApiAuth = request.nextUrl.pathname.startsWith("/api/auth");
  const isPublic = isAuthPage || isApiAuth;

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
