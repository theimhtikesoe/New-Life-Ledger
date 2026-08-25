# New Life Ledger & KPay Automation

Next.js App Router, Tailwind CSS, Postgres, and Prisma based ledger system for KPay notification intake.

See the full product requirement and system report in [docs/PRD.md](docs/PRD.md).

## Folder Structure

```txt
prisma/schema.prisma                 Database schema
src/lib/prisma.js                    Shared Prisma client
src/lib/kpay.js                      KPay text amount parser
src/lib/telegram.js                  Telegram sendMessage helper
src/app/api/kpay-webhook/route.js    MacroDroid webhook endpoint
src/app/api/unverified-kpay/route.js Pending KPay list endpoint
src/app/api/customers/route.js       Customer GET/POST
src/app/api/customers/[id]/route.js  Customer detail/update
src/app/api/customers/[id]/transactions/route.js Manual debit/credit
src/app/api/kpay-match/route.js      Match pending KPay with customer
src/components/Dashboard.jsx         Single-page dashboard UI
src/app/page.js                      Dashboard page
```

## Naming Conventions

- Prisma models use PascalCase: `Customer`, `LedgerTransaction`, `UnverifiedKpay`.
- Database-style relation fields follow the requested names: `customer_id`, `current_balance`, `raw_text`.
- API request JSON uses camelCase for action fields such as `unverifiedKpayId` and `customerId`.
- Ledger meaning: `DEBIT` means customer payment and decreases the balance; `CREDIT` means debt increase and increases the balance.
- `type` and `status` are stored as strings while the API enforces `DEBIT/CREDIT` and `PENDING/MATCHED`.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Required `.env` values:

```env
DATABASE_URL="postgresql://postgres.qvanezzllbcrvmqexzoq:YOUR_DATABASE_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.qvanezzllbcrvmqexzoq:YOUR_DATABASE_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_GROUP_CHAT_ID="your_telegram_group_id"
CRON_SECRET="random_cron_secret"
MANUAL_REPORT_PIN="optional_manual_report_secret"
APP_PIN="your_6_digit_app_pin"
APP_SESSION_SECRET="random_long_session_secret"
KPAY_WEBHOOK_SECRET="optional_random_webhook_secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

For Vercel production, SQLite is not suitable because serverless functions do not provide a persistent writable local database file. Add Supabase Postgres URLs to Vercel Project Settings as `DATABASE_URL` and `DIRECT_URL`. Replace `YOUR_DATABASE_PASSWORD` with the actual Supabase database password. The API creates the required tables automatically on first request.

## MacroDroid Configuration Guide

1. Create a new Macro.
2. Trigger: `Notification Received`.
3. Choose the KPay app notification source.
4. Action: `HTTP Request`.
5. Method: `POST`.
6. URL: `https://your-domain.com/api/kpay-webhook` or local tunnel URL during testing.
7. If `KPAY_WEBHOOK_SECRET` is configured in Vercel, add header `x-kpay-webhook-secret` with the same value. Do not use the dashboard PIN as this header.
8. Content Type: `application/json`.
9. Body:

```json
{
  "title": "[notification_title]",
  "text": "[notification_text]"
}
```

MacroDroid variable names can differ by version. If your app shows magic text chips, insert the notification title chip for `title` and notification text/body chip for `text`. Example final body:

```json
{
  "title": "{not_title}",
  "text": "{not_text}"
}
```

The webhook can parse Myanmar or English digits, for example `၁၅,၀၀၀ ကျပ် ဝင်ပါသည်` and `15,000 Ks received`. The webhook keeps working with the existing MacroDroid setup when no separate secret is configured; once `KPAY_WEBHOOK_SECRET` is added, the header above becomes required.

The dashboard PIN is checked by the server at `/api/auth/login`. Set `APP_PIN` and a long random `APP_SESSION_SECRET` in the deployment environment; the PIN must not be committed to source code.

### Optional Vercel Build Logs viewer

The session-protected `/vercel-build-logs` page can show recent Production deployments and redacted Vercel build events without reading or changing ledger data. To enable it, add `VERCEL_API_TOKEN` (a Vercel API token with the minimum deployment-read access needed), `VERCEL_PROJECT_ID` (the Vercel project ID or project name), and, for team projects, `VERCEL_TEAM_ID` in Vercel Project Settings → Environment Variables for Production. Keep all three server-only: never prefix them with `NEXT_PUBLIC_`, commit them, or place them in the browser. `VERCEL_BUILD_LOG_VIEWER_ACTORS` defaults to `ဖေဖေ` and accepts a comma-separated allowlist if another signed-in actor should view logs. The viewer uses Vercel's deployment list and deployment-events APIs, limits the number and size of returned events, and redacts common credentials before rendering. If the settings are absent, the page remains safe and displays a setup message instead of making an unauthenticated request.

## API Examples

Create customer:

```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"U Aung","phone":"09123456789","current_balance":50000}'
```

Manual ledger transaction:

```bash
curl -X POST http://localhost:3000/api/customers/1/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"DEBIT","amount":15000,"note":"Today sale"}'
```

Test KPay webhook:

```bash
curl -X POST http://localhost:3000/api/kpay-webhook \
  -H "Content-Type: application/json" \
  -d '{"title":"KPay","text":"၁၅,၀၀၀ ကျပ် ဝင်ပါသည်"}'
```

Match pending KPay:

```bash
curl -X POST http://localhost:3000/api/kpay-match \
  -H "Content-Type: application/json" \
  -d '{"unverifiedKpayId":1,"customerId":1}'
```
