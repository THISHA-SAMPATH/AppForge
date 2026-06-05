import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((request) => {
  const isLoggedIn = !!request.auth;
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith("/login");
  const isApiAuth = pathname.startsWith("/api/auth");
  const isPublicAsset = 
    pathname === "/logo.png" || 
    pathname === "/icon.png" || 
    pathname === "/favicon.ico" || 
    pathname.endsWith(".svg");
  
  const isPublic = isAuthPage || isApiAuth || isPublicAsset;

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|icon.png).*)"],
};
