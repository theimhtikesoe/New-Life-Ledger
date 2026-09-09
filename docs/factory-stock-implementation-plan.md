# Factory Stock Framework — Implementation Plan and Agent Handoff

**Status:** Planning approved; implementation has not started.

**Project:** New Life Ledger

**Purpose:** စက်ရုံအတွင်းရှိ ဗူးကဒ်လက်ကျန်ကို ထုတ်လုပ်မှုနှင့် ဗူးရောင်းစာရင်းများမှ စနစ်တကျ တွက်ချက်ပြသနိုင်ရန် framework ချမှတ်ခြင်း။

> **အရေးကြီးသော စီးပွားရေးဆုံးဖြတ်ချက်:** လက်ရှိတွင် မြေပြင် stock ကို မရေတွက်နိုင်သေးပါ။ ထို့ကြောင့် ပထမအဆင့်တွင် Database မှ derive လုပ်ထားသော **System-calculated Stock** ကိုသာ ပြသမည်။ ၎င်းကို Official Physical Stock အဖြစ် မသတ်မှတ်ရသေးပါ။ နောက်လတွင် မြေပြင် stock ကို တကယ်ရေတွက်ပြီး Reconciliation Adjustment ထည့်သွင်းသည့်နေ့မှစ၍ official opening stock အဖြစ် ဆက်လက်အသုံးပြုမည်။

## 1. လက်ရှိ Repository အခြေအနေ

လက်ရှိ codebase သည် Next.js 14 App Router, React, PostgreSQL, Prisma နှင့် Vercel ကို အသုံးပြုထားသည်။ ထုတ်လုပ်မှုနှင့် ရောင်းချမှု data များသည် သီးခြားနေရာများတွင် ရှိပြီးသားဖြစ်သဖြင့် stock framework ကို အဆိုပါ records များမှ safe derivation လုပ်ရမည်။

| လက်ရှိအချက်အလက် | အဓိကနေရာ | Stock အပေါ် သက်ရောက်မှု |
|---|---|---|
| ထုတ်လုပ်မှုမှတ်တမ်း | `ProductionReport` နှင့် `/api/production-reports` | ဗူးကဒ် stock တိုးစေမည့် `PRODUCTION_IN` |
| ငွေချေ/အကြွေးတိုး ဗူးစာရင်း | `Ledger.saleItems` | ဗူးကဒ် stock လျော့စေမည့် `SALE_OUT` |
| လက်ငင်းရောင်း ဗူးစာရင်း | `CashSale.saleItems` | ဗူးကဒ် stock လျော့စေမည့် `SALE_OUT` |
| ဗူးအမျိုးအစား catalog | `src/lib/production-catalog.js` | `productKey` နှင့် capacity identity အတွက် အခြေခံ |
| အဖုံး catalog | `CAP_ITEMS` နှင့် Price Settings | ပထမအဆင့် ဗူးကဒ် stock ထဲ မပေါင်းရ။ နောက်ပိုင်း `CAP_STOCK` အဖြစ် သီးခြားချဲ့နိုင်သည်။ |

လက်ရှိ production report တွင် `outputQuantity`, `outputCapacity`, `bottleType`, `category`, `reportDate`, `submissionId` စသည့် data များ ရှိသည်။ လက်ရှိ sale item တွင် `productKey`, `productName`, `capacity`, `cardCount`, `bottleCount`, `totalAmount` စသည့် data များ ရှိသည်။

## 2. မဖြစ်မနေလိုက်နာရမည့် Stock Formula

အမျိုးအစားနှင့် capacity တစ်ခုချင်းစီအတွက် လက်ကျန်ကို အောက်ပါ formula ဖြင့်တွက်ရမည်။

```text
System Stock
= Opening Balance
+ Production In
- Sale Out
+ Adjustment In
- Adjustment Out
```

Physical count မရသေးသော ပထမအဆင့်တွင် `Opening Balance` ကို သီးခြား physical opening entry အဖြစ် မသတ်မှတ်ရသေးပါ။ အဟောင်း Database records များကို rebuild လုပ်သောအခါ အောက်ပါအတိုင်း ပြသရမည်။

```text
Database-derived Stock
= All historical Production In
- All historical Bottle Sale Out
+/- Existing Stock Adjustments, if any
```

Database-derived Stock သည် မြေပြင်တွင် တကယ်ရှိသော stock နှင့် ကွာနိုင်သည်။ ထို့ကြောင့် UI တွင် ထိုအချက်ကို အမြဲရှင်းလင်းစွာ ဖော်ပြရမည်။

## 3. Product Identity နှင့် Normalization

Stock ကို `productName` တစ်ခုတည်းဖြင့် မခွဲရ။ အမျိုးအစားတူသော်လည်း capacity မတူသောဗူးများကို သီးခြား stock line အဖြစ်ထားရမည်။

အကြံပြုထားသော identity သည်—

```text
productKey = normalizedBottleType + "::" + normalizedCapacity
```

ဥပမာ—

| Stock Identity | အဓိပ္ပာယ် |
|---|---|
| `0.3 ဖြူ::100` | 0.3 ဖြူ၊ တစ်ကဒ် 100 ဆံ့ |
| `0.3 ဖြူ::200` | 0.3 ဖြူ၊ တစ်ကဒ် 200 ဆံ့ |
| `0.3 ဖြူ::400` | 0.3 ဖြူ၊ တစ်ကဒ် 400 ဆံ့ |
| `0.6 ပြာ::250` | 0.6 ပြာ၊ တစ်ကဒ် 250 ဆံ့ |

Normalization function သည် production data ၏ `bottleType` နှင့် `outputCapacity`၊ sale data ၏ `productKey` နှင့် `capacity` တို့ကို တစ်မျိုးတည်းသော canonical key သို့ ပြောင်းပေးရမည်။ အဟောင်း malformed records များအတွက် fallback key ထုတ်ပေးရမည်။ မသေချာသော record ကို မပျောက်စေရဘဲ `UNMATCHED` သို့မဟုတ် warning အဖြစ် ထားရမည်။

## 4. အကြံပြုထားသော Data Model

Stock balance ဂဏန်းတစ်ခုတည်းကို တိုက်ရိုက် overwrite မလုပ်ရ။ Audit trail မပျောက်စေရန် immutable movement ledger ပုံစံကို အသုံးပြုရမည်။

အကြံပြုထားသော Prisma model သည် အောက်ပါအတိုင်း ဖြစ်ရမည်။ Field အမည်များသည် implementation အချိန်တွင် လက်ရှိ project naming convention နှင့် ကိုက်ညီအောင် ပြင်နိုင်သည်။

```prisma
model FactoryStockMovement {
  id             String   @id @default(uuid()) @db.Uuid
  movementDate   String
  movementType   String   // OPENING_BALANCE, PRODUCTION_IN, SALE_OUT, ADJUSTMENT_IN, ADJUSTMENT_OUT, REVERSAL
  stockType      String   @default("BOTTLE") // BOTTLE initially; CAP later
  productKey     String
  productName    String
  capacity       Int      @default(0)
  quantityCards  Int
  quantityBottles Int     @default(0)
  sourceType     String?
  sourceId       String?
  sourceVersion  String?
  reason         String?
  note           String?
  actorName      String
  createdAt      DateTime @default(now())

  @@index([movementDate])
  @@index([productKey])
  @@index([movementType])
  @@index([sourceType, sourceId])
}
```

Implementation တွင် source record တစ်ခုမှ movement duplicate မဖြစ်ရန် unique idempotency strategy လိုအပ်သည်။ `sourceType + sourceId + productKey + movementType + sourceVersion` ကို အသုံးပြုနိုင်သည်။ Database migration သည် add-only ဖြစ်ရမည်။ Existing tables, columns နှင့် data များကို မဖျက်ရ။

`sourceId` သည် UUID မဟုတ်သော `ProductionReport.submissionId` ကဲ့သို့ value များကိုလည်း လက်ခံနိုင်ရမည်။ ထို့ကြောင့် `sourceId` ကို UUID type မသတ်မှတ်ဘဲ String ထားရမည်။

## 5. Movement Rules

### 5.1 Production In

Production report တစ်ခု၏ bottle row တစ်ခုချင်းစီအတွက်—

```text
quantityCards = outputQuantity
quantityBottles = outputQuantity × outputCapacity
movementType = PRODUCTION_IN
```

`category === "tube"` record များကို ဗူးကဒ် stock ထဲ မထည့်ရ။ Tube data သည် လက်ရှိ feature ၏ scope မဟုတ်သေးပါ။ `outputCapacity` မရနိုင်သော row ကို stock movement မဖန်တီးဘဲ warning အဖြစ် သိမ်းထားရမည်။

Production report အသစ်တင်သောအခါ corresponding movement ဖန်တီးရမည်။ Production report ပြင်သောအခါ အဟောင်း movement ကို hard delete မလုပ်ရ။ အဟောင်း movement ကို `REVERSAL` ဖြင့် ပြန်လှန်ပြီး အသစ် movement ထည့်ရမည်။

ဥပမာ—

```text
အဟောင်း report: +50 ကဒ်
ပြင်ပြီး report: +60 ကဒ်

PRODUCTION_IN       +50
REVERSAL            -50
PRODUCTION_IN       +60
Net change          +60
```

### 5.2 Sale Out

အောက်ပါ record များတွင် bottle sale item ပါလျှင် `SALE_OUT` ဖန်တီးရမည်။

- `Ledger` တွင် `saleItems` ပါသော `DEBIT` transaction
- `Ledger` တွင် `saleItems` ပါသော `CREDIT` debt increase transaction
- `CashSale` တွင် `saleItems` ပါသော cash sale

Sale item ၏ `bottleCount` နှင့် `cardCount` ကို canonical stock identity အတိုင်း အသုံးပြုရမည်။ `categoryKey === "CAP"` သို့မဟုတ် `productType === "cap"` ဖြစ်သော အဖုံး line များကို ဗူး stock ထဲ မလျော့ရ။

Sale record ပြင်ခြင်း သို့မဟုတ် ဖျက်ခြင်းသည် အဟောင်း sale movement ကို reverse လုပ်ပြီး အသစ် sale movement ပြန်ဖန်တီးရမည်။ Save ကို နှစ်ခါနှိပ်ခြင်း၊ refresh လုပ်ခြင်း၊ retry ဖြစ်ခြင်းတို့ကြောင့် stock နှစ်ခါမလျော့ရ။

### 5.3 Adjustment

Physical count ပြီးနောက်သာ manual adjustment ထည့်ရမည်။ Adjustment သည် source record မရှိသော arbitrary edit မဖြစ်ရ။ အနည်းဆုံး အောက်ပါ data များလိုအပ်သည်။

| Field | လိုအပ်ချက် |
|---|---|
| Adjustment date | စာရင်းညှိသည့်ရက် |
| Product identity | အမျိုးအစားနှင့် capacity |
| System quantity | ညှိမည့်အချိန်တွင် system ကတွက်ထားသော quantity |
| Physical quantity | မြေပြင်တွင် တကယ်ရေထားသော quantity |
| Difference | Physical − System |
| Reason | ကွာဟချက်အကြောင်းပြချက် |
| Actor | ပြင်ဆင်သူ |

System stock ထက် physical stock ပိုများလျှင် `ADJUSTMENT_IN`၊ လျော့လျှင် `ADJUSTMENT_OUT` ဖန်တီးရမည်။ Negative stock ကို ယခုအဆင့်တွင် save block မလုပ်သေးဘဲ အနီရောင် warning ပြသရမည်။

## 6. Existing Data Rebuild

Implementation အစတွင် existing database records အားလုံးမှ movement ကို rebuild လုပ်ရမည်။ Rebuild သည် idempotent ဖြစ်ရမည်။ ထပ်မံ run လုပ်သော်လည်း duplicate movement မဖန်တီးရ။

Rebuild order သည် အောက်ပါအတိုင်း ဖြစ်ရမည်။

1. ProductionReport bottle rows များကို date/order အလိုက်ဖတ်ပြီး `PRODUCTION_IN` ဖန်တီးရမည်။
2. Ledger saleItems များကို date/order အလိုက်ဖတ်ပြီး bottle lines အတွက် `SALE_OUT` ဖန်တီးရမည်။
3. CashSale saleItems များကို date/order အလိုက်ဖတ်ပြီး bottle lines အတွက် `SALE_OUT` ဖန်တီးရမည်။
4. Cap lines များကို bottle stock rebuild ထဲမှ ဖယ်ထားရမည်။
5. Unmatched item များကို error အဖြစ် ဖျက်မပစ်ဘဲ report ပြန်ထုတ်နိုင်အောင် သိမ်းထားရမည်။
6. Rebuild summary တွင် ဖန်တီးပြီးသော row count၊ skipped row count၊ unmatched row count နှင့် total in/out quantity များ ပြရမည်။

Rebuild ကို destructive reset အဖြစ် မလုပ်ရ။ ရှိပြီးသား Ledger, CashSale နှင့် ProductionReport records များကို မပြင်ရ၊ မဖျက်ရ။

## 7. User Interface Plan

### 7.1 Factory Stock Page

Route အကြံပြုချက်မှာ `/factory-stock` ဖြစ်သည်။ ပထမ version သည် read-only ဖြစ်ရမည်။

အဓိက table columns များမှာ—

| Column | အကြောင်းအရာ |
|---|---|
| ဗူးအမျိုးအစား | Product name |
| ဆံ့ | Bottles per card |
| Opening / Historical In | Production total |
| Sale Out | Bottle sales total |
| Adjustment | Adjustment total |
| လက်ကျန် | Current system balance |
| Status | Normal, Low, Negative, Unmatched |

Header တွင် အောက်ပါ notice မပါမဖြစ် ထည့်ရမည်။

> ဤလက်ကျန်သည် Database မှတွက်ထားသော System Stock ဖြစ်ပါသည်။ မြေပြင်တွင် တကယ်ရှိသော stock နှင့် ကွာနိုင်ပါသည်။ နောက်လ physical count ပြီးပါက စာရင်းညှိပါမည်။

Filter များတွင် date range, product category, capacity, non-zero only, negative only နှင့် unmatched only ပါသင့်သည်။ Mobile view တွင် card layout သို့ ပြောင်းရမည်။

### 7.2 Stock Detail

Product row ကိုနှိပ်လျှင် movement history ပြရမည်။ History တွင် date, movement type, quantity, source link/label, reason နှင့် actor ပါရမည်။

```text
0.3 ဖြူ / 200 ဆံ့

Production In       +50 ကဒ်
Production In       +30 ကဒ်
Sale Out            -10 ကဒ်
Sale Out            -20 ကဒ်
--------------------------------
Current Balance      50 ကဒ်
```

### 7.3 Reconciliation UI

ပထမ release တွင် read-only stock page ကို ဦးစားပေးရမည်။ Physical count မရသေးသဖြင့် adjustment form ကို မဖွင့်သေးလည်းရသည်။ နောက်လ reconciliation မတိုင်မီ adjustment form ထည့်ရမည်။ Form သည် system quantity ကို server မှ lock/read-only ပြပြီး physical quantity ကိုသာ user ထည့်ခွင့်ပေးရမည်။

## 8. API Plan

အကြံပြုထားသော endpoint များမှာ—

| Endpoint | ရည်ရွယ်ချက် |
|---|---|
| `GET /api/factory-stock` | Product တစ်ခုချင်း stock summary |
| `GET /api/factory-stock?productKey=...` | Product movement detail |
| `POST /api/factory-stock/rebuild` | Existing data မှ idempotent rebuild; admin-only ဖြစ်ရမည် |
| `POST /api/factory-stock/adjustments` | Physical reconciliation adjustment |
| `GET /api/factory-stock/reconciliation` | System နှင့် physical count ကွာဟချက် |

API response တွင် `asOfDate`, `calculationMode`, `isPhysicalVerified`, `warnings` ပါရမည်။ ပထမအဆင့် response တွင် `calculationMode: "DATABASE_DERIVED"` နှင့် `isPhysicalVerified: false` ပြရမည်။

## 9. Data Safety နှင့် Permission Rules

Stock movement များသည် audit trail အဖြစ် သတ်မှတ်ရမည်။ Movement record ကို user-facing delete button ဖြင့် ဖျက်ခွင့်မပေးရ။ မှားယွင်းမှုကို reversal movement ဖြင့်သာ ပြင်ရမည်။

Rebuild နှင့် adjustment endpoint များသည် ordinary user များအတွက် မဖွင့်ရ။ Actor name, timestamp, reason နှင့် source record ကို audit log ထဲတွင် ထည့်ရမည်။ Add-only migration ကိုသာ သုံးရမည်။ Database schema မသေချာသော deployment တွင် destructive migration မလုပ်ရ။

Negative balance ဖြစ်လျှင် transaction save ကို ပထမ version တွင် မတားသေးရ။ Dashboard နှင့် Factory Stock Page တွင် warning ပြရမည်။ Physical count ပြီး၍ official opening သတ်မှတ်ပြီးနောက် approval rule ထည့်နိုင်သည်။

## 10. Implementation Phases

### Phase 1 — Database and normalization foundation

1. `FactoryStockMovement` model နှင့် additive database setup ထည့်ရန်။
2. Product normalization helper တည်ဆောက်ရန်။
3. Movement type constants ထည့်ရန်။
4. Idempotency key strategy နှင့် source metadata သတ်မှတ်ရန်။
5. Unit tests ရေးရန်။

### Phase 2 — Existing data rebuild

1. Production rows မှ movement builder ရေးရန်။
2. Ledger/CashSale saleItems မှ movement builder ရေးရန်။
3. Cap lines နှင့် unmatched lines ကို ဖယ်/flag လုပ်ရန်။
4. Admin-only rebuild API ရေးရန်။
5. Rebuild summary နှင့် audit log ထည့်ရန်။

### Phase 3 — Automatic movement synchronization

1. Production create path တွင် `PRODUCTION_IN` ချိတ်ရန်။
2. Production update path တွင် reversal plus replacement ချိတ်ရန်။
3. Production delete path တွင် reversal ချိတ်ရန်။
4. Ledger/CashSale create path တွင် `SALE_OUT` ချိတ်ရန်။
5. Sale update/delete path တွင် reversal plus replacement ချိတ်ရန်။
6. Duplicate movement integration tests ရေးရန်။

### Phase 4 — Read-only Factory Stock UI

1. `/factory-stock` page တည်ဆောက်ရန်။
2. Summary table နှင့် mobile cards ပြရန်။
3. Product detail movement view ထည့်ရန်။
4. System-derived warning ပြရန်။
5. Negative/unmatched status ပြရန်။

### Phase 5 — Physical reconciliation

1. Physical count form ထည့်ရန်။
2. System quantity ကို server-side snapshot အဖြစ်သိမ်းရန်။
3. Difference ကို adjustment movement အဖြစ် ဖန်တီးရန်။
4. Reconciliation report နှင့် approval history ထည့်ရန်။
5. Official verified opening status ထည့်ရန်။

## 11. Acceptance Criteria

Implementation ကို complete ဟု သတ်မှတ်ရန် အောက်ပါအချက်များအားလုံး ပြည့်မီရမည်။

- Product name တူပြီး capacity မတူသော stock များ မရောရ။
- Production report တင်လျှင် သက်ဆိုင်ရာ stock တိုးရ။
- Bottle sale item သိမ်းလျှင် သက်ဆိုင်ရာ stock လျော့ရ။
- Cap sale item များကို bottle stock ထဲ မရောရ။
- Production/sale edit သည် history မဖျက်ဘဲ reversal ဖြင့် balance မှန်ရ။
- Retry, refresh, double-click ကြောင့် duplicate movement မဖြစ်ရ။
- Existing rebuild ကို နှစ်ကြိမ် run လုပ်လည်း total မပြောင်းရ။
- Unmatched record မပျောက်ရ။
- Negative stock ကို ရှင်းလင်းစွာ warning ပြရ။
- Physical count မရသေးသောအချိန်တွင် UI သည် stock ကို official verified stock ဟု မပြောရ။
- နောက်လ physical count ပြီးနောက် adjustment ထည့်နိုင်ရ။
- Audit log တွင် actor, reason, source နှင့် timestamp ပါရ။
- Production build နှင့် relevant tests အောင်မြင်ရ။
- GitHub `main` branch သို့ push မလုပ်မီ `git diff --check` အောင်မြင်ရ။

## 12. Next Manus Agent Handoff Instructions

နောက် Manus agent သည် implementation မစမီ ဤ document ကို အရင်ဖတ်ရမည်။ ထို့နောက် အောက်ပါ repository files များကို ပြန်စစ်ရမည်။

1. `prisma/schema.prisma`
2. `src/app/api/production-reports/route.js`
3. `src/app/api/daily-bottle-sales/route.js`
4. `src/app/api/customers/[id]/transactions/route.js`
5. `src/app/api/customers/[id]/cash-sales/route.js`
6. `src/lib/production-catalog.js`
7. `src/lib/database.js`
8. `src/components/Dashboard.jsx`

အောက်ပါအချက်များကို မပြောင်းမီ user intent နှင့် ဤ plan ကို ထပ်စစ်ရမည်။

- Historical Ledger/CashSale/ProductionReport data ကို မဖျက်ရ။
- Existing sale and production semantics ကို မပြောင်းရ။
- Cap stock ကို bottle stock နှင့် မရောရ။
- Physical stock မရသေးသရွေ့ official opening balance ဟု မသတ်မှတ်ရ။
- Reversal နှင့် idempotency မရှိဘဲ direct balance mutation မလုပ်ရ။
- Schema migration သည် add-only ဖြစ်ရမည်။

အကောင်းဆုံး implementation order သည် Phase 1 → Phase 2 → Phase 3 → Phase 4 ဖြစ်သည်။ Phase 5 ကို user က မြေပြင် stock ရေတွက်ရန် အဆင်သင့်ဖြစ်ကြောင်း ပြောမှ စတင်ရမည်။

## 13. Current Decision Summary

လက်ရှိတွင် project အတွက် ဆုံးဖြတ်ထားသော အဓိကမူများမှာ—

- Factory stock ကို movement ledger ဖြင့် တည်ဆောက်မည်။
- Production report သည် stock in ဖြစ်မည်။
- Bottle sale item သည် stock out ဖြစ်မည်။
- Cap sale ကို သီးခြား stock type အဖြစ် နောက်ပိုင်းတွင် ချဲ့မည်။
- ပထမအဆင့်သည် database-derived, read-only stock ဖြစ်မည်။
- အဟောင်းစာရင်းကွာဟချက်ကို ဖျက်ပြင်မည်မဟုတ်။
- နောက်လ physical count ပြီးမှ reconciliation adjustment ထည့်မည်။
- Negative stock ကို အစပိုင်းတွင် block မလုပ်ဘဲ warning ပြမည်။
- Movement history နှင့် audit trail ကို မဖျက်ရ။

## References

[1]: ../prisma/schema.prisma "New Life Ledger Prisma database schema"

[2]: ../src/app/api/production-reports/route.js "Production report API route"

[3]: ../src/app/api/daily-bottle-sales/route.js "Daily bottle sales aggregation API route"

[4]: ../src/lib/production-catalog.js "Bottle, cap, and production catalog definitions"

[5]: ../src/lib/database.js "Additive database setup and schema readiness helpers"
