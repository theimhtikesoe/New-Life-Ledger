# New Life Ledger — Modern SWE 2026 Future Plan

**ရက်စွဲ:** ၂၀၂၆-၀၉-၂၀

## အနှစ်ချုပ်

Modern SWE 2026 လမ်းညွှန်၏ အဓိကအယူအဆမှာ AI ကို အလျင်အမြန်ထည့်ခြင်းမဟုတ်ဘဲ software ကို **testable, observable, secure, recoverable နှင့် agent-ready** ဖြစ်အောင် တည်ဆောက်ပြီးမှ automation နှင့် AI ကို ထည့်သွင်းရန် ဖြစ်သည်။ New Life Ledger သည် customer အကြွေး၊ ငွေချေ၊ stock၊ tube production နှင့် audit history တို့ကို ကိုင်တွယ်သောကြောင့် **data မှန်ကန်မှုနှင့် auditability** ကို ပထမဦးစားပေးသင့်သည်။ [1]

အကြံပြုသည့် လမ်းကြောင်းမှာ—

> **Ledger core → data integrity → observability → secure CI → reconciliation automation → read-only AI → controlled background agents**

AI သည် customer balance၊ payment သို့မဟုတ် stock ကို တိုက်ရိုက်မပြင်ရပါ။ Write operation များအတွက် deterministic validation၊ audit trail နှင့် human approval လိုအပ်သည်။

## လက်ရှိ project နှင့် လိုအပ်ချက်

Repository တွင် `AGENTS.md`၊ canonical stock pipeline၊ daily bottle sales rule၊ source-of-truth စည်းမျဉ်းများ၊ production/customer Ledger/tube/stock/price focused tests များ ရှိပြီးဖြစ်သည်။ Ledger loading တွင် background pagination၊ price catalog cache နှင့် insertion-time ordering တို့လည်း ရှိသည်။

နောက်ထပ်တိုးတက်ရန် အဓိကနေရာများမှာ backup restore၊ reconciliation invariants၊ CI security၊ API/database observability၊ approval workflow နှင့် read-only reporting tools ဖြစ်သည်။

## ဦးစားပေး Phases

### Phase 0 — Data integrity နှင့် restore

Daily database backup၊ retention၊ restore drill နှင့် backup success alert ကို သတ်မှတ်ပါ။ Test database သို့ restore လုပ်ပြီး customer၊ ledger၊ production၊ stock movement နှင့် audit records ပြန်တက်လာကြောင်း စစ်ရမည်။

`data-health` check တစ်ခုက customer `current_balance` နှင့် Ledger sum မကိုက်မှု၊ settlement target မတွေ့သော payment များ၊ stock movement မကိုက်မှု၊ duplicate write ဖြစ်နိုင်မှုနှင့် audit log မရှိသော sensitive updates များကို ဖော်ပြသင့်သည်။

**ပြီးမြောက်မှု:** Restore test အောင်မြင်ပြီး data-health result တွင် severity၊ count နှင့် example IDs ပါရမည်။

### Phase 1 — Performance နှင့် observability

Ledger loading နှေးခြင်းကို user ပြောမှ သိရမည့်အစား route၊ status၊ duration၊ request ID၊ database query duration၊ queue wait၊ transaction first-page time၊ background completion time၊ cache hit/miss နှင့် retry count တို့ကို structured metrics အဖြစ် တိုင်းပါ။ OpenTelemetry သည် traces၊ metrics နှင့် logs အတွက် vendor-neutral framework ဖြစ်သည်။ [3]

Customer name၊ phone၊ note နှင့် amount အပြည့်အစုံကို logs ထဲ မထည့်ပါနှင့်။ `/ledger` ၏ p50/p95 latency ကို route အလိုက် ပြနိုင်ပြီး request ID ဖြင့် API မှ database query အထိ trace လုပ်နိုင်ရမည်။

### Phase 2 — Agent-ready repository နှင့် CI

`AGENTS.md` ကို entry points၊ source-of-truth rules၊ commands၊ safety boundaries နှင့် domain docs links ပါသော architecture map အဖြစ် ထိန်းသိမ်းပါ။ Root commands များကို အောက်ပါအတိုင်း သတ်မှတ်ရန် အကြံပြုသည်။

```text
pnpm verify:fast       # focused tests နှင့် diff checks
pnpm verify:full       # test suite နှင့် build
pnpm verify:domain     # stock, sales, ledger, production invariants
pnpm audit:repo        # readiness နှင့် security summary
```

CI တွင် test၊ build၊ Prisma schema consistency၊ migration check နှင့် architecture boundary check ပါရမည်။

### Phase 3 — Security hardening

OWASP Top 10:2025 တွင် Broken Access Control၊ Security Misconfiguration၊ Software Supply Chain Failures၊ Cryptographic Failures၊ Injection၊ Insecure Design၊ Authentication Failures၊ Data Integrity Failures၊ Security Logging and Alerting Failures နှင့် Exceptional Conditions များကို အဓိက risk များအဖြစ် ဖော်ပြထားသည်။ [2]

Admin၊ manager၊ worker နှင့် read-only user အလိုက် authorization matrix၊ secure session/PIN policy၊ rate limit၊ server-side permission checks၊ sensitive update audit trail၊ `SECURITY.md`၊ dependency/SCA၊ SAST နှင့် secret scan များ ထည့်သင့်သည်။ High-severity finding သည် merge ကို တားရမည်။ GitHub code scanning နှင့် repository security policy တို့ကို အသုံးပြုနိုင်သည်။ [4][5]

### Phase 4 — Business automation

Customer statement နှင့် reconciliation workspace တွင် opening balance၊ credit၊ payment၊ discount၊ remaining balance နှင့် audit history ကို date range အလိုက် ပြပါ။ System balance နှင့် ground-truth balance မကိုက်ပါက source transactions နှင့် variance ကို ဖော်ပြပါ။

Bottle၊ Tube နှင့် Cap အတွက် system stock၊ physical count၊ adjustment၊ variance နှင့် approver ကို သီးခြားပြပါ။ Physical count ကို stock total ထဲ overwrite မလုပ်ဘဲ adjustment movement အဖြစ် သိမ်းပါ။ Myanmar date အလိုက် sales၊ cash sale၊ credit sale၊ payment၊ production၊ stock variance နှင့် unusual changes ကို daily report အဖြစ် ထုတ်ပါ။

Price setting၊ balance adjustment၊ stock adjustment၊ delete/restore နှင့် report correction များအတွက် before/after value၊ actor၊ timestamp၊ reason နှင့် approval status ကို သိမ်းပါ။

### Phase 5 — Read-only AI assistant

AI ကို ပထမဆုံး **read-only၊ source-cited assistant** အဖြစ်သာ စတင်ပါ။ အကြွေးတိုးပြီး ငွေချေမဝင်သေးသော customer များ၊ stock ကွာခြားချက်၊ customer transaction summary၊ tube production/stock mismatch နှင့် daily anomalies ကို မေးမြန်းနိုင်ရမည်။

Tools များကို `search_customer_transactions`၊ `get_balance_reconciliation`၊ `get_stock_movement_summary` နှင့် `get_daily_report` ကဲ့သို့ read-only tools အဖြစ် ကန့်သတ်ပါ။ Answer တိုင်းတွင် source date၊ record identifier၊ calculation rule နှင့် uncertainty ပါရမည်။ Write operation လိုပါက AI က approval request ပြုလုပ်ပြီး လူကသာ အတည်ပြုရမည်။

### Phase 6 — Controlled background automation

Data-health report၊ daily-report draft၊ failed export retry နှင့် documentation/test PR draft ကဲ့သို့ အန္တရာယ်နည်းသော အလုပ်များအတွက်သာ background agents စတင်ပါ။ Job တစ်ခုချင်းစီတွင် id၊ owner၊ input snapshot၊ budget၊ timeout၊ checkpoint၊ retry count၊ output artifact နှင့် approval state ပါရမည်။ Merge၊ production deploy၊ balance edit၊ stock adjustment နှင့် payment creation ကို human approval မရှိဘဲ agent မလုပ်ရပါ။

## ၁၂ လ အစီအစဉ်

| ကာလ | ဦးစားပေး | ရလဒ် |
|---|---|---|
| လ ၁ | Backup/restore၊ data-health၊ core invariants | Data မမှန်မှုကို စောစီးစွာ သိနိုင်ခြင်း |
| လ ၂ | CI၊ `SECURITY.md`၊ security scans | Secure merge gate |
| လ ၃ | API timing၊ request ID၊ structured logs | Slow request ရင်းမြစ် သိနိုင်ခြင်း |
| လ ၄–၅ | Customer statement နှင့် reconciliation | တိုက်စစ်ခြင်း ပိုလွယ်ခြင်း |
| လ ၆ | Physical stock reconciliation | System/physical variance audit |
| လ ၇–၈ | Daily report နှင့် anomaly report | နေ့စဉ်စောင့်ကြည့်မှု |
| လ ၉–၁၀ | Read-only tools၊ AI eval suite | Source-cited assistant |
| လ ၁၁ | Controlled background jobs | အန္တရာယ်နည်းသော automation |
| လ ၁၂ | KPI/eval dashboard | အကျိုးရှိသော feature ရွေးချယ်နိုင်ခြင်း |

## အခုချက်ချင်း စတင်ရန်

1. `data-health` check နှင့် customer/stock reconciliation report။
2. CI တွင် fast tests၊ full build နှင့် security checks။
3. Ledger API အတွက် structured timing logs နှင့် request IDs။
4. Backup restore drill နှင့် မှတ်တမ်း။
5. ထိုအခြေခံများအပေါ် read-only daily-summary assistant စမ်းသပ်ခြင်း။

## မလုပ်သင့်သေးသောအရာများ

Multi-agent fleet၊ autonomous balance edit၊ autonomous stock adjustment၊ automatic payment posting နှင့် source မပြသော financial answer များကို အစပိုင်းတွင် မထည့်သင့်ပါ။ Permission model၊ audit trail နှင့် rollback plan မရှိဘဲ AI tool သို့မဟုတ် background agent တည်ဆောက်ခြင်းကိုလည်း ရှောင်သင့်သည်။

> **Safety boundary:** AI သို့မဟုတ် background job များသည် customer balance၊ payment၊ stock adjustment နှင့် production record တို့ကို human approval နှင့် audit trail မရှိဘဲ မပြင်ရ။

> **Source of truth:** PostgreSQL records သည် inventory၊ sales၊ balances နှင့် KPI အတွက် source of truth ဖြစ်ရမည်။ Browser cache သည် presentation cache အဖြစ်သာ အသုံးပြုရမည်။

## References

[1]: https://modern-swe.burmese.dev/modern-swe-study-guide-2026.my.pdf "Modern Software Engineer — လေ့လာရေးလမ်းညွှန် 2026"
[2]: https://owasp.org/Top10/2025/ "OWASP Top 10:2025"
[3]: https://opentelemetry.io/docs/what-is-opentelemetry/ "What is OpenTelemetry?"
[4]: https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning "GitHub Code Scanning"
[5]: https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository "Adding a security policy to your repository"
[6]: https://github.com/theimhtikesoe/New-Life-Ledger "New Life Ledger repository"

*ဤစာတမ်းသည် planning document ဖြစ်ပြီး phase တစ်ခုချင်းစီတွင် spec၊ test၊ review နှင့် rollback plan ပါပြီးမှ အကောင်အထည်ဖော်သင့်သည်။*
