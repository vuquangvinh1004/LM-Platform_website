import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getDefaultPathForRole, isProtectedPath, isRoleAllowedForPath } from "@/lib/services/auth-guard";
import type { Profile } from "@/lib/types/auth";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname === "/login";

  if (!user && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!user) {
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,status,access_status,access_expires_at,student_code,role_code")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return response;
  }

  if (!isRoleAllowedForPath(pathname, (profile as Profile).role)) {
    return NextResponse.redirect(new URL(getDefaultPathForRole((profile as Profile).role), request.url));
  }

  const typedProfile = profile as Profile;
  const isStudentLearningArea = pathname.startsWith("/my-classes") && typedProfile.role === "student";

  if (typedProfile.status !== "active" && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (typedProfile.role === "student" && typedProfile.access_status !== "active") {
    if (!isStudentLearningArea) {
      return NextResponse.redirect(new URL("/my-classes", request.url));
    }
  }

  if (typedProfile.role === "student" && typedProfile.access_expires_at) {
    const expiresAt = new Date(typedProfile.access_expires_at);
    if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= Date.now() && !isStudentLearningArea) {
      return NextResponse.redirect(new URL("/my-classes", request.url));
    }
  }

  if (isAuthRoute) {
    return NextResponse.redirect(new URL(getDefaultPathForRole(typedProfile.role), request.url));
  }

  return response;
}
