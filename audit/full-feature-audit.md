# New Life Ledger — Feature Audit

**စစ်ဆေးသည့်နေ့:** 2026-08-25  
**စစ်ဆေးမှုအမျိုးအစား:** Production read-only check + feature-branch code review  
**Repository:** [theimhtikesoe/New-Life-Ledger](https://github.com/theimhtikesoe/New-Life-Ledger)  
**Live site:** [newlifeledger.vercel.app](https://newlifeledger.vercel.app)  
**Feature branch:** `security-hardening`  
**Pull request:** [#6](https://github.com/theimhtikesoe/New-Life-Ledger/pull/6)

## အနှစ်ချုပ်

New Life Ledger သည် customer အကြွေးစာရင်း၊ ငွေချေမှု၊ KPay notification matching၊ Telegram report၊ backup/restore၊ audit history နှင့် Daily Summary ပါသည့် internal ledger system ဖြစ်နေပါပြီ။ အခြေခံ business flow များသည် production တွင် အလုပ်လုပ်နေပြီး Dashboard balance နှင့် active-customer aggregate ကို ပြန်တွက်ရာတွင် mismatch `0` ရှိသည်။

ယခုထည့်ထားသော Balance Detail page သည် feature branch တွင် ပြီးစီးထားပြီး Dashboard မှ `အသားတင်ရရန်လက်ကျန်` card ကိုနှိပ်လျှင် သွားနိုင်မည်ဖြစ်သည်။ Mobile 375px စစ်ဆေးရာတွင် horizontal overflow မရှိ၊ formula နှင့် red/green breakdown မှန်ကန်စွာပေါ်သည်။ သို့သော် feature branch ကို production `main` သို့ merge မလုပ်ရသေးသောကြောင့် Balance Detail page သည် လက်ရှိ live site တွင် မပေါ်သေးပါ။

Daily Summary AI နှင့်ပတ်သက်၍ current production ကို တကယ်နှိပ်စမ်းရာတွင် loading ပြီးနောက် `Manus API key မမှန်ကန်ပါ သို့မဟုတ် ခွင့်ပြုချက် မရှိပါ။` ဟု ပြန်လာသည်။ အဓိကပြဿနာသည် Vercel ထဲရှိ `MANUS_API_KEY` တန်ဖိုး/ခွင့်ပြုချက် မမှန်ခြင်းဖြစ်သည်။ Source ထဲမှာ `ensureDatabase` import သည် current branch တွင် ရှိပြီးသားဖြစ်သောကြောင့် ယခု production failure ကို missing import ဟု မသတ်မှတ်သင့်ပါ။ Screenshot ထဲတွင် variable အမည်ရှိခြင်းက key တန်ဖိုးမှန်ကြောင်း မသက်သေပြနိုင်ပါ။

## Production နှင့် feature branch ခွဲခြားချက်

| အရာ | လက်ရှိ production `main` | Feature branch `security-hardening` |
|---|---|---|
| Daily Summary mobile date box | ပြင်ပြီး live ဖြစ် | အတူတူပါ |
| Dashboard Net Receivable card | လက်ရှိ card သာ | Clickable link ဖြစ်ပြီး Balance Detail သို့သွားမည် |
| Balance Detail page | မပါသေး | ပါပြီး၊ PR #6 တွင်ရှိ |
| PIN/API security | အဟောင်း client-side gate | HttpOnly signed session + API middleware ပါ |
| Database auto-DROP risk | အဟောင်း code | Auto-DROP ဖယ်ပြီး schema mismatch တွင် ရပ်မည် |
| AI | Manus key rejected | AI source path မပြောင်း; valid key လိုအပ် |
| Report schedule | Vercel Cron တစ်ကြိမ်၊ 08:00 အနီး | အတူတူ + duplicate report-date lock |

Vercel environment screenshot တွင် `APP_PIN` နှင့် `APP_SESSION_SECRET` ကို Production အတွက် ထည့်ထားသည်ကို မြင်ရသည်။ သို့သော် အဆိုပါ variables များကိုအသုံးပြုသည့် code သည် PR #6 ထဲတွင်သာရှိသေးသဖြင့် PR merge/deploy မလုပ်မချင်း production code သည် အဆိုပါ server-session security ကို အပြည့်အဝမသုံးသေးပါ။

## Feature အလိုက် စစ်ဆေးချက်

| Feature | လက်ရှိအခြေအနေ | တွေ့ရှိချက် / လိုအပ်ချက် |
|---|---|---|
| Dashboard | အလုပ်လုပ် | KPI များ၊ overdue count၊ Daily Summary၊ Activity၊ Data Management နှင့် Auto Report links ရှိသည်။ Net Receivable card ကို feature branch တွင် clickable ပြင်ထားသည်။ |
| Customer စာရင်း | အလုပ်လုပ် | Production တွင် customer `162` ယောက်၊ pagination `7` pages နှင့် search/list/detail flow အလုပ်လုပ်သည်။ |
| Customer Ledger | အလုပ်လုပ် | `CREDIT` သည် အကြွေးတိုးပြီး balance တိုး၊ `DEBIT` သည် ငွေချေပြီး balance လျော့သည်။ Detail link ကို Balance Detail မှ Ledger သို့ ဆက်သွားအောင် ထည့်ထားသည်။ |
| Balance Detail | Feature branch တွင် ပြီး | အကြွေးစုစုပေါင်း၊ ကြိုတင်ငွေချေစုစုပေါင်း၊ အသားတင်လက်ကျန်၊ လူအရေအတွက်၊ formula၊ search/filter/sort နှင့် active customer breakdown ပါသည်။ Recycle Bin customer များကို မထည့်ပါ။ |
| Accounting | မှန်ကန် | `Customer.current_balance = sum(CREDIT) - sum(DEBIT)` ဖြစ်သည်။ Positive balance ကို အနီရောင်အကြွေး၊ negative balance ကို အစိမ်းရောင်ကြိုတင်ငွေချေဟု ပြသည်။ Production aggregate reconciliation mismatch `0` ဖြစ်သည်။ |
| KPay webhook | အလုပ်လုပ် | MacroDroid payload ကိုဖတ်ပြီး unmatched payment ကို pending ထားနိုင်သည်။ သီးခြား `KPAY_WEBHOOK_SECRET` သုံးလိုပါက ထည့်နိုင်သော်လည်း လက်ရှိ integration မပျက်စေရန် optional rollout ထားသည်။ Duplicate event idempotency မပြီးသေးပါ။ |
| KPay matching | အလုပ်လုပ် | Pending KPay မှ customer နှင့် match လုပ်နိုင်သည်။ Amount/time/raw text အပေါ် duplicate protection ကို နောက်တစ်ဆင့်ထည့်သင့်သည်။ |
| Daily Summary | အလုပ်လုပ် | Date အလိုက် payment, debt increase, transaction count, customer breakdown နှင့် payment type summary ရှိသည်။ Date error stale-state bug ကို feature branch တွင်ရှင်းထားသည်။ |
| Daily Summary AI | လက်ရှိ production တွင် မအောင်မြင် | Live test တွင် Manus API key invalid/unauthorized error ရသည်။ Vercel Production `MANUS_API_KEY` ကို valid key ဖြင့် replace/verify လုပ်ပြီး redeploy လုပ်ရမည်။ Key ကို chat/repo ထဲ မပို့ရ။ |
| Activity History | အလုပ်လုပ် | Date/actor/action filter၊ mobile cards နှင့် desktop table ရှိသည်။ Production read-only check တွင် selected date အတွက် action count မှန်ကန်စွာပြသည်။ |
| Backup | အလုပ်လုပ် | Full JSON backup တွင် customers, ledgers, pending KPay နှင့် audit logs ပါသည်။ Active total နှင့် ledger recomputation ကို ပြန်စစ်နိုင်သည်။ |
| Restore | UI/endpoint ရှိ | Restore ကို production တွင် မနှိပ်စမ်းခဲ့ပါ။ Backup preview, confirmation, schema/version check နှင့် permission ကို သီးခြား staging/test database ဖြင့် စမ်းသင့်သည်။ |
| Auto Report | အလုပ်လုပ် | မနေ့က Myanmar day ကို report date အဖြစ်ယူပြီး Daily Summary image, Activity image နှင့် PDF ပို့သည်။ Option A အတိုင်း Vercel Cron တစ်ကြိမ်ပဲ run သည်။ |
| Auto Report status | အလုပ်လုပ် | Latest run result၊ delivery count၊ runtime နှင့် running/claimed status ကိုပြနိုင်သည်။ Vercel Cron က failure အတွက် 09:00/10:00 auto retry မလုပ်ပါ။ |
| Telegram custom message | အလုပ်လုပ် | Manual custom message route ရှိသည်။ Standalone heart emoji ကို current daily-report payload/history တွင် မတွေ့ပါ။ နောက်ပိုင်း custom message ပို့တိုင်း actor နှင့် message length ကို audit ထားမည်။ |
| PIN security | Feature branch တွင် ပြီး | Server-side PIN login, signed HttpOnly cookie, idle logout, API middleware နှင့် destructive action reauthentication ထည့်ထားသည်။ PR merge နှင့် Vercel env setup လိုအပ်သည်။ |
| Database setup | Feature branch တွင် လုံခြုံအောင်ပြင် | Legacy schema တွေ့ရုံနဲ့ `DROP TABLE ... CASCADE` မလုပ်တော့ပါ။ Schema mismatch တွင် explicit migration လိုအပ်ကြောင်း error ရပ်မည်။ |
| Mobile UI | တိုးတက်ပြီး | Daily Summary date input ကို mobile card အတွင်းထိန်းထားသည်။ Balance Detail ကို 375px check ဖြင့် overflow မရှိကြောင်း စစ်ပြီးသည်။ |

## AI ပြဿနာကို အခုဘာလုပ်ရမလဲ

Vercel ထဲတွင် `MANUS_API_KEY` အမည်ရှိရုံနှင့် မလုံလောက်ပါ။ Current live request သည် Manus API မှ unauthorized ပြန်လာသောကြောင့် key ကို Vercel Production မှာ **အသစ်ပြန်ထည့်/မှန်ကန်မှုစစ်**ရမည်။ Key ပြန်ထည့်ပြီး deployment အသစ်ပြီးလျှင် Daily Summary တွင် report date တစ်ရက်ကိုရွေးကာ `AI ဖြင့် ရှင်းပြရန်` ကို တစ်ကြိမ်စမ်းရမည်။ အဖြေတက်လျှင် source/data path မှန်ကန်သည်ဟု ဆက်လက်အတည်ပြုနိုင်သည်။

`MANUS_API_KEY` ကို screenshot ထဲတွင် ဖော်ပြထားသော်လည်း တန်ဖိုးကို မမြင်ရသောကြောင့် မမှန်/expired/permission မရှိသည်ကို Vercel UI နှင့် Manus account ဘက်တွင်ပဲ ပြန်စစ်ရမည်။ Key တန်ဖိုးကို repository, chat, screenshot တွင် မထည့်သင့်ပါ။

## Balance Detail page မှာ ဘာတွေကို အထူးသတိထားသင့်သလဲ

စာမျက်နှာ၏ total သည် customer တစ်ယောက်ချင်းစီ၏ **လက်ရှိ balance** ကို စုထားခြင်းဖြစ်ပြီး သမိုင်းတစ်လျှောက် ငွေချေခဲ့သမျှ စုစုပေါင်းမဟုတ်ပါ။ အကြွေးစုစုပေါင်းသည် positive `current_balance` များပေါင်းခြင်း၊ ကြိုတင်ငွေချေစုစုပေါင်းသည် negative balance များ၏ absolute value ပေါင်းခြင်းဖြစ်သည်။ ထို့ကြောင့် `300,000 − 100,000 = 200,000 Ks` ကို အသားတင်ရရန်အဖြစ် နားလည်နိုင်သည်။ သမိုင်းတစ်လျှောက် ငွေချေ/အကြွေးတိုး transaction များကို Daily Summary သို့မဟုတ် Ledger တွင် ကြည့်ရမည်။

## ဦးစားပေးလုပ်စရာ

| ဦးစားပေး | လုပ်စရာ | အကြောင်းရင်း |
|---|---|---|
| P0 | Vercel Production `MANUS_API_KEY` ကို valid key ဖြင့် ပြန်စစ်/replace ပြီး redeploy | AI ခလုတ်၏ live error ကို ဖြေရှင်းရန် |
| P0 | PR #6 ကို review ပြီး merge; merge မလုပ်မီ `APP_PIN` နှင့် `APP_SESSION_SECRET` ကို သေချာထားရန် | Balance Detail နှင့် server-side API security ကို live ရောက်ရန် |
| P1 | Merge ပြီး production တွင် anonymous API 401၊ login၊ Balance Detail၊ AI၊ logout ကို ပြန်စမ်း | Security/code/deployment ပေါင်းစပ်မှန်မမှန်အတည်ပြုရန် |
| P1 | KPay event idempotency ထည့်ရန် | Notification ထပ်ရောက်လျှင် ငွေစာရင်းနှစ်ကြိမ်မဝင်စေရန် |
| P1 | Restore ကို staging/test database ဖြင့် စမ်းရန် | Production data ကို မတော်တဆ overwrite မဖြစ်စေရန် |
| P2 | Legacy schema အတွက် reviewed migration script ပြုလုပ်ရန် | Auto-DROP ဖယ်ပြီးနောက် schema upgrade ကို တိကျစွာလုပ်ရန် |
| P2 | Build အပြင် automated API/UI regression tests နှင့် report monitoring ထည့်ရန် | နောက် deployment တွင် အလားတူ error မပြန်ဖြစ်ရန် |

## စစ်ဆေးမှုမှတ်တမ်း

Feature branch တွင် `pnpm run build`, `pnpm run lint`, `git diff --check` အောင်မြင်သည်။ Local 375px Balance Detail check တွင် `bodyScrollWidth = viewportWidth = 375` ဖြစ်ပြီး formula၊ အကြွေး/ကြိုတင်ငွေချေ cards ပေါ်သည်၊ deleted customer မပေါ်ပါ။ Local route audit တွင် customer, daily summary, audit, backup, report, KPay နှင့် auto-report APIs များသည် session မရှိလျှင် HTTP 401 ပြန်ပြီး `/api/health` သည် HTTP 200 ပြန်သည်။ Production AI check သည် unauthorized Manus API key error ဖြင့်ပြီးဆုံးသည်။ Production data ကို ထည့်ခြင်း၊ ပြင်ခြင်း၊ ဖျက်ခြင်း၊ restore ပြုလုပ်ခြင်း သို့မဟုတ် Telegram message အသစ်ပို့ခြင်း မလုပ်ခဲ့ပါ။



## နောက်ဆုံး Post-merge Production အတည်ပြုချက်

**အတည်ပြုသည့်နေ့:** 2026-08-25

အထက်ပါ pre-merge ခွဲခြားချက်များကို အောက်ပါအတည်ပြုချက်က အစားထိုးပါသည်။ PR #6 သည် merge commit `0d0367d0ed2c3b08a28f9a6a7bfbf9a76b015650` ဖြင့် `main` သို့ ဝင်ပြီး Production တွင် live ဖြစ်နေပါပြီ။ Code-only merge ဖြစ်သဖြင့် migration, restore, customer/ledger edit, delete, Telegram message, သို့မဟုတ် report send တစ်ခုမျှ မလုပ်ခဲ့ပါ။

| စစ်ဆေးချက် | လက်ရှိ Production အဖြေ |
|---|---|
| Server-side security | Customers, backup, daily summary နှင့် auto-report status တို့ကို anonymous ခေါ်ရာ HTTP 401 ပြန်သည်။ Health သည် HTTP 200 ဖြစ်ပြီး anonymous session သည် `authenticated: false` ပြန်သည်။ |
| Dashboard balance link | Net Receivable `16,093,800 Ks` ပြပြီး `/balance-detail` သို့ click လုပ်၍ သွားနိုင်သည်။ Active customers `162` ယောက်၊ overdue `5` ယောက် ပြသည်။ |
| Balance Detail | Net `16,093,800 Ks`; လက်ကျန်အကြွေး `22,222,050 Ks` / 16 ယောက်; ကြိုတင်ငွေချေ `6,128,250 Ks` / 4 ယောက်; zero balance `142` ယောက်; active customer `162/162` ဖြစ်သည်။ |
| Ledger deep link | Balance Detail မှ ပထမ `Ledger →` link သည် `Solo (ခိုလမ်)` customer ကိုဖွင့်ပြီး `5,112,500 Ks` နှင့် ရှိပြီးသား transaction `5/5` ကို ပြသည်။ |
| AI Daily Summary | Key update/redeploy ပြီးနောက် အရင် `Manus API key မမှန်ကန်ပါ` error မပြန်တော့ပါ။ သို့သော် Manus task message polling အဆင့်တွင် generic API-setting error ဖြင့် မပြီးသေးပါ။ |

### AI အတွက် လက်ရှိအဓိပ္ပာယ်

လက်ရှိပြဿနာကို Daily Summary UI သို့မဟုတ် ledger data ပျက်နေသည်ဟု မသတ်မှတ်နိုင်ပါ။ Request သည် Manus integration ထဲသို့ ရောက်သော်လည်း task message polling အဆင့်တွင် အဖြေမရသေးခြင်းဖြစ်သည်။ Manus task polling endpoint/permission/response behavior ကို provider ဘက်တွင် ပြန်စစ်ရန်လိုပြီး API key တန်ဖိုးကို chat ထဲသို့ မပို့ရပါ။

### နောက်ထပ်လုပ်စရာ ဦးစားပေး

| ဦးစားပေး | လုပ်စရာ | အဓိကအကြောင်း |
|---|---|---|
| P0 | Manus task polling/API configuration ကို provider ဘက်နှင့် ပြန်စစ် | AI explanation အလုပ်လုပ်စေရန် |
| P1 | KPay event idempotency/deduplication ထည့် | Notification ထပ်ရောက်လျှင် ledger နှစ်ကြိမ်မဝင်စေရန် |
| P1 | Restore ကို staging/test database ဖြင့်သာ စမ်း | Production data overwrite မဖြစ်စေရန် |
| P2 | Legacy schema အတွက် reviewed migration path ပြုလုပ် | Auto-DROP မရှိတော့သည့်အခြေအနေတွင် လုံခြုံစွာ upgrade လုပ်ရန် |

Option A report schedule သည် မပြောင်းပါ။ Vercel Cron တစ်ကြိမ်တည်း `30 1 * * *` ဖြင့် မနေ့က Myanmar date report ကို ခန့်မှန်း 08:00 Myanmar အချိန်တွင် ပို့ပြီး report-date lock သုံးပါသည်။ 09:00/10:00 retry scheduler မထည့်ထားပါ။

## 2026-08-25 Daily Summary Mobile UI ပြင်ဆင်ချက်

User ပေးထားသော 750×6612 mobile screenshot ကို tile 12 ခုဖြင့် အပေါ်မှအောက် စစ်ဆေးရာ AI ရှင်းပြချက် panel သည် card များနှင့် padding များလွန်းပြီး page အလွန်ရှည်နေသည်ကို တွေ့ရသည်။ Findings/Checks များကို အမြဲဖွင့်ထားခြင်း၊ စာလုံးအရွယ်ကြီးခြင်းနှင့် Daily Summary KPI များကို screen အောက်သို့ အလွန်တွန်းပို့ခြင်းက အဓိက UI ပြဿနာများဖြစ်သည်။

UI-only ပြင်ဆင်ချက်တွင် AI panel ကို white card + purple header အဖြစ် ပြန်စီပြီး overview ကို အပေါ်မှာ အတိုချုံးပြထားသည်။ Findings နှင့် Checks များကို အရေအတွက်ပြ summary bar နှင့် ဖွင့်ကြည့်နိုင်သော accordion အဖြစ် ပြောင်းထားသည်။ Mobile customer table ကို ဖတ်ရလွယ်သော customer cards အဖြစ်ပြပြီး desktop တွင် မူလ table ကို ဆက်ထားသည်။ Padding, gap, heading နှင့် body text အရွယ်များကို mobile-first အတိုင်း လျှော့ထားသည်။ AI payload, accounting formula, customer totals, database query, authentication နှင့် business data များကို မပြောင်းပါ။

Read-only fixture validation တွင် 375px viewport အတွက် document/body width `375px`, horizontal overflow `false`, AI panel height `608px`, mobile customer cards `3` ခုနှင့် collapsed detail sections `2` ခု ရရှိသည်။ 1280px viewport တွင် width `1280px`, horizontal overflow `false`, AI panel height `528px` နှင့် desktop customer table ရှိနေသည်။ Temporary fixture သည် database နှင့် Manus provider ကို မခေါ်ဘဲ browser ထဲတွင်သာ အသုံးပြုခဲ့သည်။

## References

[1]: https://github.com/theimhtikesoe/New-Life-Ledger/blob/main/src/app/api/ai/daily-summary/route.js "Daily Summary AI route"
[2]: https://github.com/theimhtikesoe/New-Life-Ledger/blob/main/src/app/balance-detail/page.js "Balance Detail page"
[3]: https://github.com/theimhtikesoe/New-Life-Ledger/pull/6 "Security-hardening pull request"
[4]: https://vercel.com/docs/cron-jobs/manage-cron-jobs "Vercel Cron job behavior"
[5]: https://open.manus.ai/docs/v2/task-lifecycle "Manus API v2 task lifecycle"
[6]: https://open.manus.ai/docs/v2/task.listMessages "Manus API v2 task.listMessages"
