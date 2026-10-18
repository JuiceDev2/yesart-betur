import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const protectedPrefixes = ["/dashboard", "/admin", "/artist", "/become-artist", "/account"];
  const needsAuth = protectedPrefixes.some((p) => path.startsWith(p));

  if (!user && needsAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && (path.startsWith("/admin") || path.startsWith("/artist"))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (path.startsWith("/admin") && profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (path.startsWith("/artist")) {
      if (profile?.role !== "artist") {
        const url = request.nextUrl.clone();
        url.pathname = "/become-artist";
        return NextResponse.redirect(url);
      }
      if (!profile.is_active) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "disabled");
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
