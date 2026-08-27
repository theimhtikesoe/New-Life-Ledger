# Project Requirement Document (PRD) & System Report

**Project Name:** New Life Ledger & KPay Automation System  
**Client/User:** Rhyzoe (Dev x Artist)  
**Current Stack:** Next.js App Router, Tailwind CSS, Postgres via Prisma ORM, MacroDroid/Android automation, Telegram Bot API.

## ၁။ လက်ရှိ ဖြစ်ပျက်နေသော ပြဿနာ (Background & Pain Points)

လက်ရှိ ကုန်ပစ္စည်း အရောင်းအဝယ်တွင် "အကြွေးစနစ်" (Credit/Ledger System) ကို အသုံးများသည်။ Customer များသည် အဟောင်းပေး အသစ်ယူခြင်း၊ အကြွေးဟောင်း မကျေသေးဘဲ အသစ်ထပ်ယူခြင်းများကို အမြဲပြုလုပ်ကြသည်။

### အဓိက Pain Points

1. **စာရင်းအရှုပ်ထုပ် ဖြစ်နေခြင်း**
   လက်ရှိတွင် အရောင်းမှတ်တမ်း ရေးသားသော ဘောက်ချာစာအုပ် ၁၀၀ ကျော် ရှိသည်။ ၎င်းတို့ကို ကခဂ / A-B-C အက္ခရာစဉ်အလိုက် ခွဲထားရပြီး Customer တစ်ဦး ပစ္စည်းလာယူတိုင်း စာအုပ်ဟောင်းများကို လှန်လှော၍ "အဟောင်းကျန် + အခုဝယ်ယူမှု = စုစုပေါင်းအကြွေး" ဟု လက်ဖြင့် လိုက်ပေါင်းနေရသည်။ ထို့ကြောင့် အချိန်ကုန်ပြီး စာရင်းလွဲချော်မှု ဖြစ်နိုင်ခြေ မြင့်မားသည်။

2. **KPay/Mobile Banking စစ်ဆေးရခက်ခဲခြင်း**
   ကုန်ပစ္စည်း ပို့ဆောင်ပြီးပါက ငွေဝင်/မဝင်ကို banking apps များထဲတွင် အမြဲလိုက်ရှာကြည့်နေရသည်။ ငွေလွှဲဝင်သည့် ဖုန်းမှာ ဆောင်းဦးထံတွင်ရှိပြီး၊ စာရင်းတိုက်စစ်သူမှာ ဖေဖေဖြစ်သည်။ ထို့ကြောင့် ငွေဝင်တိုင်း ဆောင်းဦးမှ ဖေဖေ့ထံသို့ "ဘယ်သူ့ဆီက ဘယ်လောက် ဝင်သည်" ဟု လိုက်ပြောနေရပြီး လုပ်ငန်းလည်ပတ်မှု ကြန့်ကြာနေသည်။

## ၂။ စနစ်၏ ပန်းတိုင် (Project Objective)

ဘောက်ချာစာအုပ် ၁၀၀ ကျော် လှန်ရသည့် ဒုက္ခကို လျှော့ချရန်နှင့် ဖုန်းထဲ ငွေဝင်သည်နှင့် လူကိုယ်တိုင် လိုက်ပြောစရာမလိုဘဲ စာရင်းထဲသို့ အော်တိုရောက်ရှိလာစေရန် Custom Web Dashboard တစ်ခု တည်ဆောက်မည်။

ဖေဖေသည် Dashboard ထဲတွင် pending KPay ဝင်ငွေများကိုကြည့်ရှုနိုင်ပြီး Customer နာမည်ဖြင့် အလွယ်တကူ တွဲချိတ် (Match) နိုင်ရမည်။ Match လုပ်ပြီးသည်နှင့် Customer ၏ အကြွေးကျန်ငွေကို အလိုအလျောက် လျှော့ချပြီး `Ledger` transaction အဖြစ် သိမ်းဆည်းရမည်။ CashSale သည် သီးခြား sales record ဖြစ်ပြီး Customer balance/net receivables ကို မပြောင်းရ။

## ၃။ Core Workflow & Architecture (စနစ်၏ အလုပ်လုပ်ပုံ Flow)

စနစ်အား အောက်ပါအပိုင်း ၃ ပိုင်းဖြင့် ချိတ်ဆက်လည်ပတ်မည်။

### ၃.၁ Android Notification Intake

1. KPay/Mobile Banking app ထဲသို့ ငွေလွှဲဝင်လာသည်။
2. Android ဖုန်းရှိ MacroDroid သည် notification ကို detect လုပ်သည်။
3. MacroDroid သည် notification title နှင့် text ကို JSON format ဖြင့် Webhook API သို့ POST လုပ်သည်။

Endpoint:

```txt
POST /api/kpay-webhook
```

Example JSON body:

```json
{
  "title": "KPay",
  "text": "၁၅,၀၀၀ ကျပ် ဝင်ပါသည်"
}
```

### ၃.၂ Server Processing & Notification

1. Webhook API သည် `title` နှင့် `text` ကို လက်ခံသည်။
2. `text` ထဲမှ ငွေပမာဏကို Regex/digit normalization ဖြင့် ထုတ်ယူသည်။
3. `UnverifiedKpay` table ထဲတွင် `PENDING` status ဖြင့် သိမ်းသည်။
4. Telegram Bot API ဖြင့် ဖေဖေ့ထံသို့ ငွေဝင်အကြောင်းကြားစာ ပေးပို့သည်။

Telegram message format:

```txt
🚨 KPay ငွေဝင်ပြီ - ပမာဏ: [Amount] ကျပ်။ စစ်ဆေးရန်: [Web App Link]
```

### ၃.၃ Dashboard Matching & Ledger Update

1. Dashboard ထဲတွင် pending KPay bucket ကို ပြသည်။
2. ဖေဖေသည် pending KPay card တစ်ခုမှ "လူနာမည်နှင့် တွဲမည်" ကိုနှိပ်သည်။
3. Customer ကို dropdown/modal မှ ရွေးသည်။
4. System သည် transaction တစ်ခုတည်းအတွင်း အောက်ပါအလုပ်များကို ဆောင်ရွက်သည်။
   - Customer `current_balance` မှ KPay amount ကို နှုတ်သည်။
   - `Ledger` ထဲတွင် KPay payment အတွက် `DEBIT` transaction အဖြစ် သိမ်းသည်။
   - `UnverifiedKpay.status` ကို `MATCHED` သို့ ပြောင်းသည်။

## ၄။ Data Model

### Customer

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID String | Primary key |
| `name` | String | Customer name |
| `phone` | String? | Optional phone number |
| `current_balance` | Int | Current debt balance |
| `createdAt` | DateTime | Created timestamp |

### Ledger

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID String | Primary key |
| `customerId` | UUID String | Foreign key to Customer |
| `date` | DateTime | Transaction date |
| `type` | String | `DEBIT` or `CREDIT` |
| `amount` | Int | Transaction amount |
| `note` | String? | Optional note |
| `createdAt` | DateTime | Created timestamp |

Meaning:

- `DEBIT` = Customer ငွေချေပြီး လက်ကျန်အကြွေး လျော့သည်။
- `CREDIT` = Customer အကြွေးတိုးပြီး လက်ကျန်အကြွေး တိုးသည်။
- `CashSale` = `RETAIL`/`WHOLESALE` လက်ငင်းရောင်းစာရင်းဖြစ်ပြီး Ledger pair မရေးဘဲ net receivables မပြောင်းပါ။

Balance example: လက်ကျန်အကြွေး 100,000 Ks ရှိနေချိန်တွင် `CREDIT 200,000` ထည့်လျှင် 300,000 Ks ဖြစ်ပြီး အနီရောင် debt အဖြစ်ပြမည်။ ထို့နောက် `DEBIT 400,000` ထည့်လျှင် -100,000 Ks ဖြစ်ပြီး 100,000 Ks ကြိုတင်ငွေချေ လက်ကျန်အဖြစ် အစိမ်းရောင်ပြမည်။

### CashSale

CashSale သည် retail/wholesale sale type၊ amount၊ item size၊ cartons၊ rate၊ deductions၊ payment type၊ date နှင့် note ကို သီးခြားသိမ်းပါသည်။ Daily Summary/KPI/Telegram report တွင် ပါဝင်သော်လည်း Customer balance ကို မပြောင်းပါ။

### UnverifiedKpay

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID String | Primary key |
| `raw_text` | String | Full notification text |
| `amount` | Int | Parsed KPay amount |
| `status` | String | `PENDING` or `MATCHED` |
| `createdAt` | DateTime | Created timestamp |

Note: `type` နှင့် `status` ကို String အဖြစ်သိမ်းပြီး API layer မှ value များကိုထိန်းထားသည်။

## ၅။ Dashboard Requirements

### Top/Header

- System name ပြရမည်။
- Pending KPay count ပြရမည်။
- Pending total amount ပြရမည်။
- Online/loading status ပြရမည်။

### Section 1: Unverified KPay Bucket

- `PENDING` status ဖြစ်နေသော KPay ဝင်ငွေများကို card layout ဖြင့်ပြရမည်။
- Card တစ်ခုစီတွင် amount, created time, raw notification text ပါရမည်။
- "လူနာမည်နှင့် တွဲမည်" button ပါရမည်။
- Button နှိပ်လျှင် customer ရွေးနိုင်သော modal/dropdown ပေါ်ရမည်။

### Section 2: Customer List With Search

- Customer များကို အမည်/ဖုန်းနံပါတ်ဖြင့် ရှာနိုင်ရမည်။
- Customer အသစ်ထည့်နိုင်ရမည်။
- အကြွေးကျန်ရှိသူများကို အရောင်လိုင်းဖြင့် ပေါ်လွင်စေရမည်။

### Section 3: Customer Detail View

- Customer profile ပြရမည်။
- လက်ရှိအကြွေးကျန်ငွေ ပြရမည်။
- Manual ledger entry form ပါရမည်။
- `DEBIT`/`CREDIT` transaction ထည့်နိုင်ရမည်။
- Transaction history table ပါရမည်။

## ၆။ API Surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/kpay-webhook` | MacroDroid notification intake |
| `GET` | `/api/unverified-kpay?status=PENDING` | Pending KPay list |
| `GET` | `/api/customers` | Customer list/search |
| `POST` | `/api/customers` | Create customer |
| `GET` | `/api/customers/[id]` | Customer detail with transaction history |
| `PATCH` | `/api/customers/[id]` | Update customer profile |
| `POST` | `/api/customers/[id]/transactions` | Manual debit/credit entry |
| `POST` | `/api/kpay-match` | Match pending KPay with customer |

## ၇။ MacroDroid Configuration

MacroDroid setup:

1. Create new Macro.
2. Trigger: `Notification Received`.
3. App/source: KPay or relevant banking app.
4. Action: `HTTP Request`.
5. Method: `POST`.
6. URL:

```txt
https://your-domain.com/api/kpay-webhook
```

Development/testing တွင် local tunnel URL သုံးနိုင်သည်။

Request headers:

```txt
Content-Type: application/json
```

Request body:

```json
{
  "title": "{not_title}",
  "text": "{not_text}"
}
```

MacroDroid version အလိုက် magic text variable names ကွာနိုင်သည်။ UI ထဲရှိ notification title chip နှင့် notification text/body chip ကို အသုံးပြုရန်။

## ၈။ Environment Variables

```env
DATABASE_URL="postgresql://postgres.qvanezzllbcrvmqexzoq:YOUR_DATABASE_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.qvanezzllbcrvmqexzoq:YOUR_DATABASE_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
TELEGRAM_BOT_TOKEN=""
TELEGRAM_GROUP_CHAT_ID=""
TELEGRAM_ORDER_GROUP_CHAT_ID=""
TELEGRAM_FACTORY_GROUP_CHAT_ID=""
TELEGRAM_ORDER_WEBHOOK_SECRET=""
TELEGRAM_ORDER_ADMIN_IDS=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Production deployment တွင် `NEXT_PUBLIC_APP_URL` ကို actual deployment URL အဖြစ်ပြောင်းရမည်။ Dashboard access အတွက် `APP_PIN` နှင့် `APP_SESSION_SECRET` ကို server environment တွင်သာထားရမည်။ MacroDroid webhook အတွက် `KPAY_WEBHOOK_SECRET` သီးခြားသုံးရမည်။

## ၉။ Current Implementation Status

Implemented:

- Next.js App Router project structure
- Tailwind dark dashboard UI
- Prisma schema for Customer, Ledger, CashSale, UnverifiedKpay, Order, delivery, audit, AI cache, and AutoReportRun domains
- Postgres migration SQL
- Runtime database setup guard for Vercel production
- KPay webhook endpoint
- Myanmar digit and English digit amount parser
- Telegram sendMessage helper
- Customer CRUD API baseline
- Manual ledger transaction API
- KPay matching API with database transaction
- Single-page dashboard with pending KPay cards, customer search, customer create, match modal, manual ledger form, and transaction table
- README with setup and MacroDroid guide

Verified:

- `npm install`
- `npx prisma generate`
- Production-ready Postgres schema creation
- `npm run build`
- Smoke-tested customer creation, KPay webhook parsing, and KPay matching flow

Known local note:

- Vercel production requires a real Postgres `DATABASE_URL`; local SQLite files are not persistent in serverless functions.

## ၁၀။ Telegram Report Schedule

နေ့စဉ် report သည် မနေ့က Myanmar calendar day ၏ `00:00–23:59` စာရင်းကို ဒီနေ့ Myanmar time မနက် `08:00` အနီးတွင် ပို့ရန်ဖြစ်သည်။ Vercel Cron failed invocation ကို အလိုအလျောက် retry မလုပ်နိုင်သောကြောင့် `/api/cron/daily-report` ကို 01:30 UTC (08:00 MMT) primary၊ 02:30 UTC (09:00 MMT) နှင့် 03:30 UTC (10:00 MMT) retry windows သုံးခုအဖြစ် configure လုပ်ထားသည်။ Handler သည် report-date claim/lock နှင့် bounded catch-up သုံး၍ missing/failed dates ကိုသာ ပြန်စစ်ပြီး success date ကို duplicate မပို့ပါ။ Successful Manual row ရှိလျှင် full duplicate report မပို့ဘဲ one-time status notice သာ ပို့သည်။ `Report Date` သည် ပို့သည့်နေ့မဟုတ်ဘဲ report ထဲတွင်ပါသော မနေ့ကစာရင်းနေ့ကို ဆိုလိုသည်။

## ၁၁။ Next Milestones

1. Configure `APP_PIN` and `APP_SESSION_SECRET` in Vercel and deploy the approved server-session hardening.
2. Add a reviewed, explicit database migration path for legacy schemas now that automatic table deletion is disabled.
3. Add KPay event idempotency/deduplication by provider event ID or a strong amount/time/raw-text fingerprint.
4. Add customer import from spreadsheet/CSV.
5. Add mobile-friendly Dad mode with larger tap targets and simplified matching flow.
6. Add automated end-to-end checks and production monitoring for report delivery and webhook health.
7. Keep the README and this PRD synchronized with the canonical Prisma model, API route, Telegram destination, and environment-variable names.
8. Separate future Inventory/Production Telegram planning from the current Factory Handover group, which is limited to factory-front pickup, vehicle loading, and gate-delivery preparation.
