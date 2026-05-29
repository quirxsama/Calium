import { NextResponse, type NextRequest } from "next/server";

/**
 * CSRF koruması: State-changing istekleri (POST/PUT/PATCH/DELETE) yalnızca
 * same-origin'den kabul et. `Origin` veya `Referer` header'ı host ile
 * eşleşmezse 403 döner. Cross-site `fetch` tarayıcı tarafından bu header'ları
 * set etmek zorundadır; form submit'lerinde de set edilir. SameSite=lax cookie
 * ile birlikte katmanlı koruma sağlar.
 *
 * /api/auth/login ve /api/auth/register hariç — bu rotalar halihazırda
 * rate-limit + şifre doğrulama ile korunuyor ve bazı durumlarda origin'siz
 * POST (örn. server-side fetch) kabul edilebilir olmalı. Logout gibi diğer
 * auth mutasyonları same-origin kontrolünden geçer.
 *
 * Not: Anizium proxy rotaları (GET) method filtresi nedeniyle zaten etkilenmez.
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(req: NextRequest) {
  if (!MUTATING_METHODS.has(req.method)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  // Login/register endpoint'lerinde rate-limit + password checks var; skip.
  if (pathname === "/api/auth/login" || pathname === "/api/auth/register") {
    return NextResponse.next();
  }

  const host = req.headers.get("host");
  if (!host) {
    return NextResponse.json(
      { success: false, error: "Geçersiz istek." },
      { status: 400 }
    );
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Her iki header da yoksa reddet — tarayıcı cross-site fetch'te en az birini gönderir.
  if (!origin && !referer) {
    return NextResponse.json(
      { success: false, error: "Origin header gerekli." },
      { status: 403 }
    );
  }

  const check = (value: string | null) => {
    if (!value) return null;
    try {
      const u = new URL(value);
      return u.host === host;
    } catch {
      return false;
    }
  };

  const originOk = check(origin);
  const refererOk = check(referer);

  // En az biri eşleşmeli; biri yoksa diğerinden doğrulama yeterli.
  if (originOk === false || (originOk === null && refererOk === false)) {
    return NextResponse.json(
      { success: false, error: "Cross-origin istek reddedildi." },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
