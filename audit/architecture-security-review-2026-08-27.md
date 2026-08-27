# Architecture, database, and API review — 2026-08-27

## Scope

This review covers the current Next.js App Router repository, Prisma/PostgreSQL schema, Vercel Cron configuration, Telegram/KPay callbacks, and business-data boundaries. It is a read-only code audit plus narrowly scoped security hardening. No production database or business row was changed by the audit.

## Verified structure

The Prisma schema currently contains 14 intentionally distinct models: `Customer`, `Order`, `OrderLine`, `OrderCap`, `OrderDelivery`, `OrderAutomationSetting`, `OrderBatchRun`, `KpayAlias`, `Ledger`, `CashSale`, `AuditLog`, `AiExplanationCache`, `AutoReportRun`, and `UnverifiedKpay`. The main model names are unique, foreign keys are explicit, Order child rows cascade only with their Order, and the Order-to-Customer relation uses `SetNull` so deleting an accounting Customer does not delete an Order.

`prisma validate` passed, Prisma Client generation passed, and the migration directory contains no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or equivalent destructive SQL. Runtime schema readiness checks include all current tables and the two Manual-report notice columns. The manual notice migration is additive.

## Guard findings and fixes

The following two access-policy issues were found and fixed locally:

1. `/api/auto-report-status` was unnecessarily public in middleware even though it exposes report metadata. It is now session-protected; the page still works after normal PIN/session authentication.
2. `/api/kpay-webhook/match` was a public compatibility alias to the balance-changing KPay matching route. It is now session-protected. The actual external KPay intake remains `/api/kpay-webhook`, while matching requires the website session.

The external callback exceptions remain deliberate: `/api/kpay-webhook` uses `KPAY_WEBHOOK_SECRET` when configured, `/api/telegram/order-webhook` requires `TELEGRAM_ORDER_WEBHOOK_SECRET`, and Cron paths require `CRON_SECRET`. Normal website routes use the application session middleware.

## Accounting and Order boundaries

`CashSale` remains separate from `Ledger` and must not mutate `Customer.current_balance` or net receivables. Order-only customer names remain on `Order` fields and are not inserted into the accounting `Customer` table. Order audit actions and OrderBatch entities are excluded from accounting Activity History and Daily Report activity output, while Order History retains them.

## Cron reliability decision

The primary and two retry entries all target the idempotent `/api/cron/daily-report` handler. The handler uses per-date claim/finish state, scans bounded previous Myanmar dates, skips successful dates, retries failed/missing dates, and recognizes successful Manual or reconciled-Manual rows. The separate retry entries are once-per-day jobs, which respects Vercel Hobby's once-per-day-per-job restriction; an hourly expression was intentionally not used.

The exact Vercel runtime invocation log remains unverified because the sandbox browser reached the Vercel login page. No authenticated Cron invocation or Telegram delivery was triggered during this audit.

## Remaining hardening

The KPay webhook remains backward-compatible when `KPAY_WEBHOOK_SECRET` is absent; production should keep that secret configured to prevent unauthorized notification injection. Provider-level KPay event ID/fingerprint deduplication remains a future task. The Telegram callback path already uses immediate callback acknowledgement, database delivery locks, update-ID duplicate checks for incoming messages, and unique delivery constraints. A production smoke test must still be performed with explicit approval because it can create Telegram messages.
