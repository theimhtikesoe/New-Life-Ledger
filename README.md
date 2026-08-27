# New Life Ledger

New Life Ledger သည် Customer ငွေရှင်းတမ်း၊ အကြွေးလက်ကျန်၊ ငွေချေမှု၊ လက်ငင်းရောင်းစာရင်း၊ KPay notification၊ Telegram Order၊ Factory Handover နှင့် Myanmar-time Daily Report ကို တစ်နေရာတည်းတွင် စီမံရန် တည်ဆောက်ထားသော internal web application ဖြစ်ပါသည်။ Production URL သည် [`https://newlifeledger.vercel.app`](https://newlifeledger.vercel.app) ဖြစ်ပြီး source repository သည် [`theimhtikesoe/New-Life-Ledger`](https://github.com/theimhtikesoe/New-Life-Ledger) ဖြစ်ပါသည်။

ဤစနစ်တွင် **PostgreSQL database သည် source of truth** ဖြစ်ပါသည်။ Browser local storage သို့မဟုတ် service-worker cache သည် paint cache၊ actor preference နှင့် offline presentation အတွက်သာ ဖြစ်ပြီး Customer၊ Ledger၊ CashSale၊ Order သို့မဟုတ် balance data ၏ အမှန်တရားအဖြစ် မသုံးရပါ။

## 1. Technology and runtime

| Area | Implementation |
|---|---|
| Web framework | Next.js 14 App Router, JavaScript/React |
| Styling | Tailwind CSS and responsive utility classes |
| Database | PostgreSQL through Prisma 5 |
| Deployment | Vercel production deployment |
| Automation | Vercel Cron using UTC schedules |
| Authentication | Server-side PIN session cookie plus selected actor name |
| External services | Telegram Bot API, MacroDroid/KPay notification webhook, optional Manus AI provider |
| PWA | Web manifest, installable icons, service worker v9, network-first page loading |
| Timezone | Myanmar time, `Asia/Yangon`, UTC+06:30 |

## 2. Business data rules

Customer, Ledger, CashSale, Order, and AuditLog are separate concepts. A normal ledger payment is `DEBIT` and reduces the customer balance. A debt increase is `CREDIT` and increases the customer balance. A CashSale is a separate retail or wholesale sale record: it appears in Daily Summary, KPI, reports, and Telegram output, but it does **not** create a second ledger payment, does **not** increase or decrease customer net receivables, and does **not** alter `Customer.current_balance`.

Telegram Orders use the Order domain only. An Order customer may be linked to an existing accounting Customer or stored as an Order-only draft customer. Order-only draft data must never be inserted into the main accounting Customer list merely because an order was received. Order operational activities stay in Order History and are excluded from accounting Activity History and Daily Report activity data.

> **Data safety rule:** No feature should delete, overwrite, or reinterpret existing Customer, Ledger, CashSale, balance, or accounting activity data merely to test a UI, Telegram flow, report, or cache.

## 3. Main user workflows

### 3.1 PIN and actor flow

On the first visit, the user enters the six-digit application PIN. The server creates an HttpOnly signed session cookie. The user then selects one actor: `ဖေဖေ`, `ပုံ့ပုံ့`, `ဆောင်းဦး`, or `Staff`. The actor name is kept in browser local storage only for attribution and is sent to write APIs through the `x-actor-name` header.

The PIN session is long-lived, while actor selection is re-requested after five minutes without activity. Re-selecting the actor does not require re-entering the PIN. PIN values and session secrets must never be committed to source or written in documentation.

### 3.2 KPay notification intake

MacroDroid reads a KPay or banking notification and posts the notification title and body to `POST /api/kpay-webhook`. The server parses Myanmar or English digits, saves the incoming payment as `UnverifiedKpay(PENDING)`, and sends a notification to the configured Telegram accounting group. A staff member matches the pending payment with an existing Customer through the website. The matching operation is transactional and creates the correct ledger entry while marking the pending KPay item as matched.

KPay provider event deduplication by a provider event ID or strong event fingerprint remains a future hardening task. Until such an identifier is available, operators must not resend the same notification repeatedly as a test.

### 3.3 Website ledger and CashSale flow

The Dashboard loads KPI information first, then overdue debt alerts and primary Customer/ledger data, then Daily Summary, Activity History, Orders, and other secondary data in the background. Customer search and balance detail use server data. Manual ledger entry is used only for actual `DEBIT` or `CREDIT` accounting events.

CashSale entry requires a sale type: `RETAIL` or `WHOLESALE`. The same CashSale record carries item size, cartons, rate, deductions, amount, payment type, date, and note. CashSale records are shown as transaction data and report data without adding a matching debt increase/payment ledger pair.

### 3.4 Telegram Order and Factory Handover flow

The Order group accepts `/order`, `မှာယူမှု`, Burmese, English, Myanmar digits, English digits, and common business shorthand. The deterministic parser is used first; AI extraction is bounded and optional. If information is missing, the draft displays only the useful missing fields and supplies Telegram buttons for date, destination, phone, customer linking, customer creation within the Order domain, details, Confirm, and Cancel.

The Factory Handover group is not a bottle manufacturing or production group. It is for factory-front pickup, vehicle loading, gate delivery preparation, and dispatch coordination. Inventory/Production planning is a separate future group and is not mixed into the current factory handover workflow.

A confirmed order sends the factory handover message and maintains the Order status in the database. Confirm and Cancel actions are restricted by the configured Telegram order administrator rules. Telegram callback queries are answered promptly, and message editing is used where possible so that repeated taps do not create additional orders. Website Order History remains the source for operational history; accounting Activity History excludes Order activities.

### 3.5 Daily Report flow

Daily Report data uses the previous Myanmar calendar day from `00:00–23:59`. The report includes accounting transactions, CashSale retail/wholesale totals, filtered accounting activities, a summary image, an activity image when applicable, and a PDF. Order workflow activities are not included in accounting activity output.

Manual Report and Auto Report share the same per-report-date `AutoReportRun` claim/finish protocol. If a Manual Report was already delivered for a report date, the next Auto run skips the full duplicate report and sends one status notice only. Notice claim and sent timestamps prevent duplicate notices during retries or concurrent invocations.

## 4. Auto Report schedule and tomorrow's behavior

The current production code is configured with one primary and two retry windows for the same idempotent handler:

| Myanmar target | UTC cron in `vercel.json` | Purpose |
|---|---:|---|
| Around 08:00 | `30 1 * * *` | Primary previous-day report |
| Around 09:00 | `30 2 * * *` | Retry if an earlier report date remains missing or failed |
| Around 10:00 | `30 3 * * *` | Final bounded retry/catch-up window |

Vercel Cron expressions are UTC-based. On Vercel Hobby, each configured cron job must run no more than once per day and the invocation may occur within the configured hour rather than at an exact minute. The three daily-report entries are therefore separate once-per-day jobs, not one hourly expression. If the project plan has stricter scheduling behavior, the exact arrival time cannot be guaranteed; the database claim/finish state and bounded catch-up are the safety mechanisms.

On each invocation, the handler scans up to three previous Myanmar dates oldest-first. A successful date is skipped. A failed or missing date is retried. A successful Manual row for the date is treated as already delivered: the full report is not sent again, and a one-time Manual-already-sent status notice is attempted. The handler is protected by `CRON_SECRET` and must not be manually called as a test unless an explicit delivery test is approved.

## 5. Telegram bot responsibilities

| Bot responsibility | Input | Output | Main storage |
|---|---|---|---|
| KPay notification intake | MacroDroid notification webhook | Pending payment alert | `UnverifiedKpay`, `AuditLog` |
| Order group intake | `/order`, `မှာယူမှု`, free-form order text | Draft preview and action buttons | `Order`, `OrderLine`, `OrderCap` |
| Factory Handover delivery | Confirmed Order | Factory-front/vehicle-loading/gate-delivery message | `OrderDelivery`, `Order` |
| Daily accounting report | Scheduled/Manual report request | Summary/activity images and PDF | `AutoReportRun`, `AuditLog` |

The three Telegram destination environment variables are intentionally separate: `TELEGRAM_GROUP_CHAT_ID` for accounting reports and general alerts, `TELEGRAM_ORDER_GROUP_CHAT_ID` for Order intake, and `TELEGRAM_FACTORY_GROUP_CHAT_ID` for Factory Handover messages. A missing destination must fail clearly or skip only the optional notification; it must never silently create or alter business data.

## 6. Repository structure

```text
prisma/schema.prisma                         PostgreSQL models and relations
prisma/migrations/                           Additive schema migrations
src/app/layout.js                            Metadata, PWA registration, global shell
src/app/layout-client.jsx                    PIN shell and global refresh overlay
src/app/page.js                              Dashboard entry page
src/components/Dashboard.jsx                 KPI-first dashboard, ledger, reports, grouped actions
src/components/PINLogin.jsx                  PIN session and actor selection
src/app/daily-summary/page.js                Daily Summary & AI UI
src/app/activity/page.js                     Accounting Activity History UI
src/app/orders/page.js                       Order, history, and trash UI
src/app/auto-report-status/page.js           Read-only Manual/Auto run status UI
src/app/data-management/page.js              Backup, restore, and data management UI
src/lib/database.js                           Runtime additive schema readiness
src/lib/daily-report.js                       Report data, images, and PDF generation
src/lib/daily-report-delivery.js               Daily Telegram report assembly/delivery
src/lib/auto-report-status.js                 Run claims, locks, status, and notice state
src/lib/auto-report-notice.js                 Manual-already-sent status message
src/lib/order-service.js                      Order persistence and status transitions
src/lib/order-utils.js                       Deterministic order parsing/formatting
src/lib/order-ai.js                          Bounded optional AI order extraction
src/lib/order-delivery.js                    Factory notification and batch delivery
src/lib/telegram.js                          Telegram API, keyboards, callback helpers
src/lib/kpay.js                              KPay amount and name parsing
src/middleware.js                            Session middleware and external-path allowlist
public/service-worker-v9.js                  Network-first page worker; API bypass
public/manifest.json                         PWA metadata and icons
vercel.json                                 Cron schedules
PROJECT_REPORT.md                           Long-form project history and audit trail
docs/PRD.md                                 Product requirements and domain notes
tests/                                     Vitest regression tests
```

## 7. Database model map

| Prisma model | Responsibility | Accounting effect |
|---|---|---|
| `Customer` | Main accounting customer and current balance | Source for ledger balance |
| `Ledger` | `DEBIT`/`CREDIT` accounting transaction | Changes balance through domain logic |
| `CashSale` | Retail/wholesale cash sale | No net receivable change |
| `KpayAlias` | KPay sender-name mapping | Helps matching only |
| `UnverifiedKpay` | Pending or matched KPay notification | Does not become ledger until matched |
| `AuditLog` | Actor/action history | Accounting and operational events separated by filters |
| `AiExplanationCache` | Date/fingerprint/prompt-version AI cache | Read-only explanation cache |
| `Order` | Order draft and lifecycle | Does not become ledger automatically |
| `OrderLine` | Bottle/card quantity lines | Order-only |
| `OrderCap` | Normal/extra cap quantities | Order-only |
| `OrderDelivery` | Telegram destination delivery state | Order-only |
| `OrderAutomationSetting` | Morning batch setting | Order-only |
| `OrderBatchRun` | Batch execution record | Order-only |
| `AutoReportRun` | Manual/Auto report claim and status | Report metadata only |

All migrations are additive. Runtime schema setup is also additive and includes a lightweight readiness probe before falling back to legacy `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` safeguards. No migration in this project may use `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or an unapproved destructive delete.

## 8. API surface

The middleware requires a valid application session for normal website APIs. External callbacks and Cron routes are excluded from the session middleware only because they have their own secret guards. The Auto Report status API is session-protected and read-only.

| Method | Endpoint | Purpose | Guard |
|---|---|---|---|
| `GET/POST` | `/api/cron/daily-report` | Previous Myanmar-day report and bounded catch-up | `CRON_SECRET` |
| `GET/POST` | `/api/cron/order-batch` | Morning Order batch | `CRON_SECRET` |
| `GET/POST` | `/api/cron/order-trash-cleanup` | Archive/purge expired Order trash | `CRON_SECRET` |
| `GET` | `/api/auto-report-status` | Manual/Auto run history | App session |
| `POST` | `/api/telegram/manual-report` | PIN-protected report delivery | Manual PIN or Cron secret |
| `POST` | `/api/telegram/manual-report/reconcile` | Metadata-only record of a confirmed past Manual delivery | Manual PIN or Cron secret |
| `GET` | `/api/telegram/manual-report-preview` | Read-only report preview | App session |
| `POST` | `/api/telegram/order-webhook` | Telegram Order messages and callbacks | Telegram secret token |
| `POST` | `/api/kpay-webhook` | MacroDroid KPay notification intake | Optional KPay secret |
| `POST` | `/api/kpay-webhook/match` | Compatibility alias for KPay matching | App session/route guard |
| `GET` | `/api/unverified-kpay` | Pending/matched KPay list | App session |
| `POST` | `/api/kpay-match` | Match pending KPay to Customer | App session |
| `GET/POST` | `/api/customers` | Customer list/search/create | App session |
| `GET/PATCH` | `/api/customers/[id]` | Customer detail/profile update | App session |
| `GET/POST` | `/api/customers/[id]/transactions` | Ledger history/manual entry | App session |
| `DELETE` | `/api/transactions/[id]` | Remove a selected transaction with UI confirmation | App session |
| `GET/POST/PATCH` | `/api/customers/[id]/cash-sales` | CashSale list/create/update | App session |
| `DELETE` | `/api/customers/[id]/cash-sales/[saleId]` | Delete selected CashSale | App session |
| `GET` | `/api/daily-summary` | Selected-date summary and filtered activities | App session |
| `GET` | `/api/dashboard-kpi` | KPI-first dashboard data | App session |
| `GET` | `/api/overdue-debts` | Overdue debt alert data | App session |
| `GET/POST/PATCH` | `/api/orders` | Current/history/trash Order data | App session |
| `GET/PATCH` | `/api/order-automation` | Order batch setting | App session |
| `GET` | `/api/audit-logs` | Filtered accounting or operational history | App session |
| `DELETE` | `/api/audit-logs/[id]` | Hide selected activity record | App session |
| `GET` | `/api/reports` | Report data endpoint | App session |
| `GET/POST` | `/api/backup` | Backup export | App session |
| `GET/POST` | `/api/restore` | Add-only restore preview/confirm | App session |
| `GET` | `/api/health` | Service health | Public health check |
| `POST` | `/api/telegram/custom-message` | Controlled Telegram group message | App session and route guard |
| `GET` | `/api/vercel/build-logs` | Redacted Vercel deployment events | App session and actor allowlist |
| `POST` | `/api/ai/daily-summary` | Cached/fallback AI explanation | App session |

## 9. Environment variable contract

Only variable names belong in source documentation. Values must be configured in local `.env` or Vercel Project Settings and must never be committed.

```env
DATABASE_URL=
DIRECT_URL=
APP_PIN=
APP_SESSION_SECRET=
CRON_SECRET=
MANUAL_REPORT_PIN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_GROUP_CHAT_ID=
TELEGRAM_ORDER_GROUP_CHAT_ID=
TELEGRAM_FACTORY_GROUP_CHAT_ID=
TELEGRAM_ORDER_WEBHOOK_SECRET=
TELEGRAM_ORDER_ADMIN_IDS=
KPAY_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
MANUS_API_KEY=
MANUS_LLM_API_BASE=
MANUS_LLM_API_KEY=
MANUS_LLM_MODEL=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VERCEL_API_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=
VERCEL_BUILD_LOG_VIEWER_ACTORS=
```

`VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, and `VERCEL_TEAM_ID` are server-only build-log viewer settings. They must not be prefixed with `NEXT_PUBLIC_`. The Telegram Order webhook secret must be configured as the Telegram webhook secret-token header. The dashboard PIN is not a Telegram webhook secret.

## 10. Local development and validation

Use Node.js and npm/pnpm compatible with the lockfile. A local PostgreSQL database is required for real data operations. The build command supplies a dummy database URL only so that Prisma generation and Next.js compilation can run without connecting to production.

```bash
npm install
npm run prisma:generate
npm run dev
```

Before pushing a material change, run:

```bash
npm run lint
npm test -- --run
npm run build
git diff --check
```

Schema validation without connecting to a real database can use a dummy URL:

```bash
DATABASE_URL='postgresql://dummy:dummy@localhost:5432/dummy' \
DIRECT_URL='postgresql://dummy:dummy@localhost:5432/dummy' \
npx prisma validate
```

Tests cover KPay parsing, CashSale behavior, ledger calculations, AI cache/fallback behavior, order parsing/customer matching, Telegram keyboards/callback flows, report catch-up/idempotency, manual report state, middleware access policy, and delivery notice wording. Production report/Cron tests must use read-only probes unless the owner explicitly approves a real Telegram delivery.

## 11. PWA and smooth-loading behavior

The global shell registers `public/service-worker-v9.js`. API requests bypass the service worker and always reach the server. Page requests use a bounded network-first fetch and fall back to a cached page only when the network is unavailable. The service worker does not fabricate API `503` responses.

Authenticated pages display a small fixed refresh button at the upper safe-area corner. It first asks the active service worker to update and then performs a normal page reload. The control is intentionally compact, keyboard-accessible, safe-area aware, and separate from destructive actions. It does not mutate database data; it only revalidates the page and APIs through the normal load flow.

The Dashboard loads KPI first, then overdue data and primary ledger/customer data, with detailed summaries, KPay, Orders, and secondary data in background stages. The non-critical `/api/dashboard-pulse?days=7` route aggregates the most recent seven Myanmar calendar days, including the current Myanmar day, in one server-side request. Its `Ledger Pulse` panel renders paid, debt-increase, and CashSale amounts as separate animated plant-like columns; CashSale is never mixed into Customer balance/net receivables. Each critical request has  bounded timeout/error/retry behavior so a stale loading label cannot remain forever. A cached browser snapshot is only used to keep the screen useful while revalidation is in progress; successful server responses replace it.

### 11.1 Overdue alert audio (implemented)
When the authenticated Dashboard receives a non-empty overdue-debt list, it attempts to play the owner-provided `public/audio/overdue-debt-notification.m4a` file once from the beginning. The alert is non-looping and is marked complete only after the audio reaches its `ended` event. A local permission preference is retained for 30 days, and a Myanmar-calendar-day guard prevents the same alert from replaying after a refresh or PWA reload on that day. If iPadOS/Safari blocks autoplay, a small in-app `အသံဖွင့်ရန်` retry button and `iPad Allow လမ်းညွှန်` are shown only when the stored preference has expired or is unavailable. A website cannot reliably navigate directly to an exact iPad System Settings page, so the fallback gives the short manual path instead. Audio playback and its local flags do not write Customer, Ledger, CashSale, Order, or balance data.

### 11.2 Background music and navigation persistence (implemented)
The authenticated root shell mounts one global background player after PIN/actor authentication. It uses the four owner-provided tracks in sequence, loops from the fourth track to the first, and targets low volume `0.12`. The player records track and playback position in a browser checkpoint on `timeupdate`, `pagehide`, and `beforeunload`, so a refresh can resume from the saved position. Mute/unmute changes only the current audio element's `muted` state and local preference; it does not call `load()`, replace the source, reset `currentTime`, or restart a live track.

The notification owns the audio channel while it is actively playing. The background player pauses for notification start and for an open overdue-detail modal, resumes after notification end or modal close, and starts from the fallback status when there is no overdue alert or when notification autoplay is blocked/error. The overdue status is persisted briefly so a `CustomEvent` race cannot leave background music waiting forever. Same-origin application links use Next client-side navigation, keeping the root shell and global player mounted across Dashboard, Orders, Daily Summary, Activity, Ledger, and related pages.

Browser and iPadOS autoplay rules remain outside website control. The app makes a best-effort automatic `play()` attempt, remembers successful application permission for 30 days, and exposes the existing mute/unmute control as the user-gesture fallback. It cannot guarantee sound without a gesture when the browser blocks autoplay.

## 12. Future plan

| Priority | Future work | Safety/acceptance condition |
|---|---|---|
| High | Verify the next scheduled Auto Report invocation and Vercel runtime logs | Confirm report date, recipient, counts, status notice, and no duplicate full report |
| High | Add delivery progress/outbox metadata for partial Telegram file failures | Retry missing files without resending already acknowledged files |
| High | Add KPay provider event ID/fingerprint deduplication | Same notification cannot create multiple pending records |
| Medium | Add API contract constants or generated route inventory | One canonical name for endpoint, action, status, and environment variable |
| Medium | Add production smoke checks for every Telegram callback button | One tap/one callback, prompt answer, deterministic state transition |
| Medium | Improve responsive table/card layouts on small phones and iPad | No horizontal clipping, touch targets remain usable, no hidden safety controls |
| Medium | Add status monitoring/notification for failed or missing Auto Reports | Alert must not itself trigger an unapproved duplicate report |
| Medium | Add Customer and Order CSV import with preview | Add-only, duplicate preview, no automatic accounting Customer creation from Order-only rows |
| Medium | Harden cross-browser autoplay and hidden-tab/PWA lifecycle behavior | Preserve the implemented four-track sequencing, checkpoint resume, mute preference, and notification priority without bypassing browser autoplay policy |
| Low | Separate Inventory/Production Telegram group | Keep factory-front handover separate from bottle production/inventory planning |
| Low | Add delivery batch planning and upcoming-days view | Read-only planning first, explicit confirmation before operational changes |

## 13. Deployment checklist

Before deploying, verify that the intended branch is `main`, the production URL is `newlifeledger.vercel.app`, the Vercel build is successful, and environment variable names are present for the relevant flows. After deploying, perform only read-only checks first: `/api/health`, authenticated Dashboard, Auto Report status, grouped controls, and no-auth Cron `401`. Do not call the authenticated Cron endpoint or Manual Report send endpoint as a smoke test without explicit approval because those actions can create Telegram messages.

After the next scheduled window, inspect Auto Report status and Vercel Cron runtime logs. The expected report date is the previous Myanmar calendar day, not the day on which the message appears. For example, a report displayed in Telegram on the morning of `2026-08-27` normally has report date `2026-08-26`.

## 14. References

- [Project source repository](https://github.com/theimhtikesoe/New-Life-Ledger)
- [Production website](https://newlifeledger.vercel.app)
- [Project report and audit history](./PROJECT_REPORT.md)
- [Product requirements](./docs/PRD.md)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Cron management and reliability](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
