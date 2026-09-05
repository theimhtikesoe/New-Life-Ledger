import { NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/auth-session";

const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/auth/actor-session",
  "/api/cron/daily-report",
  "/api/kpay-webhook",
  "/api/telegram/order-webhook",
  "/api/cron/order-batch",
  "/api/cron/order-trash-cleanup",
]);
const PRODUCTION_API_PATHS = new Set([
  "/api/production-reports",
  "/api/production-workers",
]);
const PRODUCTION_ONLY_ACTOR = "ဇွဲဇွဲ";

function isProductionOnlySession(session) {
  return session?.access === "production-only" && session?.actorName === PRODUCTION_ONLY_ACTOR;
}

export async function middleware(request) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/api/")) {
    if (PUBLIC_API_PATHS.has(path)) return NextResponse.next();
    const session = await getSessionInfo(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "အရင်ဆုံး PIN ဖြင့် ဝင်ရောက်ပါ။" },
        { status: 401 },
      );
    }
    if (isProductionOnlySession(session) && !PRODUCTION_API_PATHS.has(path)) {
      return NextResponse.json(
        { ok: false, error: "ဇွဲဇွဲ အသုံးပြုသူသည် ထုတ်လုပ်မှုစာမျက်နှာနှင့် သက်ဆိုင်သောလုပ်ဆောင်ချက်များကိုသာ အသုံးပြုနိုင်ပါသည်။" },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  const session = await getSessionInfo(request);
  if (isProductionOnlySession(session) && path !== "/production") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/production";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|service-worker.*|.*\\..*).*)",
  ],
};
