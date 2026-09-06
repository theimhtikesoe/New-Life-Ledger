# All-page layout standardization review — 2026-09-06

## Live reference findings

The authenticated live Dashboard and Ledger pages use the same top-level visual language: an outer shell with the shared date/time and title header, followed by a content container that is inset from the viewport. The live Daily Summary page also renders the shared header, but its mobile/medium viewport presentation showed the header starting too close to the top in the supplied reference context and its page-specific content beginning with a separate toolbar.

At the live Daily Summary route in the browser, the current computed layout at the available browser viewport was:

| Element | Top | Left | Width | Height | Margin top | Padding top |
|---|---:|---:|---:|---:|---:|---:|
| `.neon-app-shell-viewport` | 24px | 0px | 1265px | 1330px | 0px | 0px |
| `.neon-app-shell` | 24px | 0px | 1265px | 1330px | 0px | 0px |
| `.shared-page-header` | 24px | 24px | 1217px | 210px | 24px | 16px |
| `.app-page-main` | 254px | 0px | 1265px | 1100px | 0px | 24px |
| `.app-page-container` | 278px | 24px | 1217px | 569px | 0px | 0px |

The standardization target is to make all route pages use the same shell width, outer inset, shared-header top clearance, header-to-content gap, and page container rhythm as the Dashboard/Ledger reference rather than allowing page-specific top margins or full-width wrappers to pull content upward.

## Uploaded mobile references

The uploaded Production reference shows the actor button in the top-left safe rail, followed by a generous blank gap and then the shared header. The shared header contains the Dashboard link, centered date/time, New Life Ledger label, and page title inside a rounded container. The uploaded Ledger reference shows the same header container beginning below the safe top rail, then a separate content card with a consistent gap below the header. These references confirm that non-Dashboard pages should not begin their main container immediately at the top of the visible page; they need the same safe top rail and header-to-content rhythm as Ledger.

## Implemented standardization

The shared route header now uses the same `New Life Ledger Dashboard` label as the Dashboard/Ledger reference pages. All route-page main containers retain the common 80rem/inset shell and now use an explicit shared rhythm: mobile header top clearance below the actor rail, a 1.75rem header-to-content gap, and 1.25rem mobile / 1.5rem larger-screen main top padding. Tablet spacing is slightly increased to prevent the header and content from appearing pressed against the top controls.

Targeted all-page regression tests passed (14 tests), and the production build completed successfully.
