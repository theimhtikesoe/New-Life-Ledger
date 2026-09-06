# Shared Header Layout Contract — 2026-09-06

## Purpose

The top UI must remain visually identical across authenticated route pages. The shared header is the single source of truth for navigation, today's date, clock, app label, and page title.

## Canonical order

1. The fixed actor/user switcher occupies its own top rail.
2. The shared route header begins below that rail.
3. The Dashboard link is in normal flow at the upper-left of the header; it must not be absolutely positioned over the actor switcher.
4. The date label, current Myanmar date, clock, and Myanmar Time label remain in one centered block.
5. The `New Life Ledger Dashboard` label and route title remain in one left-aligned block below the clock.

## Visual contract

Every route header uses the same card height, horizontal padding, date/clock typography, app-label typography, and title typography. Route titles use the same responsive token: `text-[clamp(1rem,4.5vw,1.55rem)]`. The clock uses `text-2xl font-bold tracking-wider`; the date and Myanmar Time labels use the same tokens on every route.

The spacing between the header and the page content is controlled by the adjacent selector `.shared-page-header-route + .app-page-main`. Do not add page-specific top margins or duplicate header margins to individual route pages.

The final canonical CSS block is at the end of `src/app/globals.css`. It intentionally overrides older historical rules. Mobile, tablet, and desktop each have one explicit route-header top rail. The mobile route header must remain below the actor switcher and must not be moved upward to reduce blank space without checking the actor/header overlap.

## Maintenance rules

Do not recreate date/clock/title markup inside individual route pages. Do not change the shared header's title font size on one page only. Do not add `absolute` positioning to the Dashboard link. When modifying the shell, verify at least `/ledger`, `/production`, `/activity`, and `/vercel-build-logs` on a narrow iPhone-sized viewport.

Run the targeted regression suite and production build after any header change:

```bash
pnpm test --run tests/actor-access-workflow.test.js tests/safari-viewport-spacing.test.js tests/navigation-persistence.test.js
pnpm build
```

## Why this was important

Earlier fixes repeatedly adjusted page-specific margins and padding, which made the Ledger page look correct while Production, Activity History, and Vercel Build Logs still moved the actor switcher, Dashboard link, header, or content card into different vertical positions. The final fix standardized the shared header markup/tokens and made one canonical CSS contract responsible for the route header rail and content gap.

## Reference commit

The finalized implementation was pushed in commit `2f0a7d2` (`standardize shared page header layout`).
