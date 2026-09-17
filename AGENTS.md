# New Life Ledger Agent Instructions

## Canonical stock and sales rules

The PostgreSQL records are the source of truth. Browser local/session storage may cache presentation data, but it must never be used as the authoritative value for inventory, sales, balances, or KPI totals.

All factory stock KPIs must use the canonical movement pipeline from `src/lib/factory-stock.js`, especially `loadCanonicalFactoryStockMovements()` and `aggregateStockMovements()`. The canonical pipeline keeps manual adjustments and rebuilds derived ProductionReport, Ledger sale, and CashSale movements from current source records. It removes stale persisted derived rows. Do not calculate Dashboard stock totals directly from `FactoryStockMovement.findMany()` or `groupBy()`.

`productKey` is part of stock identity. Bottle and Tube records must remain separate by normalized product type and capacity. Cap records must remain separate by location, color, and pack size. Never group only by `stockType`, `capacity`, and `movementType`; that loses item identity and can produce incorrect totals.

The linked stock pages and Dashboard must report the same units:

- Bottle stock: sum canonical `currentCards` for `stockType === "BOTTLE"`.
- Tube stock: sum canonical `currentBottles` for pieces and convert each Tube type to packs using its own capacity before summing packs.
- Cap stock: sum canonical `currentCards` for configured cap packs with `capacity > 0`; capacity-zero legacy color-only rows are not physical pack stock.

These values are database-derived system stock, not a physical count. Keep the UI warning that physical stock may differ until a physical reconciliation adjustment is recorded.

## Canonical daily bottle sales rules

The daily bottle-sales page and Dashboard daily bottle-sales KPI must use `buildDailyBottleSalesSummary()` from `src/lib/daily-bottle-sales.js`. Do not create a second summary algorithm in a route or component.

Physical daily sales are CashSale rows plus Ledger `CREDIT` rows with sale items. Ledger `DEBIT` rows are payment events for earlier credit sales. They may appear in the paid-bottle reconciliation section, but they must not be added a second time to the physical-sales headline. Use `hydrateSettledBottleSaleItems()` when loading debit rows so linked payments can show their original bottle items.

Daily date filtering must use `getMyanmarDayRange()` and the selected Myanmar date. Keep the legacy exact-midnight compatibility condition when changing date-sensitive KPI queries.

## Change and validation rules

When changing stock or sales calculations, inspect and update all of these together:

- `src/lib/factory-stock.js`
- `src/lib/daily-bottle-sales.js`
- `src/app/api/factory-stock/route.js`
- `src/app/api/dashboard-kpi/route.js`
- `src/app/api/daily-bottle-sales/route.js`
- `src/app/factory-stock/page.js`
- `src/components/TubeStockDetailPage.jsx`
- `src/app/cap-stock/page.js`
- `src/components/Dashboard.jsx`
- Relevant tests under `tests/`

Dashboard cards link to `/factory-stock`, `/tube-stock`, `/cap-stock`, and `/daily-bottle-sales?date=...`. A change is incomplete if a card and its linked page can calculate different totals from the same date and database state.

Before committing, run the focused stock/sales tests and the production build. Do not commit credentials, PINs, session secrets, database URLs, or live customer data. Never use a destructive database reset to repair a KPI mismatch; fix the calculation source and preserve the movement audit trail.
