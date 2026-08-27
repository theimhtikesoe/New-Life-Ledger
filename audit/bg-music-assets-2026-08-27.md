# Background music assets

User-provided `BgMusic.zip` was inspected without running any archive contents. It contains four MP3 files and macOS `__MACOSX` metadata files; only the four MP3 files are used.

| Track | CDN URL |
|---|---|
| Ledger Drift.mp3 | https://files.manuscdn.com/user_upload_by_module/session_file/310519663911487146/YZzdOvvQQGcPdMBE.mp3 |
| Ledger Drift-2.mp3 | https://files.manuscdn.com/user_upload_by_module/session_file/310519663911487146/rTYMeMabEYCyQoZh.mp3 |
| Ledger Drift-3.mp3 | https://files.manuscdn.com/user_upload_by_module/session_file/310519663911487146/GbZLFEJNeDyjKhyI.mp3 |
| Ledger Drift-4.mp3 | https://files.manuscdn.com/user_upload_by_module/session_file/310519663911487146/BTQbxwohYQINEhcG.mp3 |

All four files are MPEG Layer III, 64 kbps, 48 kHz, stereo. The archive was valid and contained no extraction errors. The AppleDouble `__MACOSX` files are not used.

Implementation requirements: play tracks sequentially at low volume only after the overdue notification audio has ended; remain muted when the user chooses mute; provide a Refresh-matched mute control; retain browser/PWA autoplay fallback behavior; do not change business data.

Storage note: webdev private storage was unavailable in this Next.js repository (`BUILT_IN_FORGE_API_URL` was not set), so the four user-provided files were uploaded through the standard session CDN uploader and the returned URLs are used as external media sources.
