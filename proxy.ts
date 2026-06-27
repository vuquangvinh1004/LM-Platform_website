import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/courses/:path*",
    "/materials/:path*",
    "/library/:path*",
    "/classes/:path*",
    "/assessments/:path*",
    "/my-classes/:path*",
    "/my-profile/:path*",
    "/admin/:path*",
    "/access-review/:path*",
    "/login",
  ],
};
