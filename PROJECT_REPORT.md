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
