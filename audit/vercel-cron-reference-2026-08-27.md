# Vercel Cron reference — 2026-08-27

Official sources reviewed:

- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/docs/cron-jobs

The official Usage & Pricing page states that Hobby cron jobs may run once per day, with per-hour scheduling precision (the invocation can occur within the configured hour). It also states that multiple cron jobs are supported per project. Therefore, adding separate once-per-day entries for the same idempotent report endpoint is compatible with Hobby's frequency rule, while a single hourly expression would not be.

The official Managing Cron Jobs page states that cron requests use the Authorization Bearer CRON_SECRET header, that Vercel does not automatically retry a failed invocation, that cron delivery can miss an invocation or duplicate one, and that jobs should use locks plus idempotent reconciliation. It also documents the x-vercel-cron-schedule header and notes that cron expressions use UTC.

The official Cron Jobs page states that Vercel sends an HTTP GET request to the production deployment URL and that the schedule header identifies which configured expression triggered the request.

Application decision: use one primary daily-report schedule at 01:30 UTC (around 08:00 Myanmar), plus two separate once-per-day retry windows at 02:30 UTC (around 09:00 Myanmar) and 03:30 UTC (around 10:00 Myanmar). The application handler scans bounded prior Myanmar dates, uses per-date locks, skips successful/manual dates, and catches up only missing or failed dates. No authenticated cron invocation was performed during this audit.
