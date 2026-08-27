# Auto Report production status audit — 2026-08-27

The production Auto Report status page was opened after PIN login in read-only mode.

Observed at 2026-08-27 09:15 Myanmar Time:
- Latest successful run: 2026-08-26 08:58 Myanmar Time
- Report date delivered by that run: 2026-08-25
- Recipients recorded: 1
- Transactions: 19
- The run history contains successful entries through report date 2026-08-25.
- No run for report date 2026-08-26 was shown at the 09:15 check.

The public cron route returned HTTP 401 without the Vercel Authorization header during a non-delivery probe. That probe did not execute the report and does not prove whether production CRON_SECRET is configured; it only confirms the route is protected.

Repository schedule: /api/cron/daily-report at 30 1 * * * (01:30 UTC = 08:00 Myanmar Time).

Conclusion: the schedule/configuration exists in the repository, but the latest expected report is not recorded. The next investigation must check Vercel Cron invocation/runtime logs and make the cron reconcile missed report dates instead of permanently skipping them.

Production build-log page was also opened after PIN login. It shows the latest production deployment as READY for commit 66eddbd, with prior READY deployments 7a9572c, a0a2f97, b82b9d2, and b3aa21e. The page did not show an Auto Report cron invocation log in the visible deployment build output. The latest deployment is live, but the missing 2026-08-26 report still requires Vercel Cron runtime-log verification/configuration rather than a build failure explanation.

Sources checked:
- https://newlifeledger.vercel.app/auto-report-status
- https://newlifeledger.vercel.app/vercel-build-logs
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/kb/guide/how-to-setup-cron-jobs-on-vercel

Official Vercel documentation confirms that CRON_SECRET is sent as Authorization: Bearer <CRON_SECRET>, cron schedules are UTC-based, cron runs only on production deployments, and failed invocations are not automatically retried. It also recommends checking Cron Jobs runtime logs and making jobs idempotent/reconciling missed dates.

After the user confirmed the Vercel Environment Variables screenshot, CRON_SECRET was visibly present for Production and Preview. A fresh read-only visit to the production Auto Report status page at 09:19 Myanmar Time showed the page stuck at “အခြေအနေ ရယူနေသည်...” / “Auto Report အခြေအနေ ရယူနေသည်...” in the sandbox browser, instead of returning the prior six-run table. This points to an additional status API fetch/runtime issue to investigate separately from the scheduled cron itself. No send action was performed.

User-provided Vercel Cron Jobs screenshot confirms: Cron Jobs is Enabled; /api/cron/daily-report is listed at 01:30 AM UTC; /api/cron/order-batch is listed at 01:40 AM UTC; /api/cron/order-trash-cleanup is listed at 06:30 PM UTC. The screenshot does not show the View Logs result, so it confirms configuration/activation but not whether the 27 Aug daily-report invocation executed.

New requirement: accounting Activity History and Telegram Daily Report must exclude all Order workflow activities, including ORDER_DRAFT, ORDER_CANCEL, ORDER_BATCH_NOTIFIED, and future ORDER_* actions. Order History must remain able to show its own operational audit records. Implemented a shared accounting activity scope that excludes entityType Order, entityType OrderBatch, and any action beginning ORDER_, with both database-query and client-side safeguards.

Commit 37b4156 was pushed to origin/main and GitHub reports the Vercel deployment completed successfully. Production verification after deployment: GET /api/auto-report-status returned HTTP 200 and still showed the latest persisted SUCCESS as reportDate 2026-08-25, createdAt 2026-08-26T02:28:59.341Z, recipientCount 1, activityActions 33; no persisted 2026-08-26 run was present. GET /api/cron/daily-report without Authorization returned HTTP 401, confirming the safety guard and no report send. No manual authorized cron invocation was made, so no duplicate Telegram report was triggered.
