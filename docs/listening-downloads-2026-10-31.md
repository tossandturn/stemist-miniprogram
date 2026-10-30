# Listening downloads and daily reminder

User-confirmed: PDF questions/answers and listening MP3 exports share two free different files per Beijing day; playback does not count. Each distinct MP3 is one file, including separate tracks. Same-day retries/resume reuse the file; a verified complete export cache does not spend again. Active members have no daily file-count limit.

The existing PDF limit message already existed, but old subject routes were still compatibility-open. This version opts exact trusted PDF requests into the server's shared policy, including guest requests, without switching old global flags. The new audio file endpoint is always protected. Identity and membership remain server-verified; a client marker cannot grant access.

## Student path

- IELTS entry / listening library → 听力音频下载; current listening player → 下载当前听力音频. No export shortcut during exam mode.
- Pick book and file; original Test labels, track number and size are visible. Catalogue data is remote, not hard-coded.
- Download with actual bytes, speed/ETA, cancel/resume and SHA checks. First export cannot bypass its charge using an unpaid playback buffer.
- After completion, explicit **保存到微信** opens the native file-share flow with a local MP3 and descriptive filename. It does not automatically send anything or claim to write directly to the OS Downloads folder. Cancelled sharing keeps the cache.
- Third different file: clear inline quota/reset/cache guidance plus **查看会员**. No automatic payment or endless retry. Expired login exposes a login action; late old-account results cannot become shareable.
- Public catalogue cache can be used temporarily when offline; bytes still require canonical validation. No token/cookie is stored with cache metadata. Stale source `If-Match` fails before allowance consumption.

## Build and reference

New page/controller/service stay in the existing curriculum subpackage. Build-only minification of the changed Range cache and objective-page helper preserves names and is covered by frozen tests; the128KiB main headroom requirement is unchanged.

References: [official WeChat demo](https://github.com/wechat-miniprogram/miniprogram-demo/blob/0fe5c7df8e90582dd0b89e283df7fe32e04413f9/miniprogram/packageAPI/pages/ar/3dmarker-ar/3dmarker-ar.js) and [official API typings](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts), confirming local `filePath` and optional `fileName`. Reference-only; no dependency/assets copied. Existing native visual tokens and accessible recovery controls retained.

Automated tests, real production download acceptance, development upload and physical-device sharing are separate verification gates. Consult final task receipts rather than treating this specification as a completion claim.
