# New Life Ledger — Vercel to VPS Migration Future Plan

> **Status:** Planning only. This document does not perform or authorize a migration.
>
> **Current deployment:** Vercel — `https://newlifeledger.vercel.app`
>
> **Repository:** `theimhtikesoe/New-Life-Ledger`
>
> **Important:** The migration must preserve all PostgreSQL business data. No Customer, Ledger, CashSale, Order, balance, report, Telegram, or audit record may be deleted or reset as part of this plan.

## 1. Goal

Run New Life Ledger on the existing VPS while preserving the current Vercel deployment as a rollback option until the VPS deployment is verified.

The VPS deployment must retain:

- Next.js dashboard and PIN/session authentication
- PostgreSQL/Prisma data access
- Customer, ledger, cash-sale, order, production, and report workflows
- KPay/MacroDroid webhook intake
- Telegram order, factory handover, and daily report delivery
- Scheduled daily report and order-maintenance jobs
- PWA assets and service-worker behavior
- Myanmar timezone behavior (`Asia/Yangon`, UTC+06:30)

## 2. Current application profile

| Area | Current implementation |
|---|---|
| Framework | Next.js 14 App Router, JavaScript/React |
| Runtime | Node.js server runtime |
| Package manager | pnpm (`pnpm-lock.yaml`) |
| Database | PostgreSQL through Prisma 5 |
| Build | `pnpm build` (`prisma generate && next build`) |
| Start | `pnpm start` (`next start`) |
| External services | Telegram Bot API, KPay/MacroDroid webhook, optional Manus API |
| Automation | Three Vercel Cron routes |
| Public app | `https://newlifeledger.vercel.app` |

## 3. Migration principles

1. **Plan first, change second.** The running Vercel app remains unchanged during preparation.
2. **No destructive database operations.** Do not use `prisma migrate reset`, `DROP TABLE`, `TRUNCATE`, or destructive cleanup to prepare the VPS.
3. **Backup before any database operation.** Keep a verified PostgreSQL backup outside the application directory.
4. **Use a staging port first.** Run Next.js on a localhost port such as `127.0.0.1:3000` before exposing a public domain.
5. **Keep Vercel available for rollback.** Do not delete the Vercel project or change production DNS until verification is complete.
6. **Secrets stay out of Git.** Never commit `.env`, database URLs, bot tokens, PINs, session secrets, or live business data.
7. **Separate the app from Hiddify.** Hiddify currently owns public ports 80/443; the Ledger app must be routed through a separate subdomain and localhost upstream.

## 4. Proposed VPS architecture

```text
ledger.example.com
        |
        v
Existing VPS edge proxy (HAProxy/rpxy/Hiddify routing)
        |
        v
127.0.0.1:3000  ->  Next.js New Life Ledger
        |
        v
Existing PostgreSQL database or a separately migrated PostgreSQL instance
```

The Hiddify public listeners on ports 80/443 must not be replaced or taken offline for this application. A dedicated Ledger subdomain should route only to the Next.js upstream.

## 5. Environment variable inventory

### Required application/runtime variables

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://ledger.example.com
DATABASE_URL=...
DIRECT_URL=...
APP_PIN=...
APP_SESSION_SECRET=...
MANUAL_REPORT_PIN=...
CRON_SECRET=...
```

### Telegram and external callback variables

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_GROUP_CHAT_ID=...
TELEGRAM_ORDER_GROUP_CHAT_ID=...
TELEGRAM_FACTORY_GROUP_CHAT_ID=...
TELEGRAM_ORDER_WEBHOOK_SECRET=...
TELEGRAM_ORDER_ADMIN_IDS=...
CUSTOMER_WEBSITE_ORDER_SECRET=...
```

### Optional AI/read-only integration variables

```env
MANUS_API_KEY=...
MANUS_LLM_API_BASE=...
MANUS_LLM_API_KEY=...
MANUS_LLM_MODEL=...
MCP_READONLY_TOKEN=...
```

### Vercel-only or feature-specific variables

```env
VERCEL_API_TOKEN=...
VERCEL_PROJECT_ID=...
VERCEL_TEAM_ID=...
VERCEL_BUILD_LOG_VIEWER_ACTORS=...
VERCEL_OIDC_TOKEN=...
BUILT_IN_FORGE_API_KEY=...
BUILT_IN_FORGE_API_URL=...
```

These must not be copied to the VPS automatically. Include them only if the corresponding runtime feature is still required and the source code confirms that the variable is needed outside Vercel.

### Prisma connection tuning variables

```env
PRISMA_CONNECTION_LIMIT=...
PRISMA_CONNECT_TIMEOUT=...
PRISMA_POOL_TIMEOUT=...
```

Use only after checking the database provider's pooler limits. Do not guess values in production.

## 6. Database plan

The repository uses PostgreSQL and contains additive Prisma migrations. The database is the source of truth for business data.

### Preferred initial approach

Run the VPS application against the existing production PostgreSQL database while keeping the existing `DATABASE_URL`/`DIRECT_URL` values private. This avoids an immediate data copy and reduces cutover risk.

Before doing this, verify:

- The VPS can reach the database host and port.
- The database provider allows the VPS source IP.
- SSL requirements are preserved.
- Connection-pool limits are sufficient.
- Prisma migration status matches the deployed schema.
- The application uses the intended production database, not a development database.

### Optional later database migration

If the database must move to the VPS:

1. Schedule a maintenance window.
2. Create a full PostgreSQL logical backup.
3. Restore into a new PostgreSQL database.
4. Verify table count, row counts, indexes, constraints, and recent timestamps.
5. Run application read-only checks against the restored database.
6. Run a controlled write verification only after backup validation.
7. Keep the original database unchanged until rollback is no longer needed.

## 7. Scheduled jobs to replace Vercel Cron

The repository defines these routes:

| Route | Current purpose | VPS replacement |
|---|---|---|
| `/api/cron/daily-report` | Previous Myanmar-day report | systemd timer or protected cron request |
| `/api/cron/order-batch` | Morning order batch | systemd timer or protected cron request |
| `/api/cron/order-trash-cleanup` | Archive/purge expired order records | systemd timer or protected cron request |

Each job must send:

```http
Authorization: Bearer <CRON_SECRET>
```

The VPS scheduler must use Myanmar-time requirements converted to UTC or a timezone-aware systemd timer. Job execution must remain idempotent and must not send duplicate Telegram reports or duplicate factory notifications.

Do not manually invoke the production report route as a casual test because it can deliver Telegram messages.

## 8. Webhook cutover plan

### KPay/MacroDroid

The external sender currently posts to:

```text
POST /api/kpay-webhook
```

After a domain cutover, update the sender to the new HTTPS URL. Keep the webhook secret unchanged unless a deliberate secret rotation is planned. Perform a controlled test with a clearly identified test notification and verify duplicate protection before normal use.

### Telegram order webhook

The Telegram bot webhook must point to the new HTTPS URL for:

```text
POST /api/telegram/order-webhook
```

Before changing it, verify the new route returns the expected unauthorized response without the secret and does not mutate the database during a no-auth probe. Change the Telegram webhook only after the VPS domain and TLS certificate are working.

### Customer website order import

If the customer website calls the Ledger order endpoint, update its destination URL and preserve `CUSTOMER_WEBSITE_ORDER_SECRET`. Verify signature rejection for an incorrect secret before accepting normal traffic.

## 9. Build and service plan

Expected application preparation commands:

```bash
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm build
```

Expected runtime:

```bash
pnpm start
```

Recommended service properties:

- Dedicated non-root service user
- Working directory outside Hiddify's application directory
- `NODE_ENV=production`
- Private `.env` file with mode `0600`
- Automatic restart on failure
- Log rotation
- Health endpoint or safe public page check
- No arbitrary command execution from the web application

A future implementation should add a systemd unit and deployment procedure only after the repository and VPS paths are reviewed together.

## 10. Reverse proxy and TLS plan

The existing Hiddify edge currently uses public ports 80/443. The Ledger app should be exposed through a separate subdomain, for example:

```text
ledger.example.com
```

The edge configuration must:

- Preserve WebSocket/upgrade behavior where applicable.
- Forward HTTPS requests to `127.0.0.1:3000`.
- Preserve the original host and protocol headers.
- Apply request timeouts appropriate for report/PDF routes.
- Avoid changing Hiddify subscription routes.
- Obtain/renew a valid certificate for the Ledger subdomain.

Do not edit the Hiddify proxy configuration until a complete backup and rollback method exists.

## 11. Verification checklist

### Read-only checks

- [ ] Repository revision and clean working tree recorded.
- [ ] Node.js, pnpm, Prisma, and PostgreSQL versions recorded.
- [ ] Environment variable names compared with source references.
- [ ] Current Vercel production health checked.
- [ ] Database provider and connection mode confirmed.
- [ ] Existing Hiddify listeners and available ports recorded.

### Staging checks

- [ ] App builds successfully with production-like variables.
- [ ] Next.js starts on a private localhost port.
- [ ] PIN login and actor selection work.
- [ ] Dashboard reads the expected production data.
- [ ] No Customer/Ledger/CashSale/Order data is changed by smoke tests.
- [ ] PWA manifest and service worker load.
- [ ] Report preview generation works without sending a Telegram report.
- [ ] Cron routes return 401 without the secret.

### Cutover checks

- [ ] HTTPS certificate is valid.
- [ ] Ledger subdomain routes to the VPS app.
- [ ] KPay/MacroDroid webhook is updated.
- [ ] Telegram webhook is updated.
- [ ] VPS timers are installed and logged.
- [ ] One controlled end-to-end webhook test is approved and performed.
- [ ] Vercel remains available for rollback.

## 12. Rollback plan

If the VPS deployment fails:

1. Restore DNS/webhook destinations to the Vercel URL.
2. Stop the VPS Ledger service if it is writing to the shared database.
3. Disable VPS scheduled jobs to prevent duplicate reports or cleanup.
4. Do not reset or restore the database unless a separate approved recovery plan exists.
5. Review logs and preserve the failed deployment for diagnosis.
6. Keep Vercel production active until the issue is resolved.

## 13. Explicit non-goals for the future migration

This plan does not authorize or include:

- Deleting the Vercel project
- Deleting or resetting the production database
- Rotating secrets without a separate approval
- Changing Hiddify users, subscriptions, or VPN configuration
- Replacing Hiddify's ports 80/443
- Sending Telegram test messages without approval
- Rewriting application business logic
- Adding an arbitrary SSH command-execution web panel

## 14. Recommended next step

The next technical step should be a **read-only VPS compatibility audit** for this repository:

1. Confirm Node.js/pnpm availability.
2. Confirm free local application port.
3. Confirm the VPS can reach the PostgreSQL provider.
4. Confirm the intended Ledger subdomain and DNS owner.
5. Confirm whether Hiddify's edge can route that subdomain safely.
6. Prepare a staging-only run without changing DNS, webhooks, database records, or Vercel production.

Only after those checks pass should implementation files such as a systemd unit, reverse-proxy route, or deployment script be proposed.
