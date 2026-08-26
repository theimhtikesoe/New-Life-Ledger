# Telegram Customer Link Video Findings

Source: `/home/ubuntu/upload/ScreenRecording_08-26-256910-41-13PM_1.mp4`

The visible failure at approximately 0:10–0:11 occurs after clicking `ရရှိပြီးသား Customer ချိတ်ရန်`. Telegram returns `Telegram editMessageText failed: 400 Bad Request: BUTTON_DATA_INVALID`. This blocks existing-customer selection.

The order message also shows missing fields such as `ရက်စွဲ: မသတ်မှတ်ရသေး` and `ဈေးနှုန်း: မသတ်မှတ်ရသေး`. Clicking `မသတ်မှတ်ရသေးတာ ဖြည့်ရန်` opens a deep link to `/orders?orderId=...&edit=details`, but the website lands at the PIN gate rather than the requested order editor. This creates authentication friction and prevents Telegram-only completion.

Likely fix areas: keep callback_data short and opaque, resolve callback state server-side; add Telegram conversation-based missing-field collection with one-question-at-a-time replies and database persistence; preserve website deep-link behavior as a fallback, but do not require it for Telegram completion; ensure every update edits the original Telegram message and refreshes website data from the same order row.
