# Telegram workflow review — 2026-08-27

## Verified workflow boundaries

The bot currently has four separate responsibilities: KPay notification intake into `UnverifiedKpay`, Order-group draft creation and field completion, Factory Handover delivery for confirmed Orders, and the accounting Daily Report. The destination IDs are separate in code: `TELEGRAM_GROUP_CHAT_ID`, `TELEGRAM_ORDER_GROUP_CHAT_ID`, and `TELEGRAM_FACTORY_GROUP_CHAT_ID`.

## Order-group behavior

The webhook requires `TELEGRAM_ORDER_WEBHOOK_SECRET`, ignores messages outside the configured Order group, ignores bot messages, and uses Telegram `update_id` plus database unique source fields to reject duplicate incoming Order messages. It accepts `/order`, `/order@bot`, `မှာယူမှု`, Burmese/English digits, and free-form order text after the trigger. Deterministic parsing is attempted before bounded optional AI enrichment.

The first Telegram draft is sent before optional AI enrichment, so the user can see a Draft and its action buttons without waiting for the AI result. The action keyboard includes Customer linking or Order-only Customer draft, missing date/destination/phone prompts, details, Confirm, and Cancel. Confirm is allowed when an Order customer exists even if non-accounting fields remain missing; missing fields stay visible rather than silently guessed.

Callback queries are acknowledged before the network-bound Telegram admin membership check. Confirm, Cancel, date, destination, phone, Customer link, Customer draft, details, back, and retry callbacks are routed through the same Order ID format. Factory delivery uses a per-delivery advisory lock and unique `(orderId, destinationType, mode)` constraint, so concurrent Confirm taps do not intentionally send a second Factory message. Existing Orders are updated through transactional service functions, and Order-only Customer data never enters the main accounting Customer table.

## Factory Handover boundary

The Factory group message means factory-front pickup, vehicle loading, or gate-delivery preparation. It does not represent bottle manufacturing or inventory production. `OrderDelivery` records sent/pending/failed state, and the system retains the Order status and Telegram message metadata for later review.

## Daily Report boundary

Daily Report delivery is separate from Order notifications. The report helper sends the summary image, filtered accounting activity image, and PDF to the accounting Telegram group. Order and OrderBatch activities are excluded from accounting activity payloads. Auto Report and Manual Report use report-date claim/finish state and manual-success reconciliation to avoid duplicate full reports.

## Remaining limitations and future hardening

Telegram callback delivery is external and best-effort. A callback can be answered promptly while the database or Factory message still takes longer; the edited Order message is the durable user-visible state. KPay intake remains backward-compatible when its optional webhook secret is absent, but Production should configure `KPAY_WEBHOOK_SECRET`. Provider event-ID/fingerprint deduplication remains a future addition for repeated identical banking notifications. A true end-to-end Telegram smoke test requires explicit owner approval because it creates real group messages and must not be performed as an unapproved health check.
