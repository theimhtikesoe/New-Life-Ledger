# Production, Sales, Cost နှင့် Customer Pricing ဆက်လုပ်ရန် Roadmap

**Project:** New Life Ledger  
**Documentation owner:** Manus AI  
**ရည်ရွယ်ချက်:** လက်ရှိ Production မှတ်တမ်း၊ Customer ငွေရှင်းတမ်း၊ Cost စျေးနှုန်းနှင့် နောက်ပိုင်း Dashboard KPI များကို တစ်ခုနှင့်တစ်ခု ချိတ်ဆက်ပြီး ဖြည့်ရလွယ်၊ ပြန်တွက်ရလွယ်၊ မှတ်တမ်းအဟောင်းမပျက်သည့် စနစ်တစ်ခုတည်ဆောက်ရန်။

## ၁။ အခုထိ အတည်ပြုထားသော လုပ်ငန်းလိုအပ်ချက်များ

### ၁.၁ Production Page တွင် မှတ်တမ်းတင်ရမည့် field များ

စာအုပ်ထဲရှိ production record အတိုင်း အောက်ပါ field များကို အဓိကထားရမည်။ Form အစဉ်မှာ `စက် → Date → ပူးတွဲဆင်းသူများ → ဗူးအမျိုးအစားနှင့် ဗူးကဒ် → ဗူးပျက် → Tube ပျက် → Tube အရေအတွက်` ဖြစ်ရမည်။

| အစဉ် | Field | အဓိပ္ပါယ် |
|---:|---|---|
| 1 | စက် | ထုတ်လုပ်သည့် စက်ကို ရွေးရန် |
| 2 | Date | ထုတ်လုပ်သည့် ရက်စွဲ |
| 3 | ပူးတွဲဆင်းသူများ | ထိုနေ့တွင် အတူဆင်းသည့် Worker များကို ကြိုတင်သိမ်းထားသော ခလုတ်များမှ နှိပ်ရွေးရန် |
| 4 | ဗူးအမျိုးအစားနှင့် ဗူးကဒ် | Production catalog ထဲရှိ item နှင့် size/capacity အလိုက် card အရေအတွက် |
| 5 | ဗူးပျက် | ဗူးမကောင်းဖြစ်ပြီး ပျက်သွားသော ဗူးအရေအတွက် |
| 6 | Tube ပျက် | ဗူးမဖြစ်ဘဲ ပျက်သွားသော Tube အရေအတွက် |
| 7 | Tube အရေအတွက် | ဗူးထွက်လာရန် အသုံးပြုခဲ့သော Tube စုစုပေါင်းအရေအတွက် |

Worker များကို `ProductionWorker` table ထဲတွင် သိမ်းထားပြီး၊ Production record ထဲတွင် ထိုနေ့ရွေးထားသော Worker အမည်များကို `involvedWorkers` data အဖြစ် snapshot သိမ်းထားရမည်။ Worker အသစ်ထည့်ပြီးသည်နှင့် ခလုတ်အဖြစ် ချက်ချင်းပေါ်ရမည်။ ခလုတ်ကို တစ်ချက်နှိပ်လျှင် ရွေး/မရွေး ပြောင်းရမည်။ ကြာကြာဖိထားလျှင် shared Worker list မှ ဖျက်နိုင်ရမည်။

### ၁.၂ ငွေရှင်းတမ်းတွင် လိုချင်သော ဗူးရောင်းစာရင်း

Customer တစ်ယောက်ချင်းစီ၏ `ငွေချေ၊ အကြွေးတိုး၊ လက်ငင်းရောင်း` Form သုံးမျိုးလုံးတွင် Note တစ်ခုတည်းထဲ စာရိုက်ခိုင်းမည့်အစား ဗူးစာရင်းကို structured data အဖြစ် ထည့်ရမည်။ Note ကို အခြားမှတ်ချက်အတွက် optional အဖြစ် ဆက်ထားရမည်။

Form ထဲတွင် product list အားလုံးကို တန်းပြထားလျှင် Mobile နေရာကျဉ်းပြီး ရှုပ်နိုင်သောကြောင့် အကြံပြုထားသော UI မှာ `ဗူးထည့်ရန် +` ခလုတ်တစ်ခုထားပြီး Popup/Bottom Sheet ထဲမှ product ကို ရွေးခြင်းဖြစ်သည်။ ရွေးထားပြီးသော item များကို Form ထဲတွင် အကျဉ်းချုပ်အဖြစ် ပြရမည်။ ဥပမာ `0.3 ဖြူ · 100 ဆံ့ × 10 ကဒ် = 1,000 ဗူး` ဖြစ်သည်။

### ၁.၃ ပုံမှန်တွက်ချက်ရမည့် data များ

| Data | ဥပမာ |
|---|---:|
| ဗူးအမျိုးအစား | `.3 ဖြူ` |
| ဆံ့ / ဗူးတစ်ကဒ်တွင် ပါဝင်သည့်အရေအတွက် | `100` |
| ကဒ် | `10` |
| ဗူးပေါင်း | `100 × 10 = 1,000` ဗူး |
| ဗူးတစ်လုံးစျေး | `235 Ks` |
| ကဒ်တစ်ကဒ်စျေး | `235 × 100 = 23,500 Ks` |
| သင့်ငွေ | `235 × 1,000 = 235,000 Ks` |

အဓိက formula များမှာ အောက်ပါအတိုင်းဖြစ်သည်။

```text
ဗူးပေါင်း = ဆံ့ × ကဒ်
ကဒ်တစ်ကဒ်စျေး = ဗူးတစ်လုံးစျေး × ဆံ့
သင့်ငွေ = ဗူးတစ်လုံးစျေး × ဗူးပေါင်း
             = ကဒ်တစ်ကဒ်စျေး × ကဒ်
```

`သင့်ငွေ` ကို User က လက်ဖြင့် ပြန်တွက်စရာမလိုဘဲ product line များ၏ သင့်ငွေစုစုပေါင်းအဖြစ် အလိုအလျောက်ပြရမည်။ Product line များစွာရှိလျှင် line တစ်ခုချင်းစီ၏ total ကိုပေါင်းရမည်။

## ၂။ Cost Page ၏ အလုပ်လုပ်ပုံ

Cost Page သည် Production Page ထဲက catalog ကို အသစ်ပြန်မရေးဘဲ `src/lib/production-catalog.js` ထဲရှိ `BOTTLE_GROUPS` နှင့် `BOTTLE_ITEMS` ကို ပြန်လည်အသုံးပြုရမည်။ ထို့ကြောင့် Production တွင် item အသစ်/အမျိုးအစားပြောင်းလဲမှုရှိလျှင် Cost Page တွင်လည်း တစ်ပြိုင်နက် catalog ကို ပြန်ရနိုင်မည်။

Cost Page တွင် စျေးသတ်မှတ်နည်းနှစ်မျိုးရှိရမည်။

| စျေးသတ်မှတ်နည်း | အသုံးပြုရမည့်အခြေအနေ | ဦးစားပေး |
|---|---|---:|
| Category default price | Category တစ်ခုထဲရှိ item များအတွက် ပုံမှန်စျေးတူလျှင် | ဒုတိယ |
| Item override price | Category ထဲမှ item တစ်ခုက သီးခြားစျေးကွာလျှင် | ပထမ |

ဥပမာ `.3 ဖြူ` Category တွင် `235 Ks/ဗူး` သတ်မှတ်ထားပြီး `.3 ဖြူ 200 ဆံ့` ကို `240 Ks/ဗူး` သီးခြားထားနိုင်ရမည်။ Item override ရှိသောအခါ Item စျေးကို သုံးပြီး override မရှိသော item များသည် Category default စျေးကို အသုံးပြုရမည်။

### ၂.၁ Date-based price rule

Cost ကို နေ့စဉ်ပြောင်းနိုင်သောကြောင့် စျေးနှုန်းတိုင်းတွင် `priceDate` ပါရမည်။ ရွေးထားသော ရက်စွဲတွင် သတ်မှတ်ချက်ရှိလျှင် ထိုနေ့စျေးကို သုံးမည်။ ထိုနေ့တွင် မသတ်မှတ်ထားသေးလျှင် အဲဒီနေ့မတိုင်မီ နောက်ဆုံးသတ်မှတ်ထားသော စျေးကို fallback အဖြစ် သုံးနိုင်မည်။ User သည် နေ့သစ်တစ်ရက်အတွက် Category စျေးကို ပြန်ရိုက်ရုံဖြင့် စျေးအသစ်ကို စတင်နိုင်ရမည်။

### ၂.၂ Cost Page UI

Cost Page တွင် အောက်ပါ section များ ပါရမည်။

1. **Date ရွေးရန်** — မည်သည့်နေ့အတွက် စျေးသတ်မှတ်နေသည်ကို ရွေးရန်။
2. **Category အလိုက် အခြေခံစျေး** — Category တစ်ခုချင်းစီအတွက် ဗူးတစ်လုံးစျေးကို တစ်ကွက်စီထည့်ရန်။
3. **Item တစ်ခုချင်းစီအလိုက် စျေးပြင်ရန်** — Category ထဲရှိ item များကို ထုတ်ပြပြီး လိုအပ်သော item သာ override ထည့်ရန်။
4. **ကဒ်တစ်ကဒ်စျေး preview** — `ဗူးတစ်လုံးစျေး × ဆံ့` ဖြင့် အလိုအလျောက်ပြရန်။
5. **Category သုံးရန်** — Item override ကို ဖျက်ပြီး Category default ပြန်သုံးရန်။
6. **သိမ်းမည်** — Category နှင့် Item စျေးနှုန်းများကို တစ်ကြိမ်တည်းသိမ်းရန်။

လက်ရှိ code တွင် `PriceSetting` model၊ migration နှင့် `/api/price-settings` API ၏ အခြေခံအပိုင်းများကို စတင်ထားပြီးဖြစ်သည်။ Cost Page route ကိုလည်း စတင်ဖန်တီးထားပြီး၊ နောက်ထပ် database migration၊ Settings navigation နှင့် form ချိတ်ဆက်မှုကို ဆက်လုပ်ရမည်။

## ၃။ Customer တစ်ဦးချင်းစီအလိုက် စျေးကွာခြားမှု

Cost Page တွင် သတ်မှတ်သောစျေးသည် **ပုံမှန်အခြေခံစျေး** ဖြစ်သည်။ Customer တစ်ယောက်ချင်းစီတွင် စျေးလျှော့ပေးခြင်း၊ အမြဲတမ်းမတူသော စျေးပြောင်းခြင်းရှိနိုင်သောကြောင့် ငွေရှင်းတမ်းတွင် product line တစ်ခုကို ရွေးပြီး `Customer စျေး/ဗူး` ကို လွတ်လပ်စွာပြင်နိုင်ရမည်။

စျေးတွက် precedence ကို အောက်ပါအတိုင်းထားရမည်။

```text
Customer transaction price override
        ↓ မရှိလျှင်
Item override price
        ↓ မရှိလျှင်
Category default price
        ↓ မရှိလျှင်
ထိုနေ့မတိုင်မီ နောက်ဆုံးသတ်မှတ်ထားသော price
```

Customer စျေးကို Cost Page ထဲတွင် Customer အားလုံးအတွက် များပြားစွာကြိုထည့်ထားရန် မလိုသေးပါ။ အကြောင်းမှာ စျေးများသည် အမြဲပြောင်းနိုင်ပြီး Customer တစ်ဦးချင်းစီကို transaction ဖြစ်သည့်အချိန်တွင် ပြန်ညှိရခြင်းက ပိုလွယ်ကူသောကြောင့်ဖြစ်သည်။ နောက်ပိုင်း Customer တစ်ဦး၏ default စျေးကို ကြိုသတ်မှတ်ရန်လိုလာလျှင် သီးခြား Customer Price Override table/page ထပ်တိုးနိုင်သည်။

## ၄။ Transaction တွင် သိမ်းရမည့် Sale Item Snapshot

ရောင်းချပြီးနောက် Cost Page ကို ပြန်ပြင်သွားလျှင် အရင် transaction ၏ သင့်ငွေ မပြောင်းသင့်ပါ။ ထို့ကြောင့် transaction ထဲတွင် ထိုအချိန်က အသုံးပြုထားသော စျေးနှုန်းနှင့် တွက်ချက်ပြီးသား values များကို snapshot အဖြစ်သိမ်းရမည်။

```json
{
  "productKey": "0.3 ဖြူ::100",
  "productName": "0.3 ဖြူ",
  "categoryKey": "03-white",
  "capacity": 100,
  "cardCount": 10,
  "bottleCount": 1000,
  "basePricePerBottle": 235,
  "customerPricePerBottle": 235,
  "priceSource": "CATEGORY",
  "pricePerCard": 23500,
  "totalAmount": 235000,
  "unit": "ဗူး"
}
```

Customer အတွက် စျေးလျှော့ထားပါက `basePricePerBottle` နှင့် `customerPricePerBottle` နှစ်ခုလုံးကို သိမ်းရမည်။ `priceSource` ကို `CATEGORY`, `ITEM`, သို့မဟုတ် `CUSTOMER_OVERRIDE` အဖြစ် သိမ်းထားရမည်။ ဤနည်းဖြင့် နောက်ပိုင်း “ဘာကြောင့် ဒီသင့်ငွေ ဖြစ်လာသလဲ” ကို ပြန်ရှင်းနိုင်မည်။

လက်ရှိ schema တွင် `Ledger.saleItems` နှင့် `CashSale.saleItems` JSON field များကို ထည့်ရန် စတင်ထားပြီးဖြစ်သည်။ အဲဒီ field များကို API POST payload၊ transaction history၊ backup/restore နှင့် delete/edit flow များထဲတွင် အပြည့်အဝ ချိတ်ဆက်ရန် ကျန်ရှိသည်။

## ၅။ ငွေချေ၊ အကြွေးတိုး၊ လက်ငင်းရောင်း Form အတွက် အကြံပြု UI

Form ထဲမှာ product selector ကို inline အရှည်ကြီးမထားဘဲ `ဗူးစာရင်းထည့်ရန် +` ခလုတ်တစ်ခုထားရမည်။ Popup ထဲမှာ Category filter၊ item ရွေးချယ်မှု၊ ကဒ်အရေအတွက်၊ ဗူးပေါင်း၊ Cost စျေးနှုန်း၊ Customer စျေးနှုန်းနှင့် သင့်ငွေ preview ကို ပြရမည်။

| Form အတွင်း | Popup အတွင်း |
|---|---|
| ရွေးထားသော item အကျဉ်းချုပ် | Category filter |
| စုစုပေါင်းဗူး | Item selector |
| စုစုပေါင်းသင့်ငွေ | ကဒ်အရေအတွက် |
| Note (optional) | Customer စျေး/ဗူး ပြင်ရန် |
| Payment split | ကဒ်တစ်ကဒ်စျေး၊ သင့်ငွေ preview |

Cash Sale တွင် `Cash၊ KPay၊ Bank၊ Wave၊ Special` payment split ကို ဆက်ထားရမည်။ Payment split စုစုပေါင်းသည် product lines မှတွက်လာသော `သင့်ငွေ` နှင့် ကိုက်ညီရမည်။ မကိုက်လျှင် စာရင်းသိမ်းခွင့်မပေးဘဲ ကွာခြားချက်ကို ပြရမည်။ ငွေချေ/အကြွေးတိုး Form တွင်လည်း product line amount ကို amount field အဖြစ် အလိုအလျောက်သုံးနိုင်ရမည်။ လိုအပ်လျှင် manual adjustment/deduction ကို သီးခြားထည့်နိုင်သော်လည်း စာရင်းအဓိပ္ပါယ်မရှုပ်စေရန် line total နှင့် adjustment ကို ခွဲပြရမည်။

## ၆။ Dashboard KPI နှင့် နောက်ပိုင်း Report

Daily Sales KPI အသစ်တွင် ငွေပမာဏသာမက ဗူးရောင်းစာရင်းကိုပါ ထုတ်ရမည်။ Date filter အလိုက် saleItems snapshot များကို စုစည်းပြီး အောက်ပါ output များကို ပြရမည်။

| KPI | တွက်ချက်ပုံ |
|---|---|
| ယနေ့ရောင်းပြီး ဗူးပေါင်း | saleItems.bottleCount စုစုပေါင်း |
| Item အလိုက် ဗူးရောင်းစာရင်း | productKey အလိုက် bottleCount ပေါင်းခြင်း |
| Category အလိုက် ဗူးရောင်းစာရင်း | categoryKey အလိုက် bottleCount ပေါင်းခြင်း |
| ယနေ့ဗူးရောင်းသင့်ငွေ | saleItems.totalAmount စုစုပေါင်း |
| Item အလိုက် ပျမ်းမျှစျေး | totalAmount / bottleCount |
| Retail/Wholesale ခွဲခြားမှု | transaction ၏ saleType အတိုင်း group လုပ်ခြင်း |

Production KPI နှင့် Sales KPI ကို မရောစေရန် Production သည် ထုတ်လုပ်သည့်အရေအတွက်၊ Sales သည် Customer ထံ ရောင်းပြီးသည့်အရေအတွက်အဖြစ် သီးခြားထားရမည်။

## ၇။ ဆက်လုပ်ရန် အဆင့်လိုက် Checklist

### အဆင့် A — Cost foundation ပြီးစီးအောင်လုပ်ရန်

- [ ] `PriceSetting` migration ကို production database တွင် run နိုင်အောင် အတည်ပြုရန်။
- [ ] `database.js` readiness/auto-setup တွင် PriceSetting table နှင့် saleItems columns ကို အတည်ပြုရန်။
- [ ] Settings panel ထဲတွင် **“စျေးနှုန်းသတ်မှတ်”** navigation link ထည့်ရန်။
- [ ] Cost Page ကို production catalog မှ category/item များ ပြန်ဆွဲယူကြောင်း စမ်းသပ်ရန်။
- [ ] Category default၊ Item override၊ Date fallback နှင့် Category ပြန်သုံးရန် behavior စမ်းသပ်ရန်။
- [ ] 235 Ks၊ 100 ဆံ့၊ 10 ကဒ်ဖြင့် 235,000 Ks ထွက်ကြောင်း automated test ထည့်ရန်။

### အဆင့် B — Sales product selector ပြီးစီးအောင်လုပ်ရန်

- [ ] Dashboard မှာ `saleItems` state နှင့် `ဗူးထည့်ရန် +` Popup တည်ဆောက်ရန်။
- [ ] Selected Customer၊ Form Date နှင့် Sale Type အလိုက် price API ကို ခေါ်ရန်။
- [ ] Category စျေး/Item စျေးကို ပြရန်။
- [ ] Customer စျေး/ဗူးကို transaction တစ်ခုချင်းစီတွင် ပြန်ညှိနိုင်ရန်။
- [ ] ကဒ် → ဗူးပေါင်း → ကဒ်တစ်ကဒ်စျေး → သင့်ငွေ formula ကို live ပြရန်။
- [ ] Product line အများကြီးထည့်၊ ပြင်၊ ဖျက်နိုင်ရန်။
- [ ] Product lines ရှိလျှင် total amount ကို အလိုအလျောက်ဖြည့်ရန်။
- [ ] Product lines မရှိလျှင် legacy manual amount ဖြင့် စာရင်းဟောင်းများ မပျက်စေရန်။
- [ ] Ledger API နှင့် CashSale API တွင် saleItems သိမ်းရန်။

### အဆင့် C — History, edit, backup/restore ပြီးစီးရန်

- [ ] Transaction history တွင် ဗူးအမျိုးအစား၊ ဆံ့၊ ကဒ်၊ ဗူးပေါင်း၊ စျေးနှုန်းနှင့် သင့်ငွေကို ဖော်ပြရန်။
- [ ] Edit လုပ်ရာတွင် saleItems ကို ပြန်တင်ပြီး စျေးကို ပြန်တွက်နိုင်ရန်။
- [ ] Delete လုပ်ရာတွင် saleItems နှင့် amount အားလုံး တစ်ပြိုင်နက်ဖျက်ရန်။
- [ ] Backup export တွင် saleItems ထည့်ရန်။
- [ ] Restore/import တွင် saleItems ကို optional backward-compatible အဖြစ် ပြန်သိမ်းရန်။
- [ ] ယခင် transaction များတွင် saleItems မရှိလျှင် အဟောင်းပုံစံအတိုင်း ပြသရန်။

### အဆင့် D — Dashboard KPI ပြီးစီးရန်

- [ ] `/api/dashboard-kpi` သို့မဟုတ် သီးခြား sales KPI API တွင် saleItems aggregation ထည့်ရန်။
- [ ] Dashboard တွင် ခဲရောင် KPI card အသစ်ထည့်ရန်။
- [ ] Date filter ပြောင်းလျှင် ဗူးရောင်းစာရင်းပါ ပြောင်းရန်။
- [ ] Category နှင့် item အလိုက် drill-down ပြရန်။
- [ ] Retail/Wholesale နှင့် payment method filter များထည့်ရန်။
- [ ] Production total နှင့် Sales total ကို သီးခြားပြရန်။

## ၈။ Data rules နှင့် မပြောင်းရမည့် စည်းမျဉ်းများ

1. Cost Page စျေးနှုန်းပြောင်းခြင်းသည် အဟောင်း transaction သင့်ငွေကို နောက်ကြောင်းပြန်မပြောင်းရ။
2. Customer စျေးလျှော့ခြင်းကို transaction snapshot ထဲတွင် အမှန်တကယ်အသုံးပြုခဲ့သောစျေးအဖြစ် သိမ်းရမည်။
3. `ဗူးပေါင်း = ဆံ့ × ကဒ်` ဖြစ်ရမည်။
4. `သင့်ငွေ = ဗူးပေါင်း × အသုံးပြုသည့်ဗူးတစ်လုံးစျေး` ဖြစ်ရမည်။
5. Payment split စုစုပေါင်းသည် သင့်ငွေနှင့် ကိုက်ညီရမည်။
6. Note ကို structured product data အစား မသုံးရ။ Note သည် အခြားမှတ်ချက်အတွက်သာ ဖြစ်ရမည်။
7. Production Worker list သည် Production record အတွက်သာ ဖြစ်ပြီး Sales product list နှင့် မရောရ။
8. Category default မရှိလျှင် item override သတ်မှတ်နိုင်သော်လည်း price မရှိသော item ကို auto amount တွက်၍ မသိမ်းရ။
9. Legacy transaction များကို migration အတွင်း ဖျက်မပစ်ရ။
10. API တွင် price နှင့် quantity များကို non-negative integer validation လုပ်ရမည်။

## ၉။ လက်ရှိ repository အခြေအနေ

လက်ရှိ working tree တွင် အောက်ပါအခြေခံအပိုင်းများကို စတင်ပြင်ဆင်ထားပြီးဖြစ်သည်။

| အပိုင်း | အခြေအနေ |
|---|---|
| `ProductionWorker` နှင့် Worker button interaction | ယခင် commit များဖြင့် main branch တွင်ရှိပြီး |
| Production Form order | `စက် → Date → Worker → ဗူးအမျိုးအစားနှင့် ဗူးကဒ် → ပျက်စီးမှု` အစီအစဉ်ကို ပြင်ထားပြီး |
| `Ledger.saleItems`, `CashSale.saleItems` schema field | Working tree တွင် စတင်ထည့်ထားပြီး |
| `PriceSetting` model | Working tree တွင် စတင်ထည့်ထားပြီး |
| Daily price migration | Working tree တွင် migration file စတင်ရေးထားပြီး |
| `/api/price-settings` | Working tree တွင် Category/Item date-based API အခြေခံရေးထားပြီး |
| Cost Page | Working tree တွင် catalog-based UI အခြေခံရေးထားပြီး |
| Settings navigation | မပြီးသေး၊ ဆက်လုပ်ရန် |
| Sales product selector | မပြီးသေး၊ ဆက်လုပ်ရန် |
| Customer price override | Sales selector ထဲတွင် transaction-level override အဖြစ် ဆက်လုပ်ရန် |
| Daily bottle-sales KPI | မပြီးသေး၊ saleItems aggregation အပြီး ဆက်လုပ်ရန် |
| Production database migration verification | Build မတိုင်မီ အတည်ပြုရန် |

## ၁၀။ နောက်ရက် စတင်လုပ်ရမည့် အစီအစဉ်

နောက်ရက်တွင် ပထမဆုံး `PriceSetting` migration နှင့် Prisma generate/build ကို စစ်ဆေးရမည်။ ထို့နောက် Settings panel မှ `စျေးနှုန်းသတ်မှတ်` link ကို ဖွင့်ပြီး Cost Page ကို live route အဖြစ် စမ်းသပ်ရမည်။ Cost Page အလုပ်လုပ်ပြီးမှ Dashboard ငွေရှင်းတမ်းတွင် `ဗူးထည့်ရန် +` Popup ကို ချိတ်ဆက်ရမည်။ Product line တစ်ကြောင်းကို ရွေးပြီး Customer စျေးကို ပြောင်းသည့်အခါ သင့်ငွေပြောင်းကြောင်း၊ သိမ်းပြီး History တွင် snapshot အတိုင်း ပြန်မြင်ရကြောင်း စမ်းသပ်ရမည်။

နောက်ဆုံးတွင် `235 Ks × 100 ဆံ့ × 10 ကဒ် = 235,000 Ks` နှင့် Customer စျေးကို `220 Ks` သို့ ပြောင်းသောအခါ `220,000 Ks` ဖြစ်ကြောင်း စမ်းသပ်ပြီး၊ အဟောင်း Cost စျေးကို ပြန်ပြင်သော်လည်း သိမ်းပြီးသား transaction သင့်ငွေ မပြောင်းကြောင်း အတည်ပြုရမည်။ အဲဒီအဆင့်များပြီးမှ Daily Sales KPI card နှင့် category/item aggregation ကို ဆက်တည်ဆောက်ရမည်။

## ၁၁။ အတည်ပြုရမည့် အဆုံးသတ်ရလဒ်

လုပ်ငန်းပြီးဆုံးသည့်အခါ User သည် Customer ကိုရွေးပြီး `ဗူးထည့်ရန် +` ကို နှိပ်ရုံဖြင့် ဗူးအမျိုးအစားနှင့် ကဒ်အရေအတွက်ကို ရွေးနိုင်ရမည်။ System သည် ဆံ့၊ ဗူးပေါင်း၊ Cost စျေး၊ Customer အတွက် ပြန်ညှိထားသောစျေးနှင့် သင့်ငွေကို အလိုအလျောက်တွက်ရမည်။ User သည် Cash/KPay/Bank ဖြင့် ငွေချေသည့်အခါ payment split ကို ထည့်နိုင်ရမည်။ Transaction ကို သိမ်းပြီးနောက် အဲဒီအချိန်က စျေးနှုန်း snapshot နှင့် ဗူးစာရင်းကို ပြန်ကြည့်နိုင်ရမည်။ Dashboard တွင်လည်း ရက်စွဲအလိုက် မည်သည့်ဗူး ဘယ်နှစ်ဗူးရောင်းခဲ့သည်ကို KPI အဖြစ် ပြန်တွက်နိုင်ရမည်။
