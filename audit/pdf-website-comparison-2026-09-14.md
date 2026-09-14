# Telegram PDF vs Website comparison notes

The provided `New-Life-Ledger-Daily-2026-09-13.pdf` has 4 pages. Page 1 is Daily Summary with payment/customer information. Page 2 is the daily retail/wholesale sales summary: retail total 278,500 Ks, retail cash 278,500 Ks, wholesale total 1,996,750 Ks, wholesale cash 1,316,500 Ks, daily total 2,275,250 Ks, cash total 1,595,000 Ks, monthly/opening card 129,843,850 Ks and Opening 0 Ks. Page 3 is production: bottle rows, Tube rows (13g W: 2 bags / 5,000 pcs; 13g S+S: 7 bags / 17,500 pcs; 24g W: 6 bags / 9,000 pcs), then total cards show total output 40,990 pcs, bottle waste 60, Tube damage 22 pcs, and Tube quantity incorrectly shows 3.5 bags. The correct Tube produced-bag total from the rows is 2 + 7 + 6 = 15 bags. Page 4 is bottle sales with paid/debt sections and customer/item rows.

Current source `src/lib/daily-report.js` computes Tube PDF summary card from legacy/manual `tubeQuantityValue`, which caused 3.5. A fix is being implemented to sum Tube output row quantities and use that as the PDF total.

The user also says the PDF is missing data that exists on the website; live website comparison with the user profile still needs to be completed before deciding which additional fields/sections to add.

Source: visual extraction of uploaded PDF and repository source `src/lib/daily-report.js`.

