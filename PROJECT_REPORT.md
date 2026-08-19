# New Life Ledger — Project Report

> **Purpose of this document:** This file is the shared project context for the owner, developers, and future AI agents. Every material feature change, bug, test result, deployment result, data-safety decision, and remaining task must be recorded here before the work is considered complete.

## 1. Project Identity

**Project name:** New Life Ledger

**Production website:** <https://newlifeledger.vercel.app>

**Repository:** <https://github.com/theimhtikesoe/New-Life-Ledger>

**Primary purpose:** New Life Ledger is a mobile-friendly business ledger for managing customers, customer balances, payments, debt increases, customer transaction history, activity tracking, backup/restore, daily summaries, and automated Telegram reporting.

The project is a safety-sensitive data system. The most important non-functional requirement is that existing customer, balance, ledger, and audit data must never be deleted, overwritten, corrupted, or silently changed by a new feature.

## 2. Technology Stack

| Area | Current implementation |
|---|---|
| Frontend | Next.js 14 App Router, React, Tailwind CSS |
| Backend | Next.js server routes under `src/app/api` |
| Database | PostgreSQL, accessed through Prisma ORM |
| Schema | `prisma/schema.prisma` plus migrations and runtime-safe database setup |
| Hosting | Vercel |
| Package manager | pnpm; Vercel requires a lockfile that matches `package.json` |
| Spreadsheet backup | `xlsx` |
| Image processing | `sharp` for image conversion; the current report experiment also includes `@resvg/resvg-js` |
| PDF generation | `pdf-lib`; PDFKit was removed after the Vercel `Helvetica.afm` serverless error |
| Authentication | Existing PIN login plus selected actor name stored in browser local storage |
| External delivery | Telegram Bot API |
| Scheduling | Vercel Cron, configured in `vercel.json` |

## 3. Business Users and Actor Tracking

The login flow allows the operator to select one of four actors:

| Actor | Meaning |
|---|---|
| `ဖေဖေ` | Named business user |
| `ပုံ့ပုံ့` | Named business user |
| `ဆောင်းဦး` | Named business user |
| `Staff` | Staff account |

The selected actor is passed to write APIs through the `x-actor-name` request header. The audit helper validates the actor against the allowed list. If the actor is missing or invalid, the system uses the safe fallback `Staff` for new audit records. Historical records that do not have an actor remain blank rather than being assigned a false person.

## 4. Main Features Already Implemented

### 4.1 Customer and Ledger Management

The application manages customers and customer ledger entries. Ledger entries distinguish payments (`DEBIT`) from debt increases (`CREDIT`). Customer detail pages show the running account and transaction history.

Customer transaction loading was optimized with server-side pagination. The current target is 50 transaction rows per request, with the UI loading additional pages only when needed. This avoids loading an unnecessarily large transaction history into the browser as the database grows.

### 4.2 Audit and Activity History

An `AuditLog` table was added to record important actions. Supported action categories include:

| Action | Burmese display meaning |
|---|---|
| `PAYMENT` | ငွေချေ |
| `DEBT_INCREASE` | အကြွေးတိုး |
| `CREATE` | အသစ်ထည့် |
| `UPDATE` | ပြင်ဆင် |
| `RESTORE` | ပြန်ယူ |
| `DELETE` | ဖျက် |
| `PERMANENT_DELETE` | အပြီးဖျက် |

The Activity History page is at `src/app/activity/page.js`. It supports date, actor, and action filters. It displays current audit events and also integrates legacy ledger entries so that older payments and debt increases remain visible even when no historical actor is known.

For legacy events, the actor is intentionally blank, the source is marked as `အရင်စာရင်း`, and the system does not invent a user identity.

### 4.3 Daily Summary

The Daily Summary page is at `src/app/daily-summary/page.js`. Its UI currently contains the following sections:

| Section | Contents |
|---|---|
| Summary cards | ငွေချေသူ count/amount, အကြွေးတိုးသူ count/amount, transaction total, audit action total |
| Customer summary | Customer, payment count/amount, debt-increase count/amount |
| Payment Type | Payment method and total amount |
| Date selection | A selected business date |

The source API is `src/app/api/daily-summary/route.js`.

### 4.4 Data Management

The Data Management page is at `src/app/data-management/page.js`.

The backup flow exports an official Excel workbook containing customers, transactions, and audit history. The restore flow is add-only and intentionally has two stages:

1. Preview the workbook and calculate records that can be added.
2. Confirm the restore only after the operator checks the preview.

The restore system must not update or delete existing records. Duplicate records are skipped. This is a core data-safety rule.

### 4.5 Telegram Daily Report

The scheduled report route is `src/app/api/cron/daily-report/route.js`.

The intended report period is the previous Myanmar calendar day:

> `00:00–23:59 (Myanmar time)`

The intended delivery is PDF plus summary image to both the private Telegram chat and the Telegram group. The route is protected by `CRON_SECRET`. Both `GET` and protected `POST` are available so that a manual test can be initiated from Data Management without exposing the secret in chat.

The Telegram helper is `src/lib/telegram.js`. It sends an image with `sendPhoto` and a PDF with `sendDocument` to the configured recipients.

The relevant environment variable names are:

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_PRIVATE_CHAT_ID` | Private chat recipient |
| `TELEGRAM_GROUP_CHAT_ID` | Group recipient |
| `CRON_SECRET` | Protected cron/manual trigger secret |

Secret values must never be written into this report, committed to Git, or sent in chat.

## 5. Telegram Manual Test Flow

The Data Management page contains a **Telegram Report Test** section. The operator enters `CRON_SECRET` directly into the password field and presses **Send Test Report**. The browser sends the secret only in the authorization header for that request and clears the field after a successful request.

A successful route execution should:

1. Read the previous Myanmar-day data.
2. Generate the summary image.
3. Generate the PDF.
4. Send both files to the configured private chat and group.
5. Write a `DAILY_REPORT_SENT` audit entry with `actorName: "System"` and delivery metadata.

## 6. Important Report Rendering History

### 6.1 PDFKit failure

The first serverless implementation used PDFKit. Vercel returned:

```text
ENOENT: no such file or directory, open '/var/task/.next/server/app/api/cron/daily-report/data/Helvetica.afm'
```

This was a serverless packaging/fallback-font problem, not a database problem. PDFKit was removed and replaced with `pdf-lib` plus Myanmar font handling. A local sample PDF was generated successfully after that change.

### 6.2 Myanmar text rendering failure

Telegram delivery later succeeded, but Burmese labels appeared as square boxes in both the image and PDF. The reason was that the report renderer was not producing the same Myanmar shaping result as the website browser, even though a Myanmar font file existed. Customer names and some text could render differently from labels because different glyph/shaping paths were being used.

The implementation was then changed so that the report image and the PDF are both generated from the same raster report output. The latest intended layout mirrors the website’s Daily Summary and Activity History pages instead of inventing a separate report design. The image is rendered with `@resvg/resvg-js` using `assets/NotoSansMyanmar-Regular.ttf`; the PDF embeds that rendered image rather than drawing Burmese text independently.

### 6.3 Current unresolved deployment state

The latest local build before the most recent deployment attempt compiled successfully with the resvg external-package configuration. However, the latest Vercel deployment for commit `695b779` failed. The failure logs still need to be inspected and fixed before the website should be considered ready for another Telegram test.

The failed deployment is associated with:

- Commit: `695b779` — `Render Telegram reports with website-style Myanmar layout`
- Deployment status: `failure`
- Vercel deployment URL: <https://vercel.com/theimhtikesoes-projects/new-life-ledger/D4W1pwEiiYLeBMigGobYhCKAZrfT>

Do not tell the owner that the new report version is ready for testing until the failed deployment is diagnosed, a new production deployment succeeds, and the owner confirms that a newly sent image and PDF are readable.

## 7. Git Commit History for the Recent Reporting Work

| Commit | Change |
|---|---|
| `2ca380d` | Fixed Vercel dependency resolution for cron deployment |
| `8be887c` | Synchronized pnpm lockfile for Telegram reports |
| `e8434e9` | Triggered deployment for Telegram environment |
| `42d5457` | Added protected manual Telegram report test |
| `cd6c8b8` | Bundled report font for serverless PDF generation |
| `28d8216` | Replaced PDFKit with serverless-safe PDF generation |
| `d003b46` | Embedded Myanmar font in Telegram summary image |
| `695b779` | Started website-style Myanmar report rendering; deployment currently failed |

## 8. Data-Safety Rules

All future agents must follow these rules:

> **Never delete or overwrite existing customer, ledger, balance, or audit data merely to test a report or fix rendering.**

Report generation must be read-only except for one explicit audit-log insert after a successful Telegram delivery. A failed report attempt must not create a false `DAILY_REPORT_SENT` success record.

Restore operations must remain add-only with duplicate detection and preview-before-confirm. Database migrations must be additive unless the owner explicitly approves a destructive migration after a backup.

Do not run experimental scripts against production data. Use a local fixture, a read-only query, or a production report request that does not mutate business records.

## 9. Current Known Issues and Next Actions

| Priority | Issue | Next action |
|---|---|---|
| High | Latest Vercel deployment `695b779` failed | Inspect the Vercel deployment logs and fix the exact build/runtime issue |
| High | Telegram image/PDF Burmese rendering was previously unreadable | Validate the new resvg raster approach in a successful production deployment |
| High | Manual Telegram test is not yet finally verified after the latest layout change | After deployment success, send one previous-day report and inspect both recipients |
| Medium | Project report must stay current | Add an entry here for every subsequent code change, test result, and deployment |
| Medium | Report output should mirror the two website pages | Keep Daily Summary and Activity History fields synchronized with their APIs and UI |

## 10. AI Agent Operating Instructions

Before modifying the project, an AI agent should read this file, inspect the current `git status`, inspect the relevant source files, and confirm whether the latest deployment is successful. The agent must not assume that a local build means production is healthy.

After every material update, the agent must append or revise the relevant section of this report with:

- Date/time or commit identifier.
- What changed and why.
- Files changed.
- Build/test result.
- Deployment result.
- Any remaining risk or next action.
- Explicit confirmation that existing data was not deleted or overwritten.

The report must describe secrets by variable name only. Never record token values, PINs, database URLs, or private credentials.

## References

[1]: <https://github.com/theimhtikesoe/New-Life-Ledger> — New Life Ledger source repository.
[2]: `src/app/daily-summary/page.js` — Daily Summary UI source.
[3]: `src/app/activity/page.js` — Activity History UI source.
[4]: `src/app/api/daily-summary/route.js` — Daily Summary API.
[5]: `src/app/api/audit-logs/route.js` — Activity History API with legacy integration.
[6]: `src/app/api/cron/daily-report/route.js` — Protected Telegram report route.
[7]: `src/lib/daily-report.js` — Myanmar date range, report data, image, and PDF generation.
[8]: `src/lib/telegram.js` — Telegram delivery helper.
[9]: `prisma/schema.prisma` — Database schema, including audit logging.
[10]: `vercel.json` — Vercel Cron configuration.


## 11. Latest Update — Telegram Output Still Unreadable and WASM Packaging Fix

**Date:** 2026-08-19

The owner provided a newly received Telegram image/PDF showing that Burmese labels still render as square boxes. The visible output matches the previous successful deployment, not the newest renderer code, because the website was still serving the last successful deployment while commit `695b779` had failed during Vercel output packaging.

The failed deployment log showed that the Next.js build itself completed successfully, including the daily-report route, but Vercel failed while creating the serverless deployment package with:

```text
The framework produced an invalid deployment package for a Serverless Function.
Typically this means that the framework produces files in symlinked directories.
```

The likely cause was the native `@resvg/resvg-js` binary package being traced into the Vercel serverless function. The current working fix replaces the native renderer with the pure WASM package `@resvg/resvg-wasm` and copies its WASM binary into `assets/resvg.wasm`, which is a normal repository asset. The report renderer also bundles `NotoSansMyanmar-Regular.ttf` for Burmese and `DejaVuSans.ttf` for Latin characters.

Local verification completed after this change:

| Check | Result |
|---|---|
| `pnpm build` | Passed locally; Next.js compiled and listed `/api/cron/daily-report` |
| WASM renderer fixture | Passed locally; generated a PNG using the bundled WASM renderer and Myanmar font |
| Production deployment | Not yet attempted for the current uncommitted WASM fix |
| Telegram verification | Must wait until the new production deployment succeeds; the owner’s latest screenshot is from the old deployment |
| Data safety | No customer, ledger, balance, or audit records were deleted or modified by this rendering fix |

The next required steps are to commit the WASM renderer fix, deploy it, confirm that Vercel creates the serverless functions successfully, and only then ask the owner to run one fresh Telegram test. The latest Telegram output must not be treated as evidence against the new WASM implementation until that new deployment has completed.
