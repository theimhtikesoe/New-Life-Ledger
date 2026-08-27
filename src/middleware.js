import { NextResponse } from "next/server";
import { requestHasValidSession } from "@/lib/auth-session";

const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/cron/daily-report",
  "/api/kpay-webhook",
  "/api/kpay-webhook/match",
  "/api/telegram/order-webhook",
  "/api/cron/order-batch",
  "/api/cron/order-trash-cleanup",
  "/api/auto-report-status",
]);

export async function middleware(request) {
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/api/") || PUBLIC_API_PATHS.has(path)) return NextResponse.next();

  if (await requestHasValidSession(request)) return NextResponse.next();

  return NextResponse.json(
    { ok: false, error: "အရင်ဆုံး PIN ဖြင့် ဝင်ရောက်ပါ။" },
    { status: 401 },
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
