# AI Coach: answer first, opt-in question source

The main answer no longer includes automatic source identification. After a complete academic answer, the native Coach panel asks “是否识别这是哪一年的真题？”, with “识别出处 / 暂不识别”. Confirmation sends a separate request; decline does nothing. Loading/error/source results remain below the answer and never replace it.

Source requests use an immutable, private snapshot of the original question and images. Snapshots are not stored in page data, drafts or persistent storage. New submissions, photo/context changes, account/privacy changes and unloading invalidate stale callbacks. The extra action is absent from IELTS and partial/failed answers.

Readable streaming text and closed formulas now paint without waiting for the next paragraph/newline, while unfinished formulas remain guarded. A preview still cannot become a completed submission.

PASS: full `npm run test:all`; source-action unit and actual page-state tests; isolated WeChat simulator offer/confirm/decline/answer-retention checks. Package main size 1,961,704 bytes with 135,448 bytes headroom; the 128 KiB minimum is unchanged. Only the existing identifier-minification strategy was extended to the new helper and PDF download/cache utilities; their source behavior and download/resume tests are unchanged.

This inline, non-blocking interaction follows the existing UI tokens and native touch targets. No new popup, new main page, provider credential or persistent student-photo store was added. Release and live timing are pending final acceptance. Physical-phone testing remains NOT VERIFIED.
