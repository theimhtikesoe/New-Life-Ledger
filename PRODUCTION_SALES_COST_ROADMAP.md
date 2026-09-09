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

### Implementation checkpoint — 2026-09-08

Cost Page route နှင့် Settings navigation ကို `8a28b45` commit ဖြင့် push လုပ်ပြီးဖြစ်သည်။ PriceSetting schema/API/Page foundation ကို `e28ce73` commit ဖြင့် push လုပ်ထားပြီး `pnpm prisma validate`၊ `pnpm prisma generate` နှင့် `pnpm build` ကို dummy local schema URLs ဖြင့် အောင်မြင်စွာ စစ်ဆေးပြီးဖြစ်သည်။ Live database migration ကိုတော့ deployment environment တွင် `DATABASE_URL`/`DIRECT_URL` ရှိသောအချိန်တွင် ထပ်မံအတည်ပြုရန် ကျန်ရှိသည်။

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


## ၇။ နောက်ပိုင်း ထည့်သွင်းမည့် Material / Packaging Count KPI များ

### ၇.၁ ရည်ရွယ်ချက်

နောက်ပိုင်းတွင် Production data မှနေ၍ အောက်ပါအရေအတွက်များကို Dashboard၊ Stock နှင့် Daily Summary များတွင် ပြန်လည်တွက်ချက်ပြသရန် လိုအပ်မည်။

1. **အဖုံး အရေအတွက်**
2. **ခုတ်ဖက် အရေအတွက်**
3. **ကော်စေ့ အိတ် အရေအတွက်**
4. **ထုတ်ပိုးအိတ်ခွံ အရေအတွက်**

ယခုအဆင့်တွင် production form နှင့် database logic ကို မပြောင်းသေးဘဲ၊ မည်သည့် source data မှ မည်သို့တွက်မည်ကို အရင်ဆုံး သတ်မှတ်ထားရမည်။ နောက်ပိုင်း calculation rule ကို user က အတည်ပြုပြီးမှ implementation လုပ်ရမည်။

### ၇.၂ လက်ရှိ Data မှ ပြန်ယူနိုင်သောအပိုင်းများ

| နောက်ပိုင်းလိုချင်သော Data | လက်ရှိ source data | ယာယီတွက်ချက်နိုင်သည့်နည်း | အတည်ပြုရန်လိုသည့်အချက် |
|---|---|---|---|
| အဖုံး အရေအတွက် | ဗူးခွံ production row ၏ `outputQuantity`, `outputCapacity`, bottle type/color | ပုံမှန်အားဖြင့် `outputQuantity × outputCapacity` ကို ဗူးအရေအတွက်အဖြစ်ယူနိုင်သည် | အဖုံးတစ်ဗူးလျှင် ၁ ခုလား၊ အဖုံးပျက်/အပိုအဖုံး ရှိသလား၊ အဖုံးအရောင်အလိုက် ခွဲမလား |
| ခုတ်ဖက် အရေအတွက် | Tube `tubeMetrics.scrapTubeCount`, `scrapGlueCount`, `scrapKg` | ခုတ်ဖက် count ကို `scrapTubeCount` မှ တိုက်ရိုက်ယူနိုင်သည်။ kg ကို သီးခြားစုနိုင်သည် | `scrapTubeCount` တစ်ခုသည် Tube တစ်ခုလား၊ အပိုင်း/အိတ်လား၊ kg နှင့် count ဆက်စပ်မှုရှိသလား |
| ကော်စေ့ အိတ် အရေအတွက် | Tube `tubeMetrics.usedGlueBags`, `remainingGlueBags`, `scrapGlueCount` | အသုံးပြုသည့်အိတ်ကို `usedGlueBags`၊ လက်ကျန်ကို `remainingGlueBags` အဖြစ် စုနိုင်သည် | `scrapGlueCount` သည် အိတ်လား/အလုံးလား၊ ကော်စေ့အိတ်အရွယ်အစား မတူရင် kg သို့ပြောင်းနည်းလိုမလား |
| ထုတ်ပိုးအိတ်ခွံ အရေအတွက် | လက်ရှိ ProductionReport တွင် သီးခြား field မရှိသေး | Tube output အိတ်အရေအတွက် (`outputQuantity`) ကို proxy အဖြစ်သာ ကြည့်နိုင်သည် | ထုတ်ပိုးအိတ်ခွံ ၁ အိတ်တွင် Tube ဘယ်နှစ်လုံး/ဘယ်နှစ် pcs ထည့်သလဲ၊ အိတ်ပျက်/အပိုအိတ်ကို မှတ်မလား |

### ၇.၃ အရေးကြီးသော Data ခွဲခြားမှု

လက်ရှိ data ထဲတွင် **ထုတ်လုပ်မှု output**၊ **ကုန်ကြမ်းအသုံးပြုမှု**၊ **အပျက်အစီး** နှင့် **လက်ကျန်** တို့သည် အချို့နေရာတွင် ရောနှောနေသေးသည်။ ထို့ကြောင့် နောက်ပိုင်း KPI များကို တိကျစွာတွက်ရန် အောက်ပါ data type များကို သီးခြားသိမ်းသင့်သည်။

```text
OUTPUT       = ထုတ်လုပ်ပြီးသော Tube / ဗူး အရေအတွက်
CONSUMED     = အသုံးပြုခဲ့သော ကော်စေ့ / ထုတ်ပိုးအိတ် အရေအတွက်
WASTE        = ခုတ်ဖက်၊ Tube ပျက်၊ ကော်ပျက်၊ အိတ်ပျက်
REMAINING    = အလုပ်ပြီးချိန်တွင် ကျန်ရှိသည့် ကုန်ကြမ်း / ပစ္စည်း
ADJUSTMENT   = လက်ဖြင့် ပြန်ညှိထားသော အရေအတွက်နှင့် အကြောင်းပြချက်
```

`သုံးကော်စေ့`၊ `ကျန်ကော်စေ့`၊ `ခုတ်ဖက်` နှင့် `ကော်ပျက်` တို့ကို တစ်ခုချင်းစီ ပြန်ခွဲသိမ်းထားသည့် လက်ရှိ `tubeMetrics` structure ကို မဖျက်ဘဲ ဆက်သုံးရမည်။ နောက်ပိုင်း field အသစ်များထည့်လျှင်လည်း အဟောင်း report များ မပျက်စေရန် JSON backward-compatible default ထားရမည်။

### ၇.၄ အကြံပြုထားသော နောက်ပိုင်း Calculation Layer

KPI component တစ်ခုချင်းစီက database rows ကို ကိုယ်တိုင်ပြန်တွက်မည့်အစား shared calculation function တစ်ခုထားသင့်သည်။ ဥပမာ—

```text
calculateMaterialSummary(productionRows, dateRange, machineCode?)

returns:
- capCount
- scrapCount
- scrapKg
- glueUsedBags
- glueUsedKg
- glueRemainingBags
- packagingShellCount
- wasteCount
- sourceReportCount
- calculationWarnings[]
```

ထို function ကို Production history၊ Dashboard KPI၊ Stock detail၊ Daily Summary နှင့် နောက်ပိုင်း report/export များက တစ်နေရာတည်းမှ ပြန်အသုံးပြုသင့်သည်။ ဤနည်းဖြင့် Page တစ်ခုနှင့်တစ်ခု အရေအတွက်မတူခြင်းကို လျှော့ချနိုင်မည်။

### ၇.၅ လက်တွေ့အကြံပြုချက်

**အဖုံး** နှင့် **ထုတ်ပိုးအိတ်ခွံ** ကို output မှ အလိုအလျောက်တွက်နိုင်သော်လည်း ပစ္စည်းတစ်မျိုးချင်းစီ၏ တကယ့်အသုံးပြုမှုနှင့် ပျက်စီးမှုမှာ output တစ်ခုတည်းဖြင့် မသိနိုင်ပါ။ ထို့ကြောင့် proxy calculation ဖြင့် KPI ပြသမည့်အခါ `ခန့်မှန်း` သို့မဟုတ် `ထုတ်လုပ်မှုအပေါ်အခြေခံ` ဟု source label ထားသင့်သည်။

**ခုတ်ဖက်** နှင့် **ကော်စေ့** အတွက် လက်ရှိ `scrapTubeCount`, `scrapGlueCount`, `scrapKg`, `usedGlueBags`, `usedGlueKg` fields များသည် အခြေခံကောင်းပြီးသားဖြစ်သည်။ သို့သော် count unit သည် `အလုံး`, `အပိုင်း`, `အိတ်` မည်သည်ကို အတည်ပြုပြီးမှ KPI ထုတ်သင့်သည်။ kg နှင့် count ကို အလိုအလျောက်ပြောင်းလဲရန် conversion rate မခန့်မှန်းသင့်ပါ။

နောက်ဆုံးတွင် Daily Production Summary ကို row-based ပုံစံဖြင့် ထုတ်သင့်သည်။ အနည်းဆုံး `Date၊ Machine၊ Worker၊ Tube type၊ Output pcs၊ Used glue bags၊ Scrap count၊ Scrap kg၊ Packaging shell count` များ ပါရမည်။ အဲဒီ summary သည် စာအုပ်ထဲက လက်ရေးမှတ်တမ်းနှင့် Website data ကို တစ်ကြောင်းချင်း တိုက်စစ်ရန် အလွယ်ဆုံးအခြေခံဖြစ်မည်။

### ၇.၆ Implementation အစီအစဉ်

1. User ထံမှ item တစ်ခုချင်းစီ၏ **အဓိပ္ပါယ်နှင့် unit** ကို အတည်ပြုရန်။
2. လက်ရှိ data မှ တိုက်ရိုက်ရနိုင်သော count နှင့် မရနိုင်သေးသော count ကို ခွဲရန်။
3. `MaterialSummary` shared calculation function နှင့် unit normalization ထည့်ရန်။
4. လိုအပ်သော field များကို backward-compatible migration ဖြင့် ထည့်ရန်။
5. Production form တွင် လိုအပ်သော manual adjustment fields များသာ ထည့်ရန်။
6. Dashboard KPI နှင့် detail report တွင် source label၊ date filter၊ machine filter ဖြင့် ပြရန်။
7. စာအုပ်မှတ်တမ်း ၃–၅ ရက်နှင့် Website result ကို တိုက်စစ်ပြီးမှ stock/KPI အဖြစ် production အသုံးပြုရန်။

**အရေးကြီးဆုံး မူဝါဒ:** ယူနစ်နှင့် conversion rule မသေချာသေးသော data ကို အလိုအလျောက် ခန့်မှန်းပြီး “တိကျသော လက်ကျန်” အဖြစ် မပြရ။ အတည်ပြုထားသော source၊ calculation formula နှင့် warning ကို အမြဲတမ်း ခွဲပြထားရမည်။

## ၈။ Future implementation notes

ဤအပိုင်းသည် roadmap သာဖြစ်ပြီး လက်ရှိ Production form၊ API၊ database record သို့မဟုတ် KPI behavior ကို မပြောင်းလဲပါ။ User က count အဓိပ္ပါယ်၊ unit၊ conversion နှင့် စာအုပ်မှတ်တမ်းနှင့် ကိုက်ညီသော rule များကို အတည်ပြုပြီးမှ implementation task အဖြစ် ခွဲပြီး ပြင်ဆင်ရမည်။

---

## ၉။ လက်ရှိ implementation status

- Production report တွင် Tube output၊ worker snapshot နှင့် `tubeMetrics` data များ ရှိပြီးဖြစ်သည်။
- Tube history နှင့် Dashboard Tube KPI သည် date-filtered production report data ကို ပြန်အသုံးပြုနေသည်။
- အဖုံး၊ ခုတ်ဖက်၊ ကော်စေ့အိတ်နှင့် ထုတ်ပိုးအိတ်ခွံ KPI များအတွက် shared calculation layer ကို မထည့်ရသေးပါ။
- အထက်ပါ data source နှင့် unit rules အတည်ပြုပြီးနောက်သာ calculation layer နှင့် stock adjustment flow ကို စတင်သင့်သည်။

---


## ၁၀။ ခုတ်ဖက်နှင့် ကော်စေ့ သီးခြားစာရင်းစနစ်

### ၁၀.၁ အခြေခံဒီဇိုင်း

လက်ရှိ Production Page ထဲတွင် `ခုတ်ဖက်` နှင့် `ကော်စေ့` ကို ထုတ်လုပ်မှုတစ်ကြိမ်၏ အသုံးပြုမှု/အပျက်အဖြစ် မှတ်တမ်းတင်ထားသည်။ ထို data သည် ထုတ်လုပ်မှု report အတွက် လိုအပ်သော်လည်း **ဝယ်ယူမှု၊ source၊ လက်ကျန်နှင့် တန်ဖိုး** ကို အပြည့်အစုံမဖော်ပြနိုင်သေးသောကြောင့် အောက်ပါစာရင်းနှစ်မျိုးကို သီးခြားထားသင့်သည်။

1. **ခုတ်ဖက် စာရင်း** — ဝယ်ယူသည့်နေရာ၊ ဝယ်ယူသည့်ရက်၊ kg၊ စျေးနှုန်း၊ သယ်ယူစရိတ်၊ အသုံးပြုမှု၊ လက်ကျန်။
2. **ကော်စေ့ စာရင်း** — ဝယ်ယူသည့်ရက်၊ အိတ်အရေအတွက်၊ တစ်အိတ် kg၊ စုစုပေါင်း kg၊ စျေးနှုန်း၊ ထုတ်လုပ်မှုတွင် အသုံးပြုမှု၊ လက်ကျန်။

Production report သည် ထို inventory ledger များကို အစားထိုးမည်မဟုတ်ပါ။ Production report ထဲရှိ `scrapKg`, `scrapTubeCount`, `scrapGlueCount`, `usedGlueKg`, `usedGlueBags` များသည် ထိုနေ့ထုတ်လုပ်မှုတွင် အသုံးပြု/ပျက်စီးသည့် **usage snapshot** အဖြစ် ဆက်ရှိရမည်။

### ၁၀.၂ ခုတ်ဖက် ဝယ်ယူသည့်နေရာများ

ခုတ်ဖက်သည် အောက်ပါ source သုံးနေရာမှ ဝယ်ယူရသောကြောင့် source ကို free-text အဖြစ် မထားဘဲ catalog key အဖြစ် စံသတ်မှတ်သင့်သည်။

| Source key | ပြသမည့်အမည် | မှတ်တမ်းတင်ရမည့်အချက် |
|---|---|---|
| `MANDALAY` | မန္တလေး | ဝယ်ယူရက်၊ kg၊ တစ် kg စျေး၊ စုစုပေါင်း၊ ပို့ဆောင်စရိတ်၊ invoice/note |
| `PYAWBWE` | ပျော်ဘွယ် | ဝယ်ယူရက်၊ kg၊ တစ် kg စျေး၊ စုစုပေါင်း၊ ပို့ဆောင်စရိတ်၊ invoice/note |
| `AUNGTHAYAR` | အေးသာယာ | ဝယ်ယူရက်၊ kg၊ တစ် kg စျေး၊ စုစုပေါင်း၊ ပို့ဆောင်စရိတ်၊ invoice/note |

နောက်ပိုင်း source အသစ်ထပ်လာနိုင်သောကြောင့် database မှာ enum ကို တင်းကျပ်စွာ မပိတ်ထားဘဲ `sourceKey` နှင့် `sourceName` သို့မဟုတ် သီးခြား `MaterialSource` table သုံးသင့်သည်။ UI တွင်တော့ အထက်ပါ ၃ ခုကို card/select အဖြစ် default ပြပြီး “အခြား” ကို နောက်ပိုင်းထည့်နိုင်သည်။

### ၁၀.၃ အကြံပြုထားသော data model

```text
MaterialType
- SCRAP
- GLUE_SEED

MaterialPurchase
- id
- materialType
- purchaseDate
- sourceKey             # ခုတ်ဖက်အတွက် MANDALAY/PYAWBWE/AUNGTHAYAR
- sourceName
- quantity              # မူရင်းယူနစ်အရေအတွက်
- unit                  # kg / အိတ် / pcs
- weightKg              # ပြောင်းတွက်နိုင်လျှင်
- unitPrice
- totalAmount
- transportCost
- note
- actorName
- createdAt

MaterialUsage
- id
- productionReportId
- materialType
- quantity
- unit
- weightKg
- usageDate
- note

MaterialAdjustment
- id
- materialType
- adjustmentDate
- quantity
- unit
- weightKg
- reason
- actorName
- note
```

တကယ့် implementation အဆင့်တွင် `MaterialPurchase` နှင့် `MaterialUsage` ကို မိသားစုတစ်ခုတည်း JSON ထဲတွင် မထည့်ဘဲ သီးခြား row/table များအဖြစ် သိမ်းသင့်သည်။ ထိုနည်းဖြင့် source အလိုက်၊ date အလိုက်၊ material အလိုက်၊ လက်ကျန်အလိုက် query လုပ်ရလွယ်မည်။

### ၁၀.၄ လက်ကျန်တွက်နည်း

```text
လက်ကျန် kg
= ဝယ်ယူမှု စုစုပေါင်း kg
+ လက်ကျန်အဖွင့် / adjustment
- ထုတ်လုပ်မှုအသုံးပြုမှု kg
- ပျက်စီးမှု kg
```

ကော်စေ့တွင် အိတ်နှင့် kg နှစ်မျိုးလုံးရှိသောကြောင့် တစ်အိတ်လျှင် kg ကို purchase record တိုင်းတွင် snapshot ထားရမည်။ အိတ်အရွယ်အစား မတူနိုင်ပါက `usedGlueBags` တစ်ခုတည်းဖြင့် လက်ကျန်မတွက်ရ။ `usedGlueKg` ကို အဓိကထားပြီး အိတ်အရေအတွက်ကို auxiliary display အဖြစ် ပြသသင့်သည်။

ခုတ်ဖက်တွင် source သုံးခုက material quality/price မတူနိုင်သောကြောင့် **မန္တလေးမှ ဝယ်ထားသည့် kg နှင့် ပျော်ဘွယ်မှ ဝယ်ထားသည့် kg ကို တစ်စုတည်း မပျောက်စေရ**။ လက်ကျန်ကို source အလိုက်လည်း ပြရမည်။ အသုံးပြုမှုကို source မရွေးထားနိုင်သေးလျှင် FIFO သို့မဟုတ် user ရွေးချယ်မှု rule တစ်ခု အတည်ပြုရမည်။

### ၁၀.၅ Production Page နှင့် ချိတ်ဆက်မည့်နည်း

Production မှတ်တမ်းတင်ချိန်တွင်—

- `ခုတ်ဖက် အသုံးပြုမှု kg` ကို `MaterialUsage(SCRAP)` အဖြစ် ချိတ်မည်။
- `ကော်စေ့ အသုံးပြုမှု kg` နှင့် `အိတ်` ကို `MaterialUsage(GLUE_SEED)` အဖြစ် ချိတ်မည်။
- မည်သည့် purchase batch/source မှ သုံးသည်ကို မသတ်မှတ်နိုင်သေးလျှင် usage ကို source မပါသော စုစုပေါင်း usage အဖြစ် အရင်သိမ်းပြီး နောက်ပိုင်း allocation ပြုလုပ်မည်။
- ထိုနေ့ production report ထဲရှိ `tubeMetrics` ကို မဖျက်ဘဲ report snapshot အဖြစ် ဆက်သိမ်းမည်။
- Material ledger သို့ ချိတ်မည့်အခါ duplicate မဖြစ်စေရန် `productionReportId + materialType` unique key သို့မဟုတ် idempotency key သုံးမည်။

### ၁၀.၆ အဆင့်လိုက် တည်ဆောက်ရန် အကြံပြုချက်

1. **Phase 1 — Purchase entry**: ခုတ်ဖက်ဝယ်ယူမှုတွင် source သုံးခု၊ kg၊ စျေး၊ သယ်ယူစရိတ်၊ ရက်စွဲကို မှတ်တမ်းတင်ရန်။ ကော်စေ့ဝယ်ယူမှုတွင် အိတ်၊ တစ်အိတ် kg၊ စုစုပေါင်း kg၊ စျေးကို မှတ်တမ်းတင်ရန်။
2. **Phase 2 — Separate history**: ခုတ်ဖက်နှင့် ကော်စေ့ စာရင်းကို tab/page နှစ်ခုခွဲပြီး date/source filter၊ total purchase၊ used၊ remaining ပြရန်။
3. **Phase 3 — Production usage link**: Production submit/update/delete အားလုံးတွင် MaterialUsage ကို idempotent ချိတ်ရန်။
4. **Phase 4 — Stock dashboard**: မန္တလေး၊ ပျော်ဘွယ်၊ အေးသာယာအလိုက် ခုတ်ဖက်လက်ကျန်နှင့် ကော်စေ့အိတ်/kg လက်ကျန်ကို ပြရန်။
5. **Phase 5 — Cost analysis**: source အလိုက် weighted average cost၊ သယ်ယူစရိတ်ပါပြီး တကယ့် cost/kg ကို တွက်ရန်။

**အဓိကအကြံပြုချက်:** ခုတ်ဖက်နှင့် ကော်စေ့ကို Production Page ထဲရှိ input field သာဖြင့် stock စာရင်းလုပ်မထားသင့်ပါ။ Production usage နှင့် purchase stock ကို သီးခြား ledger နှစ်ခုအဖြစ်ထားပြီး report တွင် snapshot၊ inventory တွင် source/batch အလိုက် row သိမ်းပါက နောက်ပိုင်း လက်ကျန်၊ cost၊ source comparison နှင့် audit အားလုံးကို မှန်ကန်စွာ ပြန်တွက်နိုင်မည်။

## ၁၁။ Source confirmation လိုအပ်သည့် မေးခွန်းများ

Implementation မစတင်မီ အောက်ပါအချက်များကို အတည်ပြုရမည်။

- ခုတ်ဖက်ကို kg ဖြင့်သာ ဝယ်/သုံးသလား၊ အိတ်/ပုံးအရေအတွက်လည်း လိုသလား။
- မန္တလေး၊ ပျော်ဘွယ်၊ အေးသာယာ source တစ်ခုချင်းစီတွင် စျေးနှုန်း သို့မဟုတ် quality ကွာသလား။
- ကော်စေ့ တစ်အိတ်လျှင် kg တူသလား၊ supplier အလိုက် ကွာသလား။
- Production တစ်ကြိမ်တွင် သုံးသော material ကို source/batch ရွေးသိမ်းရန် လိုသလား၊ စုစုပေါင်း usage သာ လုံလောက်သလား။
- သယ်ယူစရိတ်ကို material cost ထဲ ထည့်တွက်မလား၊ သီးခြားပြမလား။
- လက်ကျန်ကို source အလိုက် မဖြစ်မနေကြည့်ရမလား၊ စုစုပေါင်းသာ လုံလောက်သလား။

---
