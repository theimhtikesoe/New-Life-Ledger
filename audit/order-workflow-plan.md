# New Life Ledger — Telegram Order Workflow Plan

**Status:** Planning only. No code, database schema, Telegram group, or live business workflow has been changed. The only existing Telegram group is the report group; it will remain report-only.

## Confirmed requirements

### 1. Customer matching

Every order must first be matched against an existing customer in New Life Ledger. If no match is found, the order must not become a confirmed order automatically. It will appear in the website’s **New Customer / အသစ်ထည့်ရန်** area as a separate **Draft Customer Order** for a person to review and create or link safely.

### 2. Multiple product lines in one order

A single order may contain multiple bottle/package lines. Example lines include:

- 0.5 Liter bottle, 100 bottles per card, 10 cards.
- 1 Liter bottle, 100 bottles per card, 5 cards.
- 0.3 Liter bottle, 400 bottles per card, 10 cards.

Each line must retain its own bottle size, bottles per card, card count, and calculated bottle total.

### 3. Card and bottle calculation

The system must record the card count and verify what each card represents. For each line:

`Total bottles = cards × bottles per card`

The order must also calculate the overall total cards and overall total bottles across all lines. A card count must never be stored without its bottle size and bottles-per-card information.

### 4. Caps and extra caps

The order should support normal cap quantity and additional/extra cap quantity as separate fields. The normal cap requirement can be calculated from the total bottle quantity, while extra caps remain visible as a separate requested quantity and are included in the factory notification.

### 5. Factory communication

Two new Telegram groups will be used. One new group will be the order-intake group for staff to post customer orders, and a second new private group will be used for factory staff. The existing report group will remain report-only. A confirmed order will be sent to the factory group only after a person confirms the extracted details.

## Proposed safety rule

Telegram text will create an **AI Draft** first. The system will show the extracted customer, product lines, card totals, bottle totals, caps, extra caps, destination, and requested date. Only a human pressing **Confirm** will create the confirmed website order and send the factory notification. Confirming an order will not change the customer’s DEBIT/CREDIT balance.

## Rollout rule

Do not ask the current group members to move yet. First prepare and test the flow in a safe test path. When the test passes, create or designate the separate factory group, add only the required factory staff and the existing bot, verify permissions, and then enable production notifications.

## Decisions still needed before implementation

1. Confirm whether one order can contain different cap types or only one cap type with an extra quantity.
2. Confirm whether the factory group should receive notifications immediately after confirmation or only for orders scheduled for the current/next production day.
3. Confirm whether “card” means a physical bundle/pack, and whether `bottles per card` is always an integer selected from known values or can be entered freely.
4. Confirm who is allowed to press Confirm, Edit, Cancel, and mark an order as Prepared/Completed.

## Proposed order data structure

The website should store one Order record with the source Telegram message, matched customer (if any), requested production date, destination/gate, status, confirmation actor, and timestamps. Each Order can contain multiple Order Lines. Each line stores bottle/package type, capacity in liters, bottles per card, card count, calculated bottle total, normal cap quantity, and extra cap quantity.

For each line:

`line bottle total = card count × bottles per card`

For the whole order:

`total cards = sum of line card counts`

`total bottles = sum of line bottle totals`

`total caps = total bottles + extra caps`, unless the factory confirms a different cap rule. The normal caps and extra caps remain visible separately so the factory can see exactly what is requested.

## Proposed message flow

1. A staff member writes an order in the new Telegram order-intake group, preferably beginning with `မှာယူမှု` or `Order` so normal conversation is not accidentally treated as an order.
2. The bot receives the message through a verified HTTPS webhook and sends it to the AI extraction step.
3. The AI returns structured fields, missing fields, confidence flags, and possible customer matches. It does not write a confirmed order at this stage.
4. The bot replies with a Draft Order card showing the customer match, every bottle line, cards, bottles per card, total bottles, caps, extra caps, destination, and today/tomorrow date.
5. A person presses Confirm, Edit, or Cancel. Edit sends the person back to a short correction flow; Cancel keeps the source message but does not create a confirmed order.
6. Confirm creates the website Order and Order Lines, records the confirming actor and Telegram message ID, and sends one factory notification. It does not change the customer’s DEBIT/CREDIT balance.
7. The website shows the Order in the normal Orders area and also shows unmatched customers in the New Customer / အသစ်ထည့်ရန် area as Draft Customer Orders. A person can create a new customer or link the draft to an existing customer before final confirmation.

## Duplicate and error protection

The same Telegram message must not create two orders if Telegram retries a webhook or a person presses Confirm twice. The source chat ID plus message ID and the callback action must be checked before creating the order. The factory notification also needs its own sent flag so a network retry does not notify the factory twice.

If customer matching is ambiguous, the order remains Draft and shows the possible matches. If a bottle size, bottles-per-card value, card count, destination, or date is missing, the system asks for only the missing value. AI is not allowed to guess a missing production quantity.

## Separate factory group recommendation

A new private Telegram group for the factory should be created, but not activated until the test flow is ready. A second new group should be created for order intake. The existing report group should not be reused for either workflow. Invite only the factory staff who need to prepare cards and add the existing bot with only the permissions required to send notifications. Do not move anyone until the test flow is ready.

The safer rollout is: create the new order-intake group and the private factory group, add only the required people, add the existing bot to both, test with one fake order, verify the draft/confirm flow and factory notification, then enable production notifications. Keep the existing report group unchanged. The factory group should receive only Confirmed orders, not raw drafts, cancelled orders, or customer matching discussions.

## Recommended first release boundary

The first release should support natural text after an `Order`/`မှာယူမှု` marker, multiple bottle lines, today/tomorrow dates, customer matching, Draft Customer Orders, caps and extra caps, Confirm/Edit/Cancel buttons, a website Orders page, and a separate factory notification group. It should not yet modify ledger balances, delete source messages, or automatically create a new customer without human confirmation.


## Revision confirmed on 2026-08-25

The existing Telegram group is not an order group. It is the existing report group and will remain unchanged. Viber is the current order-sharing channel, but no Telegram order-intake group exists yet.

Two new Telegram groups are required:

1. **Order Intake group:** office/staff members post customer orders here.
2. **Factory group:** factory staff receive only confirmed production notifications here.

The existing report group must not be used for order intake or factory notifications.

## Cap recording rule

Caps are recorded as a separate requirement from bottle lines. A cap entry contains:

- cap color/type, for example `အဖုံးပြာ`;
- normal requested quantity, for example `5000 pcs`;
- extra quantity, for example `+20 pcs`;
- calculated requested total, for example `5020 pcs`.

The factory message will display the cap line exactly as:

`အဖုံးပြာ — ပုံမှန် 5,000 pcs + အပို 20 pcs = စုစုပေါင်း 5,020 pcs`

The system will also display the expected cap count from the bottle total when the business rule is one cap per bottle. It will show a warning if the requested cap quantity does not match the expected count, but it will not silently change the user’s requested quantity. If an order uses more than one cap color/type, each color/type becomes its own cap entry.

For the example bottle lines 0.5 L × 100 × 10 cards, 1 L × 100 × 5 cards, and 0.3 L × 400 × 10 cards, the calculated bottle totals are 1,000 + 500 + 4,000 = 5,500 bottles, with 25 cards overall. If the cap request is 5,000 + 20, the system will show the requested cap total as 5,020 and a visible comparison against the 5,500-bottle expectation; it will not guess whether the difference is intentional.

## Notification modes

After Confirm, the system will offer two separate actions:

- **Send to factory now:** sends the confirmed order immediately and marks the factory notification as sent.
- **Add to morning batch:** keeps the order confirmed but queues it for the selected morning batch time.

The same order may be included in the morning batch only once. The batch message will group confirmed orders by requested production date and include totals by bottle line and cap color/type. The approved morning batch time is 08:10 Myanmar time, and its Telegram notification is enabled by default; staff may turn it off from the website when necessary.

## Telegram group setup checklist

Do not move Viber members yet. After the plan is approved and the test flow is ready:

1. Create a new private Order Intake group and add only the people who write or confirm orders.
2. Create a separate private Factory group and add only factory staff.
3. Add the existing Telegram bot to both groups.
4. Give the bot only the ability needed to read intake orders and send factory notifications.
5. Send one fake order through Draft → Confirm → Factory notification before using a real order.
6. Keep the existing report group and its daily reports unchanged.

For the first release, the safer message trigger is to begin an order with `မှာယူမှု` or `/order`. This prevents ordinary group chat from becoming accidental orders. If the owner later wants the bot to read every normal sentence as an order, group privacy settings can be changed deliberately after testing.


## Implementation design approved for the first build

### Order tables

The first build will add `Order`, `OrderLine`, `OrderCap`, `OrderDelivery`, and `OrderBatchRun` records. Existing Customer, Ledger, KPay, AuditLog, and AutoReportRun records will not be altered. An Order stores the source Telegram chat/message identity, raw source text, matched Customer when available, unmatched draft name when not available, destination, Myanmar requested date, notification mode, status, and confirmation metadata. OrderLine stores bottle type, capacity in milliliters, bottles per card, card count, and the server-calculated bottle total. OrderCap stores color/type, normal pcs, extra pcs, and the server-calculated requested total.

### Status states

`DRAFT` means AI extracted the message and it is waiting for human review. `NEEDS_CUSTOMER` means the name did not match one active Customer and the draft must appear in Customer အသစ်ထည့်ရန်. `NEEDS_REVIEW` means a required field is missing or ambiguous. `CONFIRMED` means a person confirmed the details. `BATCH_QUEUED` means the person selected morning delivery. `FACTORY_NOTIFIED` means the factory message was sent. `PREPARED`, `COMPLETED`, and `CANCELLED` are later operational states.

### Notification timing

Immediate delivery sends after Confirm. Morning batch delivery runs at Myanmar 08:10, ten minutes after the existing report schedule, and the website batch setting defaults to enabled. A batch order remains queued only when staff deliberately turn the setting off; it is not sent while the setting is disabled. A unique order/source identity and unique delivery record prevent repeated Confirm actions or webhook retries from creating duplicate order records or duplicate factory notifications.

### Telegram configuration

The report group keeps `TELEGRAM_GROUP_CHAT_ID`. The new order-intake group will use `TELEGRAM_ORDER_GROUP_CHAT_ID`, and the future factory group will use `TELEGRAM_FACTORY_GROUP_CHAT_ID`. The order webhook will require `TELEGRAM_ORDER_WEBHOOK_SECRET` when configured and will accept only `message` updates from the configured intake group. The first release will not send factory notifications until the factory chat ID exists and the website setting/order action enables delivery.


## External integration facts used for this design

Telegram’s official Bot API supports two mutually exclusive update-delivery methods: `getUpdates` and HTTPS webhooks. Webhooks deliver JSON `Update` objects by POST and can include the `X-Telegram-Bot-Api-Secret-Token` header when a secret token is configured. Telegram updates include a monotonically increasing `update_id`, which is useful for ignoring repeated webhook deliveries. Telegram bot features include commands, reply keyboards, inline keyboards, and Mini Apps. Group privacy mode affects which group messages a bot receives, so the first release uses an explicit `မှာယူမှု` or `/order` trigger rather than treating all conversation as orders.

For structured AI extraction, Manus API v2 supports `structured_output_schema` on task creation. The schema root must be an object; every object must use `additionalProperties: false`; every declared property must appear in `required`; nullable values should use a type array or `anyOf`; and unsupported keywords such as `minimum`, `maximum`, `pattern`, and `format` must not be used. The application must check `structured_output_result.success` before trusting the extracted value. These facts are from the official Telegram Bot API, Telegram Bot Features, and Manus Structured Output documentation.

Sources:
- https://core.telegram.org/bots/api
- https://core.telegram.org/bots/features
- https://open.manus.ai/docs/v2/structured-output

## Revision confirmed on 2026-08-25 — Admin-only callbacks and mixed-language orders

The owner confirmed that Telegram draft buttons may directly Confirm or Cancel an Order, but only a Telegram group administrator may do so. The server must verify the callback sender’s numeric Telegram user ID from `callback_query.from.id` with Telegram `getChatMember` and accept only `administrator` or `creator`/owner status. If the owner wants exactly two or three people rather than every group administrator, `TELEGRAM_ORDER_ADMIN_IDS` may contain a comma-separated allowlist; when that allowlist is present, both checks are required. Missing configuration, a failed Telegram admin lookup, malformed callback data, a wrong chat, or a non-admin sender must fail closed and must not mutate the Order.

The direct callback actions are intentionally explicit: immediate Confirm, 08:10 morning-batch queue, and Cancel. A successful action edits the draft message to show the result and removes the action buttons. Immediate Confirm uses the existing idempotent factory delivery path; if the factory group is not configured or delivery fails, the Order remains confirmed with a visible pending delivery and no message is sent anywhere else. All callback actions record the source and non-secret Telegram user identifier in audit metadata while retaining the existing safe `Staff` actor fallback.

Order input may mix Myanmar, English, digits, common units, and business abbreviations. The extraction prompt must treat the text as untrusted order data, normalize Myanmar digits and common number separators, understand aliases such as `L/ltr/liter`, `ml`, `ကဒ်/card/ctn` only when the surrounding text supports that meaning, and preserve the original source text. The model must not guess a missing quantity, date, destination, customer, or product detail. If the mixed-language wording is ambiguous, the result remains Draft/Needs Review and the normalized interpretation is shown for human correction before confirmation. The factory message uses the server-stored normalized fields, while the original order text remains available for comparison.
