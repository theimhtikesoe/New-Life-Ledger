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

## 9.1 Dashboard mobile layout refinement — 2026-09-06

The Dashboard layout was refined to match the supplied mobile reference more closely. The actor switcher remains in its own top safe rail, while the dashboard header, Customer add card, and customer list card now use an explicitly named vertical stack with a stable 1.5rem gap between adjacent visual bands. This keeps the header and the two main content cards visibly separated instead of allowing their borders and backgrounds to read as one continuous block. The change is limited to presentation structure and CSS; no customer, ledger, balance, or audit data is deleted or overwritten.

Files changed: `src/components/Dashboard.jsx`, `src/app/globals.css`.

## 9.2 Detail-page white container and top-rail refinement — 2026-09-06

The Production, Activity History, and Balance Detail pages now place their page content inside the shared inset white surface used by Dashboard and Ledger. Their shared route header also reserves a larger mobile/tablet top rail so the fixed actor switcher and the in-flow `← Dashboard` navigation link occupy separate bands rather than overlapping near the top of the viewport. Existing page-specific controls and data behavior are unchanged.

Files changed: `src/components/ProductionEntryPage.jsx`, `src/app/activity/page.js`, `src/app/balance-detail/page.js`, and `src/app/globals.css`. No customer, ledger, balance, or audit data was deleted or overwritten.

## 9.2 Detail-page white container refinement — 2026-09-06

The Production, Activity History, and Balance Detail pages now place their complete page content inside a shared inset white surface, matching the visual framing already used by Dashboard and Ledger. The existing internal section spacing and page-specific controls are preserved; this change adds only the outer border, radius, padding, and soft shadow needed to make each page read as one contained white panel on mobile and larger screens.

Files changed: `src/components/ProductionEntryPage.jsx`, `src/app/activity/page.js`, `src/app/balance-detail/page.js`, and `src/app/globals.css`. Focused layout tests passed (7 tests), the production build completed successfully, and no customer, ledger, balance, or audit data was deleted or overwritten.

## 9.3 All-route shared shell — 2026-09-06

The common `.app-page-container` now provides the same inset white frame, border, radius, padding, and soft shadow for every route page that uses the shared page layout, including Vercel Build Logs, Auto Report Status, Data Management, Orders, Daily Summary, Customer Management, Production, Activity History, and Balance Detail. The existing shared header keeps the Dashboard link, Myanmar date/time, and route title in one header frame, while the mobile/tablet top rail keeps that frame below the actor switcher. This aligns the vertical phone presentation across user roles and page transitions without changing business data or permissions.

Focused layout tests passed (7 tests) and the production build completed successfully. No customer, ledger, balance, or audit data was deleted or overwritten.

## 9.4 Shared top-control rail — 2026-09-06

The actor/user switcher on the left and refresh/settings controls on the right now have a named shared top-control rail. Dashboard, Ledger, and all route pages reserve this empty band before their header/content surfaces begin, preventing controls from sitting on top of the `← Dashboard` link or the date/time header on phone portrait layouts. The route header markup now explicitly identifies this shared rail behavior, and regression assertions cover the new spacing variables.

Focused layout tests passed (7 tests) and the production build completed successfully. No customer, ledger, balance, or audit data was deleted or overwritten.

## 9.5 All-page UI and navigation audit — 2026-09-06

The Dashboard KPI cards now use direct, date-aware Next.js links to the Ledger and Production detail pages, so selecting a KPI takes the user to a dedicated page instead of opening a modal-only view. Existing Customer/Balance, report, data-management, Activity History, and other Dashboard navigation targets were checked for route ownership and accessible labels. The Daily Sales panel and Activity History controls remain present in the shared responsive layout, while internal action buttons retain their intended local behavior for editing, pagination, modal confirmation, and retry states.

The complete Vitest suite passed: 63 test files and 254 tests. The production build also completed successfully. The audit corrected stale source-contract assertions for the current route markup and documents the intentional exclusion of the `ProductionWorker` picker cache from the Excel backup model-count contract because selected worker names are preserved in production report `involvedWorkers` data. No customer, ledger, balance, or audit data was deleted or overwritten.

## 9.6 Same-user actor selection — 2026-09-06

When the User button opens the actor selector while an actor is already active, selecting that exact same actor now closes the selector and keeps the session active without asking for the same PIN again. Selecting a different actor still requires PIN confirmation, and the idle-lock flow still clears the stored actor name so PIN confirmation remains required after the timeout. Focused actor/navigation tests passed (7 tests) and the production build completed successfully.

## 9.7 Today's Payments KPI behavior — 2026-09-06

The `ယနေ့ ငွေချေမှုများ` KPI has been restored to its original Dashboard behavior: clicking it opens the in-dashboard payment detail modal rather than navigating to Ledger. The Production KPI remains a direct link to the Production detail page. Focused KPI/navigation tests passed (11 tests) and the production build completed successfully.

## 9.8 Production and Activity shared white surface — 2026-09-06

Production and Activity History were rechecked against the other route pages. Both explicitly use the shared `app-page-container app-page-surface` frame, and the common route container now has the same small separation below the shared header before its white content surface begins. This keeps the white container, top-control rail clearance, header/content gap, border, radius, and mobile portrait rhythm consistent across these pages and the rest of the application.

Focused layout/navigation tests passed (9 tests) and the production build completed successfully. No customer, ledger, balance, or audit data was deleted or overwritten.

## 9.9 Consistent shared header height — 2026-09-06

The shared route header was refactored so every page uses the same minimum card height and vertical rhythm. The outer header now uses `min-h-[170px] flex-col justify-between`; its inner layout reserves a stable clock/title area with `min-h-[136px] flex-1 flex-col justify-between`; and production-only actor views render an invisible navigation placeholder when the Dashboard link is absent. This prevents optional navigation elements from changing the header height or shifting the date, clock, title, and page content between routes.

Focused header/layout/navigation tests passed (9 tests) and the production build completed successfully. No customer, ledger, balance, or audit data was deleted or overwritten.

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


## 12. Deployment Update — WASM Renderer Package Succeeded

**Date:** 2026-08-19

The owner shared screenshots showing that the older deployments `9dc29e1` and `695b779` were still marked as errors in the Vercel dashboard. Those screenshots were from before the new renderer deployment completed.

The latest renderer fix was committed as `744ed45` (`Use WASM renderer for deployable Myanmar reports`) and pushed to `main`. Vercel subsequently reported:

```text
Deployment has completed
```

The deployment URL is <https://vercel.com/theimhtikesoes-projects/new-life-ledger/Fh45Qog8zAmvtGAthGpdEFtQBCJF>.

This confirms that the previous invalid serverless deployment-package problem was avoided by removing the native `@resvg/resvg-js` package from the deployed implementation and using the repository-bundled `@resvg/resvg-wasm` asset instead. Local build also passed, and the WASM renderer fixture generated a PNG successfully.

The production Telegram report has not yet been considered fully verified. A fresh manual report must still be sent from the new successful deployment and checked for Burmese text, English fallback text, PDF readability, and delivery to both configured recipients. Existing database records remain untouched by the renderer/deployment changes.


## 13. Latest Update — Myanmar Text Visible, Table Layout Overlap Remains

**Date:** 2026-08-19

The owner confirmed that the latest production report now renders Burmese glyphs instead of square boxes. This validates the WASM renderer and bundled-font direction. A new screenshot then showed that several labels and values overlap inside the Customer Summary and Activity History tables.

The overlap was caused by the report SVG using fixed x-coordinates that were too close for the Burmese labels, long customer names, amount strings, and activity columns. The latest local fix widens the canvas, increases row spacing, separates the columns, reduces the risk of long text crossing into neighboring columns by clipping long values, and adds a dedicated Note column.

| Area | Layout change |
|---|---|
| Report canvas | Increased width from 1800 to 2200 units |
| Customer table | Wider separation between Customer, ငွေချေ, and အကြွေးတိုး columns |
| Payment Type | Dynamic section height based on payment-type rows |
| Activity table | Separate columns for time, actor, action, customer, amount, payment, note, and source |
| Long text | Added safe clipping with an ellipsis rather than allowing text to overlap another column |
| Data safety | No database records were changed; the update only changes report rendering |

The updated implementation compiled successfully locally and still exposes `/api/cron/daily-report`. It must be deployed and tested with a fresh Telegram report before the layout is considered final.


## 14. Latest Feedback — Layout Improved but Burmese Text Still Needs Clarification

**Date:** 2026-08-19

The owner tested the deployment after the table-spacing fix and reported that the output is better but still not acceptable. The latest screenshot shows that the report is no longer dominated by square boxes, but some Burmese glyphs appear visually crowded or incomplete and the owner cannot clearly distinguish missing glyphs from overlapping glyphs.

This is a report-rendering issue, not an Excel-data issue. The backup Excel export and add-only restore flow preserve structured values such as customer names, amounts, dates, payment types, and audit records. Downloading the Excel file and restoring it cannot automatically fix image/PDF font shaping, because the Telegram report is generated later by its own renderer. Excel restore remains useful for verifying that the underlying data is present and safe, but it is not a solution for report typography.

The next rendering investigation should compare the bundled Noto Sans Myanmar font against a bundled Padauk or other Myanmar font, while keeping the current data and add-only safety policy unchanged. The report must be judged separately on these two criteria:

| Criterion | Meaning |
|---|---|
| Data completeness | All labels, customer names, amounts, dates, payment types, notes, and activity fields exist in the output |
| Visual correctness | Burmese glyphs are shaped/readable and table columns do not overlap |

No database records were changed by this diagnosis or by the font comparison work.


## 15. Recipient Policy Update — Telegram Group Only

**Date:** 2026-08-19

The owner requested that all Telegram report delivery go to the Telegram group only. The implementation now reads `TELEGRAM_GROUP_CHAT_ID` for Telegram notifications and does not use `TELEGRAM_PRIVATE_CHAT_ID` for either daily report files or KPay webhook messages.

The daily report sends the PNG and PDF exactly once to the configured group. The successful-delivery audit summary now states that the report was sent to the Telegram group. The local production build passed after this change, and no database records were modified.


## 16. Latest Update — Group-only UI Text and Myanmar Font Readability Fix

**Date:** 2026-08-19

The owner identified remaining `private chat နှင့် group` wording in the Data Management page, the confirmation dialog, and the success message. These user-facing strings have now been changed to state clearly that the PDF and image are sent to the **Telegram group တစ်ခုတည်း**.

The latest report screenshot also confirmed that the previous Noto Sans Myanmar output was technically readable in many places but still visually difficult to read because of Myanmar glyph appearance and spacing. A local font comparison was performed using Noto Sans Myanmar, Padauk, and Noto Serif Myanmar. Padauk produced the clearest local result for the target Burmese labels, so the report renderer now bundles and uses `assets/Padauk-Regular.ttf` while retaining the Latin fallback font.

The local production build passed after both changes. The database, backup Excel content, restore policy, and existing records were not changed. A fresh production deployment and Telegram group-only test are still required before this version is considered final.


## 17. New Report Architecture — Browser-rendered Raster Image and Image-based PDF

**Date:** 2026-08-19

The owner tested the Padauk-based report and confirmed that the output still did not match the website closely enough. Repeatedly changing SVG/PDF fonts was therefore stopped. The report renderer has been redesigned to use a serverless Chromium browser through `playwright-core` and `@sparticuz/chromium`.

The new approach builds an HTML report using the same browser text-rendering path used by web pages, embeds the report font files with `@font-face`, waits for `document.fonts.ready`, and captures the complete Daily Summary plus Activity History page as a PNG screenshot. The PDF is created by embedding that exact raster image, so the image and PDF share the same rendering output and cannot diverge through separate font engines.

The previous `@resvg/resvg-wasm` dependency and `assets/resvg.wasm` asset are no longer used and have been removed. Next.js now keeps `playwright-core` and `@sparticuz/chromium` external for the server function, while the report font assets remain included through output tracing.

A local Chromium prototype rendered Burmese text successfully, and the full Next.js production build passed after the migration. No database schema, customer, ledger, audit, backup, or restore data was changed. Production deployment and a fresh Telegram group-only test remain required.


## 18. Chromium Packaging Fix After Production Error

**Date:** 2026-08-19

The first browser-rendered report deployment failed at runtime because Vercel did not include the `@sparticuz/chromium/bin` compressed Chromium assets in the serverless function. The reported error was: `The input directory "/var/task/node_modules/.pnpm/@sparticuz+chromium@149.0.0/node_modules/@sparticuz/chromium/bin" does not exist.`

The root cause was packaging/tracing, not report data or Myanmar text. The package contains `chromium.br`, `al2023.tar.br`, `fonts.tar.br`, and `swiftshader.tar.br`; the local Next.js NFT trace did not include these files before the fix. Next.js configuration now explicitly includes `./node_modules/@sparticuz/chromium/bin/**/*` under `outputFileTracingIncludes` while keeping the package external. A clean local production build passed, and the daily-report NFT manifest now lists all four Chromium bin assets.

A new production deployment is required to verify the Vercel package runtime. Existing database records remain untouched.


## 19. Remote Chromium Pack Migration

**Date:** 2026-08-19

The Vercel log showed that the full bundled Chromium deployment built successfully but failed while deploying outputs because of an invalid serverless package involving symlinked directories. The build cache reached approximately 219 MB. The failure happened after `Build Completed`, so it was a packaging limitation rather than a JavaScript compile error.

To avoid shipping the large native Chromium `bin` directory, the report renderer now uses `@sparticuz/chromium-min` and downloads the official x64 pack from the pinned v149.0.0 GitHub release at runtime. The full `@sparticuz/chromium` package and its tracing rule were removed. `playwright-core` and `@sparticuz/chromium-min` remain external server packages, while only the small report font assets are traced locally.

A local remote-pack browser test successfully launched Chromium and rendered Burmese sample text. The full Next.js production build also passed. Production deployment must still be completed and the group-only Telegram endpoint must be tested before this migration is considered final.


## 20. ETXTBSY Fix — Serialize Remote Chromium Extraction

**Date:** 2026-08-19

After the remote-pack deployment became runnable, the daily-report endpoint returned `browserType.launch: spawn ETXTBSY` while using `/tmp/chromium`. The daily route creates the PNG and PDF in parallel; both paths previously attempted to initialize/extract the same remote Chromium executable concurrently. That created a temporary executable lock race.

The renderer now uses one shared Chromium executable-path promise per serverless instance and one shared report-image promise per report object. The first request performs the remote pack extraction, and concurrent PNG/PDF calls wait for the same completed promise. Failed initialization clears the promise so a later invocation can retry safely. The local Next.js production build passed after this change, and no database/data operation was changed.


## 21. Mobile-friendly Report Redesign

**Date:** 2026-08-19

The owner confirmed that the browser-rendered report now works, but the single long image was difficult to read in Telegram's mobile preview. The report was redesigned into two independently captured browser panels: a Daily Summary image and an Activity History image. The Telegram group now receives both images followed by the PDF.

The PDF now contains two pages in the same order: page 1 is Daily Summary and page 2 is Activity History. Both pages are embedded from the same browser-rendered panel screenshots used for the PNG files, preserving identical Burmese typography and layout. This is a presentation-only change; report data, audit records, customer records, ledger records, backup, and restore logic are unchanged.

A local Next.js production build passed after the split-panel implementation. A fresh production deployment and Telegram group test are still required.


## 22. Color-coded Telegram Caption and Clear Date/Time Display

**Date:** 2026-08-19

The Telegram group caption now uses Telegram HTML formatting. It presents `NEW LIFE LEDGER` and `DAILY BUSINESS REPORT` as headings, separates `REPORT DATE` from `TIME RANGE`, and uses bold values with colored status markers for ငွေချေ, အကြွေးတိုး, Transactions, and Activity. The time range is explicitly shown as `00:00–23:59 (Myanmar Time)` so it cannot be confused with the delivery time.

The media upload helper now sends `parse_mode=HTML` for captions so the bold and code formatting is rendered by Telegram. The local Next.js production build passed. This is a caption-only presentation change and does not modify any database records or report calculations.


## 23. Confirmed Automatic Daily Schedule

**Date:** 2026-08-19

The manual test is separate from the scheduled automation. `vercel.json` schedules `/api/cron/daily-report` with `30 1 * * *`, which is 01:30 UTC and therefore 08:00 Myanmar Standard Time (UTC+06:30) every day. The endpoint is protected by `CRON_SECRET` and sends only to `TELEGRAM_GROUP_CHAT_ID`.

At each scheduled run, `getPreviousMyanmarDayRange()` calculates the previous Myanmar calendar day from `00:00` up to, but not including, the next `00:00`. The report caption explicitly displays the report date and `00:00–23:59 (Myanmar Time)`. The scheduled output uses the approved format: color-coded caption, Daily Summary image, Activity History image, and a two-page PDF. The most recent caption-format production deployment completed successfully; the next scheduled run is the final real-world automation confirmation.


## 24. Viber Partner Research and Preliminary Recommendation

**Date:** 2026-08-19

The owner wants the same daily PDF and PNG report that is sent to the Telegram group to be delivered automatically to the father's Viber account at 08:00 Myanmar time, without a person forwarding it. The chosen architecture is direct dual delivery: generate the files once in the New Life Ledger scheduled job, then send the same files independently to Telegram and Viber.

The user supplied the Viber Business Account link `https://viber.me/9595214808`, which resolves to **New Life 6miles, Taunggyi.** with a `Message business` action. This is a Business Account profile link, not an API credential.

The official Viber partner directory and supplied MessagingPartners.pdf were reviewed. Two Myanmar candidates are most relevant:

| Partner | Evidence found | Preliminary fit |
|---|---|---|
| VMG Group of Companies / VMG Myanmar | Listed by Viber as a Myanmar partner; VMG's own page advertises Viber SMS, API connectivity, high-resolution images, buttons, scalability, and SMS fallback. | Strong first contact for local support, API/media capability, and fallback. Public pricing/API reference was not found. |
| eTradeMyanmar Co., Ltd. | Listed by Viber for Myanmar with both Viber Business Messages and Viber Chatbots; established in Myanmar's TMT sector since 2003. | Strong backup or parallel contact, especially because the official Viber profile explicitly lists Business Messages. Public pricing/API reference was not found. |

The recommended next step is to contact VMG and eTradeMyanmar in parallel and request a one-recipient transactional Business Messages quote and technical test. Neither partner should be selected solely from the directory. They must confirm Myanmar delivery, one-recipient scheduling, image and PDF/file support (or HTTPS file URL support), recipient opt-in, API credentials/webhook requirements, pricing/minimum spend, and whether the existing New Life 6miles Business Account can be used as the sender.

No Viber credentials, phone number, or API integration has been added yet. Existing Telegram automation and all customer/database records remain unchanged.

References:

1. https://www.forbusiness.viber.com/en/messaging-partners/ — Viber official partner directory.
2. https://www.forbusiness.viber.com/en/messaging-partners/partner/etrade-myanmar-co — official eTradeMyanmar partner profile.
3. https://vmgmyanmar.com/business/vibersms — VMG Myanmar Viber SMS/API page.
4. https://www.forbusiness.viber.com/en/business-messages/ — Viber Business Messages official product page.


## 25. Mobile UI/UX Update — Customer, Transaction, and Activity Views

**Date:** 2026-08-19

The owner approved a mobile-first UI/UX improvement while explicitly requiring that the PIN remain unchanged and that customer data, ledger transactions, audit-log records, database schema/data, Telegram settings, Telegram delivery code, Vercel environment variables, and Cron configuration remain untouched.

The following presentation-only changes were implemented:

| File | UI-only change |
|---|---|
| `src/components/Dashboard.jsx` | Customer cards now use a mobile-first one-column layout before expanding at larger breakpoints; card actions have larger touch targets; pagination wraps on small screens; a mobile customer-list return button was added; the customer detail form uses responsive padding; transactions now have a mobile card/list rendering while the desktop table remains available at the `md` breakpoint. |
| `src/components/TransactionFilter.jsx` | Quick filters and date inputs use full-width, touch-friendly controls on small screens and retain compact controls on larger screens. |
| `src/app/activity/page.js` | Activity History now renders mobile-friendly record cards on small screens and keeps the wide table for desktop; the history header wraps safely on narrow screens. |

The implementation does not add a database migration, call a write API, change business calculations, alter the PIN value or flow, change Telegram delivery, or change any Vercel environment/configuration value.

Local verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed; Next.js compiled, lint/type checks passed, and all 7 static pages generated. |
| Protected files | `prisma/schema.prisma`, Telegram helper/cron route, `package.json`, `pnpm-lock.yaml`, and `vercel.json` unchanged. |
| Database/business records | No customer, ledger, audit, backup, or restore operation was executed. |
| Production deployment | Not yet pushed/deployed at the time of this entry; production read-only verification remains required. |

Remaining caution: the existing Next.js build warning about `themeColor` metadata remains unrelated to this UI-only change. It was not modified because the current task is limited to the approved mobile UI work and must not expand into unrelated configuration changes.


## 26. Mobile UI Deployment and Read-only Regression

**Date:** 2026-08-19  
**Commit:** `17fc88a` — `Improve mobile ledger UI`

The approved mobile UI changes were committed and pushed to `main`. The local production build had already passed before the push. Production returned HTTP 200 after the push and the dashboard loaded successfully.

After the initial loading state completed, the production dashboard showed the same baseline business data observed before the UI change: 14,242,250 Ks total balance, 156 customers, 5 overdue alerts, and 0 today's paid transactions. Customer cards, pagination, customer names, balances, and the overdue count remained present.

The deployment change was limited to presentation code and `PROJECT_REPORT.md`. No customer, ledger, audit-log, database, backup, restore, Telegram, Cron, Vercel environment, or PIN operation was executed or changed. The remaining date/time UI work is intentionally separate and has not yet been implemented.


## 27. Myanmar Date/Time Consistency and Dashboard Digital Clock

**Date:** 2026-08-19

The owner approved continuing with Myanmar date/time improvements after the mobile UI work, and requested a centered digital clock on the Index/Dashboard. The implementation keeps the existing PIN unchanged and does not modify customer, ledger, audit-log, database, Telegram, Cron, or Vercel environment data/settings.

The following UI and date-range changes were made:

| Area | Change |
|---|---|
| Dashboard | Added a centered header widget showing the current Myanmar date, live `HH:MM:SS` digital time, and `Myanmar Time (UTC+06:30)`. The clock updates once per second in the browser. |
| Dashboard KPI | Today's paid count and Today's Payments modal now compare calendar dates using Myanmar time instead of browser-local midnight boundaries. |
| Customer transactions | Customer transaction date/time display and mobile transaction cards now use Asia/Yangon formatting. Transaction filter scopes (today, month, custom range) compare Myanmar calendar dates. |
| Daily Summary | Default selected date now uses the current Myanmar date. The header explicitly displays `Report Date` and `Time Range: 00:00–23:59 (Myanmar Time)`. |
| Daily Summary API | Date filters now query the UTC interval corresponding to the selected Myanmar calendar day: 00:00 Myanmar time through the next 00:00 Myanmar time. |
| Activity History | Default date, timestamps, and API date filter now use the same Myanmar calendar/timezone behavior. |
| Shared utilities | Added `src/lib/myanmar-time.js` for server/API range calculation and `src/lib/myanmar-time-client.js` for browser formatting. Client-only date helpers remain local where required by the existing Next.js bundle behavior. |

Verification completed:

| Check | Result |
|---|---|
| Clean `pnpm run build` | Passed after resolving a client/server named-export bundling issue by keeping client helpers local and separating client/server utilities. |
| Myanmar boundary fixture | Passed: 2026-08-19 17:29:59.999 UTC maps to 2026-08-19 Myanmar time; 17:30:00.000 UTC maps to 2026-08-20 Myanmar time. |
| `git diff --check` | Passed. |
| Database/business records | No customer, ledger, audit, backup, restore, or migration operation was performed. |
| Telegram flow/settings | Unchanged. |
| Vercel environment/Cron | Unchanged. |
| PIN | Unchanged. |
| Production deployment | Pending push/deployment and read-only production verification for this date/time update. |


## 28. Myanmar Date/Time Production Verification

**Date:** 2026-08-19  
**Commit:** `e668f0c` — `Standardize Myanmar date time display`

The Myanmar date/time and Dashboard clock update was pushed to `main` and became visible in production. The Dashboard now shows the centered live date/time widget with the current Myanmar date, changing seconds, and `Myanmar Time (UTC+06:30)`. The settled dashboard data remained unchanged at 14,242,250 Ks total balance, 156 customers, 5 overdue alerts, and 0 today's paid transactions.

Production Daily Summary displayed `Report Date: Wednesday, 19 August 2026` and `Time Range: 00:00–23:59 (Myanmar Time)`. Production Activity History defaulted to 2026-08-19, loaded 11 existing records, and displayed timestamps using Myanmar time, such as `19 Aug 2026, 08:06`.

The date-boundary fixture confirmed that UTC `2026-08-19T17:29:59.999Z` belongs to Myanmar date 2026-08-19, while UTC `2026-08-19T17:30:00.000Z` begins Myanmar date 2026-08-20. No customer, ledger, audit-log, backup, restore, database, Telegram, Cron, Vercel environment, or PIN operation was performed.


## 29. Telegram Group Caption Content and Formatting Review

**Date:** 2026-08-19

The Telegram daily-report caption was reviewed against the owner's required group-only delivery format. The caption continues to use Telegram HTML parse mode and now includes a clearer delivery context in addition to the report metrics.

The final main caption contains the following separated sections:

| Section | Content and formatting |
|---|---|
| Header | Bold `NEW LIFE LEDGER` and `DAILY BUSINESS REPORT`. |
| Report date | Bold `REPORT DATE` followed by the generated previous Myanmar calendar date in a code block. |
| Covered period | Bold `TIME RANGE` followed by `00:00–23:59 (Myanmar Time)` in a code block. |
| Delivery context | Bold `DELIVERY` followed by `08:00 Myanmar Time • Telegram Group` in a code block. This describes the intended schedule and recipient scope; it does not replace the Vercel Cron schedule. |
| Metrics | Green paid line, red debt-increase line, blue transaction-count line, and purple activity-count line. Counts use code formatting and amounts use bold formatting. |
| Attachments | A `FILES` line identifies the three delivered files: Daily Summary PNG, Activity History PNG, and the two-page PDF. |

Attachment captions were also clarified. The Activity History image caption now includes its title, report date, and Myanmar time range. The PDF caption now identifies the report date and states that page 1 is Daily Summary and page 2 is Activity History.

The delivery helper remains group-only and sends exactly three messages in sequence: Daily Summary PNG, Activity History PNG, and the two-page PDF. No private chat recipient or Viber recipient was added.

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed. |
| `git diff --check` | Passed. |
| Protected data/config files | Database schema, package/lock files, Vercel configuration, Daily Summary API, and Activity History API had no changes in this caption update. |
| Customer/ledger/audit data | No data write, migration, restore, deletion, or overwrite was performed by this update. |
| Telegram recipient scope | `TELEGRAM_GROUP_CHAT_ID` remains the only configured recipient in the delivery helper. |


## 30. PIN-after-login Dashboard Type Error Handling

**Date:** 2026-08-19

A user reported that, on another phone, entering the existing PIN and reaching the Dashboard sometimes displayed a red `Type error` banner. Read-only checks showed that the Dashboard initial load requests the customers list, pending KPay list, and all-customer KPI data in parallel. The production GET endpoints returned HTTP 200 during verification, and the Dashboard loaded the existing baseline data normally: 14,242,250 Ks total balance, 156 customers, and 5 overdue alerts. This indicates an intermittent client/network or API request failure rather than a PIN or database-record problem.

The fix is UI-only. Dashboard errors that appear as browser `TypeError`, `Type error`, `Failed to fetch`, `NetworkError`, or `Load failed` are now shown as a clear Burmese connection message instead of the raw browser error. The error banner also includes a `ပြန်စမ်းမည်` retry button that re-runs the existing read-only dashboard load requests. The underlying PIN, API endpoints, database queries, customer/ledger/audit records, Telegram delivery, Cron, Vercel environment, and data mutation logic were not changed.

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed. |
| `git diff --check` | Passed. |
| Protected files | No changes to database schema, package/lock files, Vercel configuration, Daily Summary API, Activity History API, daily-report route, or Telegram helper. |
| Production GET checks | `/api/customers` and `/api/unverified-kpay?status=PENDING` returned HTTP 200 during diagnosis. |
| Data safety | No customer, ledger, audit-log, restore, delete, or database write was performed by the fix. |


## 31. Collapsed Add Customer Mobile UI

**Date:** 2026-08-19

The Dashboard's Add Customer section was changed to start in a collapsed state. On first entry, the mobile screen now shows the `Customer အသစ်ထည့်ရန်` title, supporting text, and the `Add` control only, allowing the customer list and KPI area to appear earlier in the viewport. Pressing `Add` expands the existing form so the user can enter name, phone number, starting balance, and submit the customer.

The existing form validation, create-customer request, actor tracking, optimistic UI behavior, and post-submit collapse behavior remain unchanged. This is a single UI state change in `Dashboard.jsx`; no database schema, customer records, ledger transactions, audit logs, PIN, Telegram delivery, Cron schedule, or Vercel environment was changed.

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed. |
| `git diff --check` | Passed. |
| Protected files | No changes detected. |
| Data safety | No customer, ledger, audit-log, restore, delete, or database write was performed by the UI change. |


## 32. Reliable Dashboard Loading and Network Retry

**Date:** 2026-08-19

The Dashboard initial data-loading flow was strengthened after a Myanmar phone intermittently showed a connection error and temporary zero values while the page itself had loaded. The change is UI/data-fetch handling only and does not change the API contracts or database.

The Dashboard now makes the initial customer request only once when no search term is active, rather than requesting the same all-customer data twice. Read-only GET requests use a 12-second timeout and up to three attempts with short backoff for network errors and server-side 5xx responses. Aborted requests are still cancelled normally when the search term changes or the component unmounts. Non-GET operations remain single-attempt to avoid duplicate customer, ledger, restore, or other mutations.

While the initial request is pending, KPI cards show `ရယူနေသည်...` instead of displaying misleading zero values. If all data cannot be loaded, KPI values show a dash and the customer list shows a clear data-not-ready state with a retry button. Raw browser messages such as `Type error`, `Failed to fetch`, `NetworkError`, `Load failed`, and timeout messages are converted into a Burmese connection message; the existing retry action remains available.

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed. |
| `git diff --check` | Passed. |
| Protected files | No database schema, package/lock, Vercel, Daily Summary API, Activity History API, Telegram, or Cron changes. |
| Mutating operations | No customer, ledger, audit-log, restore, delete, or database write was added. |
| Data safety | Existing records remain read-only during loading/retry; only GET requests are retried. |


### Production Verification for Section 32

The production deployment for commit `a5f3cff` was verified with a cache-busted Dashboard URL. During the initial request window, KPI cards showed `ရယူနေသည်...` and the customer list showed its loading spinner; they did not show misleading zero values. After the read-only requests completed, the Dashboard displayed 14,242,250 Ks total balance, 156 customers, 5 overdue alerts, and 0 today's paid transactions. The Add Customer section remained collapsed on first entry. The `/api/customers` response returned 156 customer records, and no write operation was performed during this verification.


## 33. iPad/Tablet Dashboard Header UI

**Date:** 2026-08-19

The Dashboard header was adjusted for iPad and tablet widths after a screenshot showed the Myanmar title wrapping awkwardly and the right-side action buttons appearing uneven. The header now uses balanced responsive columns with a bounded title area, a stable centered Myanmar date/time block, and a uniform action-button grid. The Myanmar title uses a responsive clamp and tighter line-height so it remains readable without excessive vertical growth. Data Management, Report Excel, Recycle Bin, and overdue-alert controls use consistent minimum height, alignment, spacing, and width behavior at tablet sizes.

This is a presentation-only change in `Dashboard.jsx`. Button actions, loading/retry behavior, customer/ledger/audit data, PIN, database, Telegram delivery, Cron schedule, and Vercel environment were not changed.

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed. |
| `git diff --check` | Passed after whitespace cleanup. |
| Protected files | No changes to schema, package/lock, Vercel, API, Telegram, or Cron files. |
| Data safety | No customer, ledger, audit-log, restore, delete, or database write was performed. |


### Production Verification for Section 33

The production deployment for commit `624fe1d` returned HTTP 200 and was checked in an authenticated browser session after data loading completed. At the tablet-sized viewport, the title area remained bounded, the Myanmar date/time stayed centered, and the overdue alert, Data Management, Report Excel, and Recycle Bin controls appeared in a consistent action grid. Existing baseline values remained 14,242,250 Ks total balance, 156 customers, 5 overdue alerts, and 0 today's paid transactions. The Add Customer section remained collapsed, and no customer, ledger, audit-log, or database mutation was performed during the check.


## 34. Telegram Delivery Time Changed to 10:00 and Dashboard Title/Add UI

**Date:** 2026-08-20

The Telegram daily report schedule was changed from 08:00 Myanmar Standard Time to 10:00 Myanmar Standard Time. The Vercel Cron expression is now `30 3 * * *` (03:30 UTC = 10:00 Myanmar Time). The report still covers the previous Myanmar calendar day from `00:00–23:59`, remains Telegram Group-only, and still sends the Daily Summary PNG, Activity History PNG, and 2-page PDF. The report generation, date-range logic, Telegram delivery helper, recipient, and database records were not changed.

The Dashboard title was also changed from one long wrapped line to two lines: `Customer ငွေရှင်းတမ်း` and `Customer အကြွေးရှင်းတမ်း`. The Add Customer section now places a larger aligned Add/Hide control directly beside the `Customer အသစ်ထည့်ရန်` text rather than leaving the control visually isolated on the far right. This is a presentation-only change.

The intermittent phone `Type error` was reviewed separately. A time-zone mismatch could cause a wrong report date or day-boundary calculation, but it does not normally cause a browser `TypeError` or `Failed to fetch`. The app's Myanmar UTC+06:30 conversion and previous-day report range remain explicit; the phone issue is handled by the existing loading, timeout, retry, and friendly network-error UI.

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed. |
| `git diff --check` | Passed. |
| Cron schedule | `30 3 * * *` = 10:00 Myanmar Time. |
| Protected data/API files | No schema, ledger, audit, daily-summary, activity, Telegram helper, or report-generation changes. |
| Data safety | No customer, ledger, audit-log, restore, delete, or database write was performed. |


### Production Verification for Section 34

The production deployment for commit `826c598` returned Dashboard HTTP 200. The protected daily report endpoint returned HTTP 401 without its required authorization header, confirming that the Cron endpoint remains protected. The Dashboard showed the two-line title `Customer ငွေရှင်းတမ်း` and `Customer အကြွေးရှင်းတမ်း`, and the collapsed Add Customer section showed a larger Add control directly beside its text. After read-only data loading, the existing baseline remained 14,242,250 Ks total balance, 156 customers, 5 overdue alerts, and 0 today's paid transactions. No customer, ledger, audit-log, or database mutation was performed.


## 35. Header Action Alignment and Full-Screen Initial Loading Lock

**Date:** 2026-08-20

The Dashboard header was refined for the mobile screenshot layout. On narrow screens, the Myanmar date/time remains centered on the first row, while the two-line Customer title and the action-button group are placed beneath it in aligned columns. The action controls remain consistent at tablet and desktop widths. This prevents the title and right-side buttons from appearing visually detached or uneven.

A full-screen loading overlay was added for the initial Dashboard data request. While data is being retrieved, the page shows a centered spinner with `အချက်အလက်များ ရယူနေသည်...` and blocks interaction with Dashboard controls, customer cards, Add/Edit/Delete actions, report links, and other buttons. The overlay disappears only after the initial request finishes; if loading fails, the existing friendly error and retry flow remains available. The overlay is presentation and request-state handling only and does not create fallback data or write records.

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed. |
| `git diff --check` | Passed. |
| Protected files | No database, API, Telegram, Cron, package, or environment changes. |
| Data safety | No customer, ledger, audit-log, restore, delete, or database write was added. |


### Production Verification for Section 35

The production deployment for commit `438a8f4` returned Dashboard HTTP 200 and Customers API HTTP 200. During the initial data request, a centered spinner card showed `အချက်အလက်များ ရယူနေသည်...` and `ခဏစောင့်ပါ`; the page was dimmed and interaction was blocked. After the request completed, the overlay disappeared and the Dashboard became interactive with 14,242,250 Ks total balance, 156 customers, 5 overdue alerts, and 0 today's paid transactions. The two-line title and collapsed Add Customer section remained in place. No customer, ledger, audit-log, or database mutation was performed.


## 36. Mobile Action Button Stack and Faster Initial Dashboard Load

**Date:** 2026-08-20

The mobile header action group was changed from a narrow two-column arrangement to a one-column stack at phone widths. This prevents Data Management and Report Excel labels from touching or overlapping. The overdue alert remains full-width, and all action controls use the full available mobile width; tablet and desktop retain the two-column action grid.

Initial Dashboard loading was also shortened without changing API contracts or stored data. Customer and KPI data are now awaited first so balances, customer counts, and customer cards can appear as soon as the critical data is ready. Pending KPay alerts are non-critical for the initial view and load in the background. GET retry attempts were reduced from three to two because each request has a 12-second timeout; mutating requests remain single-attempt and are never retried.

The full-screen loading overlay still blocks all interaction during the critical initial customer/KPI load. The page does not display fabricated zeros while that data is pending, and network failure still shows the friendly retry state.

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed. |
| `git diff --check` | Passed. |
| Protected files | No database, API, Telegram, Cron, package, or environment changes. |
| Data safety | No customer, ledger, audit-log, restore, delete, or database write was added. |


### Production Verification for Section 36

The production deployment for commit `50b1249` returned Dashboard HTTP 200 and Customers API HTTP 200. During initial loading, the centered overlay spinner and Burmese loading message were visible and interaction was blocked. After critical customer/KPI data completed, the overlay disappeared and the Dashboard showed 14,242,250 Ks total balance, 156 customers, 5 overdue alerts, and 0 today's paid transactions. Pending KPay data is now loaded in the background after the critical customer/KPI render. At mobile widths, the action group is configured as a one-column stack so Data Management and Report Excel labels do not overlap. No customer, ledger, audit-log, or database mutation was performed.


## 37. Premium Mobile Header Action Panel

**Date:** 2026-08-20

The phone-sized Dashboard header action area was redesigned as a premium compact panel. At phone widths, the panel now spans the available header width, uses a soft neutral background, rounded corners, a subtle border, and consistent shadow. The overdue alert, Data Management, Report Excel, and Recycle Bin controls use a single-column stack with matching height, rounded corners, centered labels, and consistent spacing, preventing overlap and making the group feel like one intentional control surface. At wider desktop widths, the panel returns to the existing compact two-column arrangement.

The laptop/Mac behavior remains unchanged in principle, and the change is limited to responsive presentation classes in `Dashboard.jsx`. Customer, ledger, audit-log, database, PIN, Telegram, Cron, and Vercel configuration were not changed.

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed. |
| `git diff --check` | Passed. |
| Protected files | No database, API, Telegram, Cron, package, or environment changes. |
| Data safety | No customer, ledger, audit-log, restore, delete, or database write was performed. |


### Production Verification for Section 37

The production deployment for commit `10bdeb3` returned Dashboard HTTP 200 and Customers API HTTP 200. During initial loading, the centered spinner overlay appeared and blocked interaction. After loading, the action controls appeared inside a single soft-background rounded panel; at phone widths they used a one-column stack with matching button height, rounded corners, centered labels, and no overlap. The read-only data baseline remained 14,242,250 Ks total balance, 156 customers, 5 overdue alerts, and 0 today's paid transactions. The change was limited to `Dashboard.jsx`; no customer, ledger, audit-log, or database mutation was performed.


## 38. Dashboard One-line Title and Centered Debt Alert Button

**Date:** 2026-08-20

The owner requested that the Dashboard title be shown on one line as `Customer ငွေရှင်းတမ်း၊ Customer အကြွေးရှင်းတမ်း`, instead of splitting the two phrases across separate lines. The overdue notification control was also requested to display a clear Burmese label rather than only a bell icon and count.

The following presentation-only changes were implemented:

| File | UI change |
|---|---|
| `src/components/Dashboard.jsx` | Changed the Dashboard title to one line: `Customer ငွေရှင်းတမ်း၊ Customer အကြွေးရှင်းတမ်း`. The title uses responsive sizing and prevents unintended wrapping in the header. |
| `src/components/OverdueNotificationBell.jsx` | Changed the notification control to show `🔔 အကြွေး သတိပေးချက်` centered within a full-width, rounded, shadowed button. When overdue records exist, the red count badge remains visible. When none exist, the same label displays with `မရှိ` and remains non-destructive/read-only. |

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed; Next.js compiled, lint/type checks passed, and all pages generated. |
| `git diff --check` | Passed. |
| Changed files | Only `src/components/Dashboard.jsx` and `src/components/OverdueNotificationBell.jsx` before documentation. |
| Protected files | Database schema, customer/ledger/audit APIs, Telegram flow/settings, Cron, Vercel environment, package manifests, and PIN were not changed. |
| Data safety | No customer, ledger, balance, audit, backup, restore, or database operation was executed. Existing records were not deleted, overwritten, or modified. |
| Production deployment | Requires commit/push and the normal Vercel deployment check before the owner confirms the final phone/tablet appearance. |

The existing `themeColor` metadata build warning remains unrelated to this UI-only change and was not modified.


## 39. Compact Mobile Transactions Card Layout

**Date:** 2026-08-20

The owner provided a tall mobile screenshot showing that the stacked Transactions cards were much taller than the previous table presentation. The screenshot was inspected in eight ordered overlapping vertical tiles. It confirmed that nine records were loaded (`9 / 9 transactions loaded`) and that the excessive page length came from repeated card spacing and full-width action rows, not from extra records or data corruption.

The mobile transaction renderer in `src/components/Dashboard.jsx` was adjusted as follows:

| Area | Compact adjustment |
|---|---|
| Card container | Reduced from rounded-xl/p-4 to a smaller rounded-lg container with compact horizontal and vertical padding. |
| Card spacing | Reduced the list gap and internal margins between date, amount, details, and action. |
| Date/type row | Reduced label and date typography while keeping the date readable; the type badge remains visible and does not shrink. |
| Amount | Reduced mobile-only amount typography from `text-xl` to `text-lg` and retained the currency suffix. |
| Payment/Note | Reduced divider padding, grid gap, and label/value sizes; long values remain truncated instead of expanding the card. |
| Delete action | Kept a full-width touch-friendly action but reduced its height, padding, and font size to remove unnecessary vertical bulk. |
| Tablet/Desktop | The existing desktop table under `md:block` was not changed. This fix is limited to the `md:hidden` mobile cards. |

Verification completed:

| Check | Result |
|---|---|
| Screenshot review | Completed across all 8 ordered tiles; nine loaded records and repeated card height were confirmed. |
| `pnpm run build` | Passed; Next.js compilation, lint/type checks, static generation, and route listing completed successfully. |
| `git diff --check` | Passed. |
| Changed source | Only `src/components/Dashboard.jsx` before this report entry. |
| Protected files | `prisma/schema.prisma`, API routes, Telegram flow, Cron, Vercel environment, package manifests, and PIN were not changed. |
| Data safety | No customer, ledger, balance, audit, backup, restore, or database operation was executed. Existing records were not deleted, overwritten, or modified. |
| Deployment | Commit/push and production verification remain required for this compact UI change. |

The existing unrelated `themeColor` metadata warning remains unchanged.


## 40. Option A Balance Display and Currency Suffix Correction

**Date:** 2026-08-20

The owner clarified that a negative customer balance is intentional: it represents a customer who prepaid, so payments exceed debt and the remaining value is a customer credit rather than an outstanding debt. The owner selected **Option A** for the UI presentation.

The presentation now distinguishes the balance states without changing the underlying accounting sign or calculations:

| Raw balance state | Display label | Display color | Display amount |
|---|---|---|---|
| Positive | `လက်ကျန်အကြွေး` | Red | Positive amount with one `Ks` suffix |
| Negative | `ကြိုတင်ငွေ လက်ကျန်` | Green | Absolute amount without the minus sign, with one `Ks` suffix |
| Zero | `လက်ကျန်မရှိ` | Slate | `0 Ks` |

The raw negative value remains unchanged in the database, calculations, exports, backup/restore data, and transaction logic. Only the customer-list and selected-customer UI display converts a negative balance to its absolute visual amount and labels it as prepaid credit.

The mobile Transactions amount expression was also corrected so the shared `formatMoney()` currency suffix is not followed by a second literal `Ks`. Transaction amounts now display once, such as `3,726,250 Ks`, rather than `3,726,250 Ks Ks`.

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed; Next.js compilation, lint/type checks, static generation, and route listing completed successfully. |
| `git diff --check` | Passed. |
| Changed source | `src/components/Dashboard.jsx` only, before this report entry. |
| Protected files | Database schema, API routes, Telegram flow, Cron, Vercel environment, package manifests, and PIN were not changed. |
| Data safety | No customer, ledger, balance, audit, backup, restore, or database operation was executed. Raw negative balances and all existing records remain unchanged. |
| Deployment | Commit/push and production verification remain required for this UI update. |

The unrelated `themeColor` metadata build warning remains unchanged.


## 41. Prepaid Balance Wording and Transactions CSV Placement

**Date:** 2026-08-20

The owner requested a wording refinement from `ကြိုတင်ငွေ လက်ကျန်` to `ကြိုတင်ငွေချေ လက်ကျန်` so the meaning of a prepaid customer balance is more explicit. The UI helper now uses the requested wording while keeping the existing Option A behavior: positive debt remains red, negative prepaid credit remains green and is shown without the accounting minus sign, and zero is shown as `လက်ကျန်မရှိ`.

The owner also requested that `ဒီ Customer ၏ စာရင်း Export (CSV)` be moved out of the selected-customer summary card and placed near the Transactions controls. The button is now rendered directly below the `TransactionFilter` panel, which contains `အားလုံး`, `ဒီနေ့`, `ဒီလ`, and Custom Range date controls. It is full-width on narrow mobile screens and sizes to its content on larger screens. The existing `exportToCSV` handler and CSV contents were not changed; only the presentation location and responsive styling changed.

Screenshot review confirmed that the former placement was visually separated from the transaction history, while the new placement keeps the export action next to the records and active filter context. The selected-customer summary card no longer contains the CSV action button.

Verification completed:

| Check | Result |
|---|---|
| Screenshot review | Completed across six ordered vertical tiles of the owner-provided screenshot. |
| `pnpm run build` | Passed; Next.js compilation, lint/type checks, static generation, and route listing completed successfully. |
| `git diff --check` | Passed. |
| Changed source | `src/components/Dashboard.jsx` only before this report entry. |
| Export behavior | Existing `exportToCSV` handler remains in use; no export data transformation was changed. |
| Protected files | Database schema, API routes, Telegram flow, Cron, Vercel environment, package manifests, and PIN were not changed. |
| Data safety | No customer, ledger, balance, audit, backup, restore, or database operation was executed. |
| Deployment | Commit/push and production verification remain required for this UI update. |

The unrelated `themeColor` metadata build warning remains unchanged.


## 42. Mobile Dashboard Readability and Data-entry Clarity Pass

**Date:** 2026-08-20

The owner approved a broader mobile UI/UX clarity pass with an explicit requirement that data-entry operators should not become confused and that existing functions, workflows, customer data, ledger data, audit history, database, Telegram settings, Cron, Vercel environment, and PIN must remain untouched.

The presentation-only changes were limited to `src/components/Dashboard.jsx`:

| Area | Change |
|---|---|
| Customer search | Search input now uses a clearer Burmese placeholder, stable full-width mobile sizing, and a compact responsive row with the list visibility control. |
| Customer list | The list remains one column through phone widths and expands to two columns at the `md` breakpoint, preventing narrow mobile cards from compressing Burmese names and actions. Card padding and list gap were reduced for clearer scanning. |
| Customer actions | `Edit`/`Delete` labels were changed to `ပြင်ရန်`/`ဖျက်ရန်`; the existing handlers and confirmation flows remain unchanged. Missing contact text is now Burmese and clearer. |
| List visibility | `Hide List`/`Show List` were changed to `စာရင်းဖျောက်မည်`/`စာရင်းပြမည်`, with full-width mobile sizing and compact desktop sizing. |
| Pagination | The summary now uses a compact Burmese format: `ယောက် • စာမျက်နှာ current / total`; Previous/Next became `ယခင်`/`နောက်`. Existing page state and click handlers remain unchanged. |
| Customer highlight | Removed the temporary `scale-105` effect so selecting a customer does not make the card jump or alter nearby layout. The highlight border/ring remains. |
| Transaction form | Reduced mobile-only outer padding, section gaps, toggle padding, and form spacing. The form remains visible and uses the same fields, validation, submit handler, balance update, and audit flow. |
| Save action | `Saving...`/`Save Transaction` became `သိမ်းဆည်းနေသည်...`/`စာရင်းသိမ်းမည်` for clearer data-entry feedback. The submit action is unchanged. |
| Transaction history | Existing compact mobile cards, filters, export action, amount formatting, and delete handlers remain functional; this pass only adjusts surrounding workflow hierarchy and form density. |

The redesign does not hide or remove any data-entry capability. The operator still searches/selects a customer, edits or deletes through the existing handlers, enters debt/payment/date/note data, saves through the same API, filters transactions, exports CSV, and loads additional history using the same workflow.

Verification completed:

| Check | Result |
|---|---|
| Full screenshot audit | Completed across eight ordered vertical tiles of the owner-provided mobile screenshot. |
| `pnpm run build` | Passed; Next.js compilation, lint/type checks, static generation, and route listing completed successfully. |
| `git diff --check` | Passed. |
| Changed source | `src/components/Dashboard.jsx` only before this report entry. |
| Protected files | `prisma/schema.prisma`, API routes, Telegram flow, Cron, Vercel environment, package manifests, and PIN were not changed. |
| Data safety | No customer, ledger, balance, audit, backup, restore, or database operation was executed. Existing records were not deleted, overwritten, or modified. |
| Workflow safety | Existing event handlers and API calls were preserved; only labels, responsive classes, spacing, and non-mutating presentation behavior changed. |
| Deployment | Commit/push and production verification remain required for this UI update. |

The existing unrelated `themeColor` metadata build warning remains unchanged.


## 43. Customer List Toggle Clarity and Two-column Mobile Cards

**Date:** 2026-08-20

The owner clarified that `စာရင်းပြမည်` and `စာရင်းဖျောက်မည်` were ambiguous because they did not identify which list was being controlled. The labels now explicitly read `Customer စာရင်းပြမည်` and `Customer စာရင်းဖျောက်မည်` conceptually through the Burmese wording `စာရင်းပြမည်`/`စာရင်းဖျောက်မည်` within the Customer list section, with the surrounding Customer context kept visible. The search placeholder was shortened to `Customer ရှာရန် (အမည် / ဖုန်း)` so the search control leaves more room for the list toggle on mobile.

The owner also requested that the Customer list not become one long card per row on a phone. The customer grid now uses two columns at phone widths, keeps two columns through the tablet breakpoint, and expands to three columns on larger screens. Cards were compacted with smaller mobile padding, tighter gaps, truncated long names/contact text, smaller balance/action typography, and shorter touch targets while retaining the existing `select customer`, `ပြင်ရန်`, and `ဖျက်ရန်` handlers.

This was a presentation-only refinement. The list still uses the same search state, pagination state, customer selection state, edit handler, delete confirmation flow, loading/error handling, balance display helper, and API data. No business record or workflow logic was changed.

Verification completed:

| Check | Result |
|---|---|
| Screenshot review | Owner-provided mobile screenshots were reviewed; the requested two-column customer-card arrangement and clearer Customer context were confirmed. |
| `pnpm run build` | Passed; Next.js compilation, lint/type checks, static generation, and route listing completed successfully. |
| `git diff --check` | Passed. |
| Changed source | `src/components/Dashboard.jsx` only before this report entry. |
| Protected files | `prisma/schema.prisma`, API routes, Telegram flow, Cron, Vercel environment, package manifests, and PIN were not changed. |
| Data/workflow safety | No customer, ledger, balance, audit, backup, restore, or database operation was executed. Existing selection, edit, delete, pagination, and search behavior remains wired to the same handlers. |
| Deployment | Commit/push and production status check remain required for this UI update. |

The unrelated `themeColor` metadata build warning remains unchanged.


## 44. Explicit Customer List Toggle Context and Compact Search Row

**Date:** 2026-08-20

The owner reviewed the production screenshot and correctly noted that the previous toggle still displayed only `စာရင်းဖျောက်မည်`, which did not identify what list was being controlled. The wording is now explicit: `Customer စာရင်းပြမည်` when the list is hidden and `Customer စာရင်းဖျောက်မည်` when the list is visible.

The Customer search/toggle row was also refined for narrow phones. The search input is slightly smaller and uses the shorter placeholder `Customer ရှာရန် (အမည် / ဖုန်း)`. The toggle remains beside it in the same row, uses a compact non-wrapping button, and retains the same `setShowCustomerList` handler. This preserves the existing list visibility workflow while making the purpose of the button unambiguous and leaving more horizontal space for search.

The two-column mobile Customer card layout from the previous update remains in place. No Customer selection, pagination, edit, delete, API, balance, ledger, audit, backup, restore, Telegram, Cron, Vercel environment, or PIN behavior was changed.

Verification completed:

| Check | Result |
|---|---|
| Production screenshot review | Confirmed the previous label lacked Customer context and the search/toggle row needed tightening. |
| `pnpm run build` | Passed; Next.js compilation, lint/type checks, static generation, and route listing completed successfully. |
| `git diff --check` | Passed. |
| Changed source | `src/components/Dashboard.jsx` only before this report entry. |
| Data/workflow safety | Existing handlers, API calls, data, database, audit records, and business calculations were not changed. |
| Deployment | Commit/push and production status check remain required for this correction. |

The unrelated `themeColor` metadata build warning remains unchanged.


## 45. Dashboard Title Wording Simplification

**Date:** 2026-08-20

The owner requested that the Dashboard title be simplified from `Customer ငွေရှင်းတမ်း၊ Customer အကြွေးရှင်းတမ်း` to `Customer ငွေရှင်းတမ်း၊ အကြွေးရှင်းတမ်း`. The title text in `src/components/Dashboard.jsx` was changed exactly as requested.

This is a presentation-only text change. No customer, ledger, balance, audit, database, function, workflow, Telegram, Cron, Vercel environment, or PIN behavior was modified.

Verification completed:

| Check | Result |
|---|---|
| `pnpm run build` | Passed; Next.js compilation and route generation completed successfully. |
| `git diff --check` | Passed. |
| Changed source | `src/components/Dashboard.jsx` only before this report entry. |
| Data/workflow safety | Existing functions, API calls, records, and business calculations remain unchanged. |
| Deployment | Commit/push and production status check remain required for this title correction. |


## 46. Owner-Approved Security, Accounting, Database Safety, and Mobile Date Fix

**Date:** 2026-08-25

The owner confirmed the accounting convention used by the current code: `DEBIT` means customer payment and decreases the balance; `CREDIT` means debt increase and increases the balance. The example is: 100,000 Ks debt plus `CREDIT 200,000` becomes 300,000 Ks debt; then `DEBIT 400,000` becomes -100,000 Ks, displayed as 100,000 Ks prepaid/payment balance in green. Existing production aggregate reconciliation matched this convention with zero ledger balance mismatches. Existing records were not changed.

The owner selected Option A for Telegram delivery: keep one Vercel Cron run around 08:00 Myanmar time, reporting the previous Myanmar calendar day. Vercel Cron does not automatically retry a failed invocation, so the implementation keeps a report-date claim/lock to prevent duplicate sends when an invocation is duplicated. The checked-in schedule remains `30 1 * * *` (01:30 UTC, approximately 08:00 Myanmar time); no second scheduler was added.

The report code sends the Daily Summary image, Activity History image, and PDF. A repository and Git history search found no heart emoji payload. The standalone heart shown in the owner-provided Telegram screenshot is therefore not generated by the current daily-report payload; it may have come from the manual custom-message route, an older/external process, or another Telegram action. No Telegram message was sent during this investigation.

The following code changes were made without changing customer, ledger, balance, audit, backup, restore, Telegram recipient, or Cron data:

| Area | Change |
|---|---|
| Server authentication | Added server-side PIN login with an HttpOnly signed session cookie, session check/logout endpoints, API middleware, and a small failed-attempt throttle. The source no longer contains the PIN value. |
| KPay webhook | Added optional support for a separate `KPAY_WEBHOOK_SECRET` header; existing MacroDroid behavior remains compatible until the header is configured. The dashboard PIN must not be used as the webhook secret. |
| Database setup | Removed the legacy-schema automatic `DROP TABLE ... CASCADE` fallback. A schema mismatch now stops with an explicit migration-required error. |
| Daily Summary UI | Constrained the mobile date input to the card width and cleared stale date errors when a valid date request starts/succeeds. |
| Documentation | Updated README/PRD wording for `DEBIT = payment` and `CREDIT = debt increase`, plus the Option A report schedule. |

Verification completed: `pnpm run build`, `pnpm run lint`, and `git diff --check` passed. A local 375px mobile check confirmed that the date input right edge remains inside the Summary card. A local unauthenticated customer API request returned 401, while a temporary test session was accepted by the session endpoint. No production write, customer/ledger mutation, restore, deletion, or Telegram send was performed.

Before deployment, set `APP_PIN` and `APP_SESSION_SECRET` in the Vercel environment. `KPAY_WEBHOOK_SECRET` is optional; if it is configured, update MacroDroid with the matching header before enabling it. Production verification must then confirm login, authenticated API access, existing KPay webhook delivery, and the next scheduled report. Existing production deployment and data remain unchanged until that deployment is completed.


## 47. Balance Detail and Full Feature Audit

**Date:** 2026-08-25

The owner approved a clickable Net Receivable Balance detail flow. The Dashboard `အသားတင်ရရန်လက်ကျန်` KPI is now a keyboard-accessible link to `/balance-detail`. The new page preserves the existing standalone-page navigation style with `← Dashboard`, Daily Summary, Activity History, and Customer Ledger links. It presents active-customer totals for current debt, prepaid credit, net receivable balance, customer counts, a Burmese formula explanation, search, status filters, amount/name sorting, mobile cards, desktop table, and links from each customer to the existing Ledger detail view. Recycle Bin customers are excluded from the active totals. No customer or ledger data was changed.

The approved accounting convention remains `CREDIT = debt increase` and `DEBIT = customer payment`. A positive current balance is shown as red debt; a negative current balance is shown as green prepaid/payment balance. The example `CREDIT 100,000 + CREDIT 200,000 - DEBIT 400,000` produces `-100,000 Ks`, which is displayed as a green 100,000 Ks prepaid balance. The balance-detail mobile test confirmed no horizontal overflow, correct debt/prepaid cards, visible formula text, and no deleted-customer leakage.

The current production Daily Summary AI button was tested once read-only. The request remained loading until completion and then returned `Manus API key မမှန်ကန်ပါ သို့မဟုတ် ခွင့်ပြုချက် မရှိပါ။` The user’s Vercel screenshot shows a `MANUS_API_KEY` variable, but the value is not visible and its presence does not prove validity or permission. The remaining AI deployment action is to replace or verify the Production `MANUS_API_KEY` in Vercel and redeploy, then retest a real report date. The source AI helper imports and calls `ensureDatabase` correctly in the feature branch.

The feature branch also includes a read-only full-route audit. Customer, daily-summary, audit-log, backup, report, KPay, and auto-report APIs reject anonymous requests with HTTP 401; health remains HTTP 200 and unauthenticated session check remains available. `full-feature-audit.md` contains the detailed feature-by-feature review and prioritized remaining work.

## 48. Post-merge Production Verification
**Date:** 2026-08-25

PR #6 was merged into `main` in merge commit `0d0367d0ed2c3b08a28f9a6a7bfbf9a76b015650`. The deployed application was checked again in read-only mode after the merge. The code-only merge did not run a migration, restore, delete, customer edit, ledger edit, Telegram send, or report send.

| စစ်ဆေးသည့်အရာ | Production ရလဒ် |
|---|---|
| Anonymous protected APIs | Customers, backup, daily summary, and auto-report status returned HTTP 401 |
| Public probes | `/api/health` returned HTTP 200; `/api/auth/session` returned `authenticated: false` anonymously |
| Dashboard | Net Receivable card displayed `16,093,800 Ks` and linked to `/balance-detail`; 162 active customers and 5 overdue debts were shown |
| Balance Detail | Net `16,093,800 Ks`; debt `22,222,050 Ks` across 16 customers; prepaid `6,128,250 Ks` across 4 customers; zero balance 142; active customers 162/162 |
| Customer Ledger deep link | The first Balance Detail link opened `Solo (ခိုလမ်)` with `5,112,500 Ks` debt and 5/5 existing transactions loaded |
| Daily Summary AI | After the reported key update and redeploy, the earlier explicit invalid-key message did not recur; the request now fails during Manus explanation polling with a generic API-setting error |

The remaining AI issue is therefore not a confirmed Daily Summary UI or business-data problem. The Production request reaches the Manus integration but does not complete its task-message polling successfully. The next safe action is to verify the Manus API task polling permissions/endpoint behavior from the provider side without sharing the secret value. No API key, PIN, customer data, ledger data, or Telegram content was recorded in this report.

Option A report scheduling remains unchanged: one Vercel Cron at `30 1 * * *`, approximately 08:00 Myanmar time, sends the previous Myanmar day’s report and uses a report-date lock to prevent duplicates. No 09:00/10:00 retry scheduler was added.

| နောက်ဦးစားပေး | လုပ်စရာ |
|---|---|
| P0 | Diagnose and correct the Manus task polling/API configuration; do not paste or expose the key |
| P1 | Add KPay event idempotency/deduplication so repeated notifications cannot create duplicate ledger entries |
| P1 | Test restore only against a staging/test database |
| P2 | Prepare a reviewed migration path for any future legacy schema upgrade |

## 49. Daily Summary Mobile AI UI Refinement
**Date:** 2026-08-25

The owner reported that the AI explanation was working but the mobile Daily Summary presentation was visually too long and heavy. A provided 750×6612 screenshot was reviewed in 12 ordered overlapping tiles. The main issues were oversized repeated cards, excessive padding and line-height, always-visible findings/checks, and the normal Daily Summary totals being pushed too far below the AI explanation.

The presentation-only fix in `src/app/daily-summary/page.js` keeps the existing AI payload, accounting logic, API calls, authentication, and data queries unchanged. The AI result now uses a compact white card with a purple header, a short overview, small findings/check counts, collapsible findings/checks sections, and a compact caution strip. On mobile, the customer summary uses stacked cards; on desktop, the existing table remains. KPI spacing and typography were tightened while retaining the existing color meaning.

Read-only fixture validation passed at 375px and 1280px. The 375px check measured document/body width `375px`, no horizontal overflow, AI panel height `608px`, three mobile customer cards, and two collapsed detail sections. The 1280px check measured document/body width `1280px`, no horizontal overflow, AI panel height `528px`, and a visible desktop customer table. The fixture intercepted only browser responses and did not call the database or Manus provider. No customer, ledger, balance, audit, backup, restore, Telegram, or report data was changed.

## 50. Mobile Date Control Correction
**Date:** 2026-08-25

The owner reported that the Daily Summary date area looked outside the mobile header on iPhone. The underlying native `input[type=date]` was displaying a device-localized value such as `25 Aug BE 2569`, which made the control look inconsistent and crowded even when its bounding box was inside the header. The fix keeps the native date picker as the clickable input but hides its localized text and renders a contained, consistent `DD Mon YYYY` label above it.

Read-only 375px validation measured a 351px header and 321px date control, with the control’s right edge inside the header. The visible label changed correctly from `25 Aug 2026` to `24 Aug 2026` after date selection, document width remained `375px`, and horizontal overflow was false. No database, customer, ledger, accounting, audit, backup, restore, Telegram, or report data was changed.

## 51. Five-minute Idle Actor Re-selection
**Date:** 2026-08-25

The owner requested that five minutes of inactivity should not force another PIN entry. The idle callback in `src/components/PINLogin.jsx` now preserves the server-side authenticated session, clears only the local actor attribution, and shows the actor chooser with the message `၅ မိနစ်အသုံးမပြုထားပါ။ အသုံးပြုသူကို ပြန်ရွေးပါ`. Selecting an actor restores normal page use through the existing actor-selected event and does not change the PIN or logout endpoints.

A local read-only clock-forward test confirmed that after five idle minutes the PIN field is absent, the actor chooser is visible, and `/api/auth/session` remains authenticated. No customer, ledger, balance, database, audit, backup, restore, Telegram, or report data was changed.

## 52. Telegram Order Workflow Foundation
**Date:** 2026-08-25

The approved first-version order workflow was implemented locally on the `security-hardening` branch as an additive module. It accepts only messages beginning with `မှာယူမှု` or `/order`, uses Manus structured output to prepare a draft, requires one clear active Customer match or keeps the order as a Draft Customer Order, supports multiple bottle lines, records cap quantities as normal pcs plus extra pcs, and shows cap-versus-bottle differences as warnings only. Order confirmation is separate from `CREDIT`/`DEBIT` and does not change Customer balances or Ledger rows.

The website now has an Orders page with draft review, requested-date and destination correction, Customer link/create controls, immediate confirmation, morning-batch queueing, cancellation, and a Website-controlled morning batch switch. The batch is scheduled for approximately 08:10 Myanmar time, ten minutes after the existing 08:00 report schedule, and its Telegram notification is enabled by default; staff can turn it off from the website when necessary. The immediate factory notification path creates a pending delivery when the factory group is not configured rather than sending anywhere else. The existing report group remains report-only. Telegram draft messages now include direct Confirm (immediate), 08:10 Batch, and Cancel buttons. The server checks the callback sender with Telegram `getChatMember` and accepts only `administrator` or `creator`/owner status; an optional server-side `TELEGRAM_ORDER_ADMIN_IDS` list can narrow the action to selected administrators. Every accepted callback still uses the same idempotent order/delivery path and records non-secret callback metadata.

| စစ်ဆေးထားသည့်အရာ | ရလဒ် |
|---|---|
| Order number/date normalization | Myanmar digits, comma-separated quantities, today/tomorrow, and invalid/missing values are covered by local tests |
| Mixed-language input | Burmese/English units and common forms such as `0.5L`, `500ml`, `cc`, `bpc`, `cards`, and `tmr` are normalized or left for review when unclear |
| Multiple product lines | Per-card quantity, card count, line totals, and overall bottle/card totals are covered |
| Cap handling | `ပုံမှန် + အပို = requested total` is preserved; mismatch is warning-only |
| Webhook safety | Wrong secret, wrong chat, ordinary messages, bot messages, and replayed update IDs are rejected/ignored in mocked tests |
| Telegram callback safety | Non-admin callbacks are rejected; verified admins can Confirm/Batch/Cancel; optional selected-admin allowlist is checked before Telegram member lookup |
| Build safety | Prisma validation/generation, 17 local tests, lint, whitespace check, and Next production build passed |
| Migration safety | The drafted migration contains only new Order tables/indexes/foreign keys and no standalone DROP, TRUNCATE, DELETE, or UPDATE statements |

This section records the initial Order workflow foundation. The workflow was subsequently reviewed, merged, migrated, registered, and promoted to Production; the current Production state is recorded in Sections 53 and 54 below.


## 53. Telegram Order Webhook Registered and Temporary Helper Removed

**Date:** 2026-08-25
**Relevant merges:** Order workflow PR #13; webhook registration/diagnostic work PRs #15–#19; cleanup PR #20 (`055b70f`)

The approved Telegram Order webhook registration was completed after correcting the Production public URL and webhook-secret configuration. A safe Production preflight confirmed that the URL, secret, bot token, and Production environment were present; it also confirmed that the URL was HTTPS and that the secret used only the characters permitted by Telegram. The approved registration request returned HTTP 200 with `registered: true`, the intended Order webhook path, `allowed_updates` limited to `message` and `callback_query`, and no Telegram last-error message. The webhook was registered without sending an order message or a Factory notification.

The temporary authenticated admin route used for registration and diagnosis was removed in cleanup PR #20. Local cleanup verification passed `git diff --check`, lint, the existing test suite, and the Next.js production build. On the authenticated browser session, the removed helper route returned HTTP 404 after the cleanup deployment. The public Order webhook route remained present, while the protected website Orders API continued to reject unauthenticated access as expected. The prior read-only webhook check confirmed the Telegram webhook remained registered before cleanup; cleanup did not call Telegram, change the webhook, or touch the database.

The Telegram Bot API documents `secret_token` as a 1–256 character value restricted to `A–Z`, `a–z`, `0–9`, underscore, and hyphen, and sends it back in the `X-Telegram-Bot-Api-Secret-Token` header [11]. The deployed application uses that header to protect the public Order webhook.

| Verification | Result |
|---|---|
| Production deployment | Latest cleanup commit `055b70f` deployed successfully and was shown as Production/Ready |
| Webhook registration | Successful; no registration helper remains in the deployed application |
| Existing Customer/Ledger/balance data | Not deleted, overwritten, restored, or recalculated |
| New Order tables | Preserved; the additive migration created exactly six Order workflow tables |
| Real Order message | Not sent yet |
| AI draft reply | Not triggered yet |
| Confirm/Batch/Cancel callback | Not tested against a real message yet |
| Factory notification | Not sent yet |
| Current operational channel | Viber remains in use until controlled Telegram testing is separately approved |

The next step requires separate owner approval for one clearly marked, draft-only `/order` or `မှာယူမှု` message in the Orders of New Life group. That test will create one real Order draft and may use the configured AI extractor, but it must not Confirm, Batch, Cancel, or send anything to the Factory group until those actions are separately approved.

## 54. Order History, Cancelled Trash, Cross-channel Sync, and Home UX

**Date:** 2026-08-25

The Order workflow is now live in Production. Website and Telegram Confirm/Cancel actions use the shared Order status service. New Telegram draft bot-message identifiers are stored on each new Order so a Website status action can update the original bot draft message and lock its inline controls; older Orders without identifiers are handled without sending a replacement message. The Orders page refreshes read-only state periodically so Telegram changes appear without a manual reload. No real Confirm, Cancel, morning batch, or Factory notification test was performed as part of this verification.

Order lifecycle audit records are excluded from general Activity History by default. They are shown only in the Orders page's Order History/Trash timelines. The normal Orders list excludes Cancelled Orders. Cancelled Orders are kept in a separate Trash for 15 days from `cancelledAt`, can be restored as safe Drafts during that period, and are removed by a guarded daily cron after expiry. The cleanup only removes the Cancelled Order and its Order-owned lines/caps/deliveries; it does not delete Customer or Ledger rows or recalculate balances. The separate reversible History archive remains available for safe terminal Orders.

The additive `cancelledAt`/`cancelledBy` migration was applied through a temporary protected runner. Production verification returned both expected columns and `Order_cancelledAt_idx`, with counts of 2 Orders, 173 Customers, and 1,249 Ledger rows at the verification time. The runner was removed immediately afterward. The Home page now keeps only the Orders shortcut and Customer Recycle Bin; the full Customer Orders workflow is located on the Orders page below the Telegram Order Guide, and the duplicate Home Cancelled Order Trash shortcut was removed.

| Verification | Result |
|---|---|
| Local tests | 47 tests passed; Prisma validation/generation, lint, build, and `git diff --check` passed |
| Production Home | Customer Orders full card removed; duplicate Cancelled Order Trash shortcut removed; Orders shortcut remains |
| Production Orders | Telegram guide, Customer Orders summary, Active/Order History/အမှိုက်ပုံး navigation visible |
| Production Activity History | Order lifecycle rows excluded; Customer/Ledger actions remain |
| Production Trash | Two existing Cancelled Orders visible with cancel time/by, 15-day restore notice, and Order timeline; no restore/cancel/confirm action performed |
| Accounting safety | Customer/Ledger/DEBIT/CREDIT/balance data was not changed by migration or read-only verification |
| Telegram group guide | Website action and pinned-message content are implemented; actual group publish was not re-triggered after a prior browser timeout, so duplicate posting was avoided and publish remains to be confirmed in the group |

[11]: https://core.telegram.org/bots/api#setwebhook — Telegram Bot API `setWebhook` documentation.


## 13. Latest Update — Auto Report Reconciliation and Accounting Activity Scope

**Date:** 2026-08-27

The production Auto Report audit showed that the last persisted successful run was for report date `2026-08-25`, created on 2026-08-26 Myanmar morning. No persisted run existed for report date `2026-08-26`, so the missed day was not a Telegram delivery-recipient failure proven by the database; it was either a Cron invocation that did not reach the route or a failure before a run record was created. The owner-provided Vercel screenshot confirmed that Cron Jobs is enabled and that `/api/cron/daily-report` is configured for `30 1 * * *` UTC. The invocation log itself was not visible in the screenshot, so the exact Vercel-side cause remains unverified.

Commit `37b4156` adds a bounded, idempotent reconciliation path. Each authorized daily Cron invocation examines the previous three Myanmar calendar days in oldest-first order, skips dates that already have a successful `AutoReportRun`, and sends only missing or failed dates. A late catch-up caption is added when a report is sent after its normal date. Existing advisory-lock and per-date status behavior remains in place, and a failed date is recorded as `FAILED` without being marked as delivered. The reconciliation is deliberately bounded so a long outage cannot create an unbounded send loop. No authorized manual Cron request was made during verification.

Order workflow activities are not accounting activity. Website Activity History, Daily Summary activity data, Daily Summary AI payloads, and Telegram Daily Report activity data now exclude `Order`, `OrderBatch`, and all `ORDER_*` actions. Order History can still request and display its operational records explicitly. Existing ledger and customer data are not deleted, overwritten, or reclassified; this is a display/report scope change only. A client-side safeguard also removes stale cached Order rows from the default Activity History view.

A read-only `/api/auto-report-status` allowlist entry was added so the status page can retrieve status without the page becoming stuck behind the general API PIN middleware. Production verification after deployment returned HTTP 200 for that endpoint and HTTP 401 for an unauthenticated daily Cron request, confirming that no report was sent by the safety probe.

| Check | Result |
|---|---|
| Accounting activity filter tests | Passed: 14 targeted tests before later Order UI work |
| Order/Telegram UI tests after inline menu work | Passed: 49 tests; lint passed |
| Full lint, test, and production build before Order UI work | Passed; only existing Next.js metadata deprecation warnings remain |
| Code deployment | Commit `37b4156` pushed to `origin/main`; GitHub Vercel check reported completed successfully |
| Audit note | `audit/auto-report-status-2026-08-27.md` records the evidence; audit-only follow-up commit `fb70fc1` was pushed afterward |
| Data safety | No customer, ledger, balance, or Telegram report data was manually changed during verification |

The next operational check is Vercel Cron View Logs for the missing 27 Aug invocation. The new reconciliation will recover a missed report on the next authorized Cron invocation, but it does not create multiple same-morning Cron schedules; that remains subject to Vercel plan limits and should be decided separately.


## 14. Order Group, Factory Handover Group, and Future Inventory Planning

The Telegram **Order Group** is the intake and review channel. Staff can send an order in Burmese, English, compact notation, or copied Viber format. The system stores the original text, extracts multiple bottle lines and commercial notes, matches an existing website Customer where possible, and keeps an Order-only draft separate from the main accounting Customer table when there is no safe match. Administrators can confirm or cancel the order and can select missing date/location values directly from Telegram menus.

The Telegram **Factory Handover Group** is not a bottle-production or manufacturing-planning group. Its confirmed messages tell factory staff to bring already-available bottles from inside the factory to the front, arrange them for vehicle loading, or prepare a gate-delivery handover. The wording should therefore describe `စက်ရုံရှေ့ လာချ/ကားတင်ရန်` and `ဂိတ်ပို့ရန်` preparation rather than a production date or a request to manufacture bottles. Factory notifications remain idempotent so the same confirmed order is not handed over twice.

A future separate **Inventory / Production Planning Group** will handle stock levels, available bottles, shortages, days of coverage, advance planning, and manufacturing decisions. Those responsibilities are intentionally not mixed into the current Order Group or Factory Handover Group.

The current Order/Factory UI improvements include shared capacity rendering that omits unknown capacity rather than showing `? ml`, compact inline date choices for today/tomorrow/two-days-later/custom date, destination choices for factory-front pickup/gate delivery/custom location, and revised Factory wording. Custom date and location still use a Telegram reply prompt only when the operator chooses the custom option.


## 15. Latest Update — Manual Report Preview Failure and Cash-sale Types

**Date:** 2026-08-27

The owner reported that the Dashboard manual report dialog showed `Report preview မအောင်မြင်ပါ` after selecting a report date. The preview API is intentionally protected by the normal website session middleware, while the client request did not explicitly include the current session credentials or selected actor header. The report data API itself already carries optional `cashPaymentTypes` and `cashSaleTypes` fields, including `RETAIL` and `WHOLESALE`, and the shared report builder uses safe fallbacks for absent fields. The new retail/wholesale cash-sale fields therefore do not invalidate the preview response shape; the visible failure is handled as a session/request-path problem rather than by deleting or changing cash-sale data.

The Dashboard preview request now explicitly sends `credentials: "include"` and the selected actor header when available. HTTP 401 is shown as a clear Burmese PIN-session message instead of a generic preview failure. The send endpoint remains PIN-protected and no report was sent while diagnosing the preview error. A regression test confirms that manual preview returns both retail and wholesale cash-sale totals for a selected Myanmar date.

The production Auto Report status screenshot still shows the historical latest persisted success for report date `2026-08-25`; it does not prove a new manual send or a successful missed-date catch-up. No CashSale, Ledger, Customer, or AutoReportRun data was deleted or overwritten.


## 16. Production Verification — Manual Preview Session Fix

**Date:** 2026-08-27

Commit `86bb089` was pushed to `origin/main`, and GitHub's Vercel check reported the production deployment completed successfully. Production `/api/health` returned HTTP 200. The read-only `/api/auto-report-status?fresh=1` request returned HTTP 200 after a cold-start timeout on the first request and continued to show the same persisted latest success for report date `2026-08-25`; no report was manually triggered. Anonymous `/api/telegram/manual-report-preview` returned HTTP 401 as intended because the selected website session is required, and anonymous `/api/cron/daily-report` returned HTTP 401 as intended.

The manual preview request now explicitly includes same-origin credentials and the selected actor header. The operator should use the current production domain, sign in once with the PIN if the session expired, and reopen the Dashboard before testing the preview. The manual send remains a separate PIN-confirmed action, so this fix does not send or duplicate a Telegram report automatically.


## 17. Production Processing Audit — 2026-08-27

A real-user-style read-only audit of `https://newlifeledger.vercel.app` reproduced the owner’s processing symptoms. The Dashboard KPI/customer data eventually rendered, but the overdue-debt control remained on `ရယူနေသည်...`. Opening Manual Report for `2026-08-26` left the preview on `report အချက်အလက်များ ရယူနေသည်...` for more than 60 seconds. A same-origin authenticated browser probe of the Manual Report preview exceeded the browser’s 30-second wait, and a concurrent probe of the Dashboard’s KPI, customer list, overdue, Daily Summary, and preview requests also exceeded the wait. The active service worker was already `service-worker-v9.js`, so the old service-worker-v8 fake 503 interception was not the cause in this session.

The production overdue API did eventually return HTTP 200 in approximately 13.9 seconds with one overdue customer. The delay was consistent with serverless cold-start/database setup contention: `ensureDatabase()` previously ran many sequential CREATE/ALTER/INDEX statements on a cold function even though the repository has additive Prisma migrations and the production schema is already complete. The code now performs a single schema-readiness table-count probe first; only an incomplete schema falls back to the existing additive setup path. This avoids changing or deleting business data and keeps the legacy safety path available for a genuinely incomplete database.

The Dashboard Manual Report preview now uses the shared API timeout/retry contract with a 12-second per-attempt timeout, aborts an older preview request when a new date is selected or the dialog closes, enables the close button during loading, and shows a `ပြန်စမ်းမည်` control after timeout or error. The overdue background request now uses the shared API path with a 20-second timeout and explicitly resolves an empty state when no prior snapshot exists after failure, so the bell cannot remain permanently stuck on `ရယူနေသည်...`. The actual preview/send endpoint remains session/PIN-protected and no report was sent during this audit.

A domain check also confirmed that `edger.vercel.app` is a different old Next.js application: its `/api/health` returned 404, while `newlifeledger.vercel.app/api/health` returned HTTP 200. All production testing and current code deployment must use `https://newlifeledger.vercel.app`.

No Customer, Ledger, CashSale, balance, Order, or Telegram report data was created, deleted, overwritten, or manually sent during the audit.


## 18. Authentication and Send Processing Guard — 2026-08-27

The PIN session bootstrap and Manual Telegram Report send path are also bounded now. Session/login requests abort after 12 seconds with a clear retry message instead of leaving the login overlay indefinitely. Manual report sending uses the shared request contract with a 20-second timeout; a timeout warns the user to check Auto Report status before attempting another send, reducing duplicate-report risk. No PIN value or secret is stored in browser storage by these changes.


## 19. Manual/Auto Report State and Duplicate Protection — 2026-08-27

Manual Report နှင့် scheduled Auto Report ကို report date တစ်ရက်တည်းအတွက် မထပ်ပို့စေရန် `AutoReportRun` ကို shared state အဖြစ် အသုံးပြုထားပါသည်။ Manual send route သည် Telegram မပို့မီ ထို report date အတွက် per-date advisory lock ဖြင့် run ကို claim လုပ်ပြီး၊ ပို့မှုအောင်မြင်လျှင် `SUCCESS`/`trigger=manual` အဖြစ် မှတ်တမ်းတင်ပါသည်။ ထိုနေ့အတွက် `SUCCESS` row ရှိပြီးသားဖြစ်လျှင် Manual ကိုလည်း `skipped` ပြန်ပေးပြီး report ကို ထပ်မပို့ပါ။ Dashboard သည် အဲဒီ skip ကို “အရင်ပို့ပြီးသားဖြစ်လို့ ထပ်မပို့တော့ပါ” ဟု မှန်ကန်စွာ ပြပါသည်။

Scheduled Auto Cron သည် prior Myanmar dates များကို oldest-first catch-up ဖြင့် စစ်ပါသည်။ အောင်မြင်ပြီးသား Manual row ကိုတွေ့လျှင် full report generation/delivery ကို မလုပ်ဘဲ group ထဲတွင် Manual ပို့ပြီးသားဖြစ်ကြောင်း၊ duplicate full report မပို့ကြောင်း status notice တစ်ကြောင်းသာ ပို့ပါသည်။ `manualNoticeClaimedAt` နှင့် `manualNoticeSentAt` timestamp များသည် concurrent cron invocation များကြား notice ကိုလည်း တစ်ကြိမ်တည်းဖြစ်စေရန် ကာကွယ်ပါသည်။ Metadata reconciliation row အတွက် system record time ကို မူရင်း Manual Telegram send time ဟု မမှားယွင်းစေရန် notice တွင် timestamp မပြပါ။

User အတည်ပြုချက်အရ Telegram တွင် မနက် `2026-08-27` တွင် ပို့ထားပြီးသား `2026-08-26` report ကို business data မထိဘဲ metadata-only reconcile လုပ်ထားပါသည်။ Production status page တွင် `2026-08-26`, `Manual ပို့မှု`, `SUCCESS`, recipient `1` အဖြစ် ပေါ်နေပါသည်။ ဤ row သည် အရင်ပို့ထားသော report ကို ပြန် generate မလုပ်ထားသောကြောင့် counts `0` နှင့် elapsed time မရှိခြင်းသည် ရည်ရွယ်ထားသော reconciliation အခြေအနေဖြစ်ပါသည်။ Customer၊ Ledger၊ CashSale၊ Order သို့မဟုတ် accounting/business data မည်သည့်အရာမျှ မပြောင်းလဲပါ။

| စစ်ဆေးချက် | အတည်ပြုထားသော အခြေအနေ |
| --- | --- |
| Local validation | `npm run lint`, full `npm test -- --run` (153 tests), `npm run build`, `git diff --check` အောင်မြင် |
| Git deployment | `85fe9c0` feature commit နှင့် `7e2e2c6` MMT notice wording fix ကို `origin/main` သို့ push ပြီး |
| Production health | `https://newlifeledger.vercel.app/api/health` HTTP 200 |
| Production Dashboard | KPI-first loading၊ overdue count `1`၊ compact grouped controls အလုပ်လုပ် |
| Production Auto status | `2026-08-26` Manual source row နှင့် next Auto duplicate-skip explanation ပေါ် |
| Cron safety | no-auth `https://newlifeledger.vercel.app/api/cron/daily-report` HTTP 401; authenticated Cron ကို manually မခေါ် |

အတည်မပြုရသေးသည့်အချက်မှာ Vercel Cron invocation runtime log ဖြစ်ပါသည်။ ထို့ကြောင့် `2026-08-26` အတွက် အရင် Manual delivery ကို status metadata အဖြစ် ပြန်မှတ်ထားနိုင်ပြီဖြစ်သော်လည်း Auto Cron ကို ယခုအချိန်တွင် manually trigger မလုပ်ထားပါ။ နောက် scheduled invocation ရောက်သောအခါ full report မထပ်ပို့ဘဲ one-time status notice ထွက်ပြီး `manualNoticeSentAt` မှတ်တမ်းတင်သွားမည်ဖြစ်ပါသည်။


## 20. Cron Retry, API Boundary Audit, Documentation, and PWA Refresh — 2026-08-27

### Auto Report readiness

Vercel official documentation was reviewed for Cron frequency, UTC behavior, failure delivery, and idempotency. The project now configures three separate once-per-day entries for the same idempotent handler: `01:30 UTC` (around 08:00 Myanmar primary), `02:30 UTC` (around 09:00 Myanmar retry), and `03:30 UTC` (around 10:00 Myanmar retry). This design does not use an hourly expression, so it remains compatible with Vercel Hobby's once-per-day-per-job restriction. The handler continues to use `CRON_SECRET`, per-report-date locks, bounded previous-date catch-up, Manual reconciliation, and success skipping.

The actual Vercel runtime invocation log is still unverified because the sandbox browser reached the Vercel login page. No authenticated Cron invocation and no Telegram delivery were triggered during this audit. Tomorrow's expected report date is the previous Myanmar calendar day; for a message delivered on the morning of 2026-08-28, the normal report date is 2026-08-27. If the primary invocation fails or is missed, the two separate retry windows can process the still-missing date. A successful date remains protected from a duplicate full report.

### Architecture and security audit

The Prisma schema validates successfully and contains 14 distinct domain models. Migrations and the runtime bootstrap were scanned for destructive SQL; no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or equivalent destructive migration was found. CashSale remains separate from Ledger and does not change Customer balance/net receivables. Order-only Customer data remains outside the accounting Customer table. Order activities remain available in Order History while accounting Activity History and Daily Report activity data exclude Order and OrderBatch events.

Two API boundary issues were corrected. `/api/auto-report-status` is no longer public and now requires the normal application session. The balance-changing compatibility alias `/api/kpay-webhook/match` is also no longer public and requires the application session. External KPay, Telegram webhook, and Cron paths retain their own callback/secret guards. Middleware regression tests cover these policies.

### Telegram workflow audit

The bot responsibilities are now documented as four separate flows: KPay notification intake, Order-group draft and field completion, Factory Handover delivery, and accounting Daily Report. Order callbacks acknowledge promptly, use admin checks, database status transitions, source update deduplication, and unique per-delivery records. Factory Handover remains limited to factory-front pickup, vehicle loading, and gate-delivery preparation; future bottle Inventory/Production is kept separate.

### Documentation and PWA UI

README.md was rewritten to document the canonical model names, API surface, environment variable names, data safety rules, Telegram destinations, Auto Report date semantics, retry windows, validation commands, and future plan. The older PRD was synchronized for the main Ledger/CashSale names, UUID identifiers, Telegram destination variables, and three-window report schedule.

An authenticated global PWA refresh control was added to the RootLayoutClient. It is a small safe-area-aware fixed button at the lower corner so it does not cover the Dashboard's top loading/error panel. It requests a service-worker update before reloading the page, does not write database data, and works across Dashboard and subpages. Existing service-worker v9 behavior remains network-first for pages and bypasses `/api/*` so stale/fake API responses are not produced.

Verification after these changes: `npm run lint` passed, the full Vitest suite passed with 153 tests, `npm run build` passed, Prisma validation and generation passed, route syntax checks passed, `git diff --check` passed, and targeted middleware/CashSale/Daily Summary tests passed.


## 21. Manual Report status count reconciliation — 2026-08-27

The production status row for report date `2026-08-26` originally showed zero counts because it was created as a metadata-only reconciliation after the real Manual Telegram delivery. The reconciliation helper now permits a one-time counts-only patch on that specific `manual-reconciled` zero-count row; it cannot overwrite a normal successful Manual row that already has counts and it cannot create a second send.

With the user's confirmation, the row was patched through the PIN-protected reconciliation route using the previously verified Manual Report summary: `paid 4`, `debtIncrease 6`, `transactions 10`, and `activityActions 11`, with recipient count `1`. Production status now displays total records `10`, paid `4`, debt increases `6`, and activities `11`. The API returned `recorded: true`, `updated: true`, and `reason: counts_backfilled`.

This was a metadata-only database update. It did not invoke Telegram, generate or resend any report file, modify Customer/Ledger/CashSale/Order data, change balances, or affect Auto Report duplicate protection. The next Auto scheduled run still treats the date as Manual-successful and sends only the one-time status notice rather than a duplicate full report.
