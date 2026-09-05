# User Change / Production UI verification

- Local `pnpm start` app opened at `/production` without authentication and displayed all five actor buttons: ဖေဖေ, ပုံ့ပုံ့, ဆောင်းဦး, ဇွဲဇွဲ, Staff.
- Clicking `Staff` changed the modal immediately to PIN entry and displayed `ရွေးထားသော User: Staff`.
- PIN modal exposed `အခြား User ပြန်ရွေးရန်`; clicking it returned to the actor selector immediately.
- The selector/modal remained interactive in the browser; the revised flow does not require waiting five minutes for manual switching. The five-minute text is the idle-lock explanation only.
- The shared page header was not yet browser-verified behind authentication because the local environment had no configured authentication PIN/session.
- Build and targeted tests passed after the changes. Full suite still has three unrelated pre-existing brittle source-assertion failures in customer-management and daily-sales-summary-panel tests.

## Code findings

- Production previously rendered its own `ထွက်ရှိမှု မှတ်တမ်းတင်ရန်` title while `SharedPageHeader` rendered the same title, causing duplication.
- Production previously rendered a large local form header and shared header; local header was removed so the shared header is the single title/navigation source.
- Shared header date/time classes were reduced globally for `/activity`, `/daily-summary`, and `/production`, while preserving the layout shell.
- The shared header retains `← Dashboard` for non-ဇွဲဇွဲ users; ဇွဲဇွဲ remains production-only.
- Actor selector now has loading protection, clearer selected-user PIN state, a back-to-selector action, and a higher modal z-index to prevent click interception.

Additional browser verification: selecting `ဆောင်းဦး` also moved immediately to PIN entry and displayed the selected user; the back action returned to the actor selector again. This confirms the previously unresponsive-looking non-ဖေဖေ choices now follow the same interactive path.

Authenticated local smoke test on port 3001 with a dummy local PIN succeeded: after selecting Staff and entering the test PIN, the page content showed exactly one `ထွက်ရှိမှု မှတ်တမ်းတင်ရန်` title, a `← Dashboard` link, and a reduced clock (`05:15:14`) in the shared header. The production form rendered normally; the database warning was expected because the smoke server had no Postgres URL.

Authenticated smoke verification continued: clicking the top-left `U Staff ⌄` switcher immediately opened the actor selector over the Production page without waiting five minutes. The selector modal visibly sat above the page content, confirming the z-index/clickability fix; the shared `← Dashboard` link remained visible behind it for Staff.

Final authenticated smoke verification: from Staff, the user switcher opened immediately; choosing `ဆောင်းဦး` opened the PIN modal, and entering the same local test PIN completed the switch. The page stayed on Production with the same single title, compact clock, and Dashboard link; only the user badge changed to `ဆောင်းဦး`.
