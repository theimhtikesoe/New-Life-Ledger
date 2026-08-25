# Telegram Admin-Only Order Callback Research

**Date:** 2026-08-25

The official [Telegram Bot API](https://core.telegram.org/bots/api) documents that `CallbackQuery` includes the user who pressed an inline button in its `from` field. It also requires a bot to call `answerCallbackQuery` so the client’s progress indicator is cleared, even when the bot has no visible notification to show.

The same official API documents `getChatMember(chat_id, user_id)`, which returns a `ChatMember` object and is only guaranteed to work for other users when the bot is an administrator in the chat. The returned member status distinguishes ordinary `member` users from `administrator` and owner/creator status. Therefore the safe callback rule is: verify the callback message belongs to the configured order group, read the callback sender’s numeric Telegram user ID from `callback_query.from.id`, call `getChatMember` server-side, and allow direct Confirm/Cancel only when the result is `administrator` or `creator`/owner. The optional application allowlist can further restrict this to a selected 2–3 admin IDs if the owner wants to exclude other group administrators.

No Telegram token, chat ID, or user ID is stored in this note. The implementation must fail closed when the bot token or order-group ID is absent, when `getChatMember` fails, when the callback data is malformed, or when the sender is not an administrator. The existing website session remains useful for website actions but must not be used as the identity proof for a Telegram callback.

## References

[1]: https://core.telegram.org/bots/api — Telegram Bot API official documentation; `CallbackQuery`, `answerCallbackQuery`, `getChatMember`, and `ChatMember` status fields.
