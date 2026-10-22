# Tarot and hexagram artwork acceptance

## Delivered behavior

- The server's canonical draw ID, deck version and card ID select the image. The AI does not choose or replace the result artwork.
- All 78 Tarot cards and 64 hexagrams have an individual image. Tarot reversals rotate 180 degrees in both the thumbnail and enlarged view; the original source file is unchanged.
- Three-card draws retain their server order and position labels. The native gallery supports previous/next, close, drag and 1–4x pinch configuration. Hexagrams have their exact named diagram; Tarot upright/reversed terminology is not applied to hexagrams.
- Loading, failed image retry, bounded catalog requests, metadata caching and immutable image HTTP caching are included. Retrying an image or opening the gallery never draws again or calls the interpretation model.
- The component lives in the Coach subpackage. Artwork remains on the backend, not in the Mini Program package. Main source package stays 1,966,007 bytes, with 131,145 bytes headroom.
- A native Object-property bridge exposed nested card arrays as contiguous numeric keys. Presentation now safely accepts only that bounded contiguous form; canonical draw validation and source receipts are unchanged.

## Images and provenance

The published set contains 142 files, totaling 20,716,026 bytes. Each file has a versioned filename and SHA-256, and the backend validates its size, type, digest and canonical deck identity before serving it.

- Tarot: classic Rider–Waite–Smith illustrations by Pamela Colman Smith. All 78 Wikimedia Commons file records were individually checked for public-domain metadata. Source-provided 500px JPEG thumbnail bytes are downloaded unchanged. The catalog, detailed provenance and `RWS-SOURCES.txt` retain attribution and original records. The gallery offers a source-copy action.
- Eastern diagrams: 64 original STEMist PNG illustrations, drawn from trigram lines. An independent King Wen 8×8 matrix and actual rendered pixels verify all 384 lines, not just generation metadata.
- An initial Soimoi candidate from GitHub was rejected at visual inspection because several minor-card scenes did not match the card names. It was never deployed and remains only in the local task backup.

Primary sources: [RWS deck source collection](https://commons.wikimedia.org/wiki/Category:Rider-Waite_tarot_deck), [Fool source record](https://commons.wikimedia.org/wiki/File:RWS_Tarot_00_Fool.jpg), [Wands Four source record](https://commons.wikimedia.org/wiki/File:Wands04.jpg). Initial implementation research: [mixvlad/TarotCards](https://github.com/mixvlad/TarotCards), [urschrei/hexagrams](https://github.com/urschrei/hexagrams). No code or imagery from the rejected candidate was shipped.

## Verification

Local evidence folder: `D:/CodexWork/tavern-draw-art-20261022/`.

| Check | Result / evidence |
| --- | --- |
| Full Mini Program suite, including WXML/WXSS compilation, source and transformed runtime modes | PASS, `full-suite-result.json`, `packaged-suite-result.json` and corresponding logs |
| Mapping, deck guards, URL validation, cache, stale owner isolation, native bridge, loading/retry and gallery lifecycle | PASS, `scripts/test-tavern-draw-art.mjs` |
| Backend catalog integrity, missing/tampered/symlink/path guards, methods and ETag | PASS, backend `scripts/test-tavern-draw-art.mjs` |
| 78 image identity/digest/dimensions plus 64 rendered hexagram line patterns | PASS, backend `scripts/test-tavern-draw-art-assets.mjs` |
| Existing draw, media and DeepSeek provider regressions | PASS; no model configuration changed |
| Phone widths 320/375/390, landscape phone 667, tablet 820/1180, normal/2x fonts, three/single/gallery/failure states | PASS, 48 actual-WXML/CSS replay cases in `responsive-result.json` |
| Native three-card, reversal in gallery, next/previous, credit copy, retry without redraw | PASS, `native-acceptance.json`; public handlers in the official simulator |
| Real authenticated Tarot and hexagram server draws shown with their corresponding public images | PASS, `real-draws-result.json` |
| Every public HTTPS image digest, MIME, cache/ETag and conditional 304 | PASS, 142 files; `public-assets-result.json` and `server-https-assets-result.json` |

Visual review covered all 78 Tarot images in four contact sheets, native three-card/reversed screenshots, and representative small-screen, landscape and enlarged-font layouts. A clipped retry action at 320px/2x fonts was found and fixed before the final 48-case PASS.

Limits: the responsive replay and developer-tool checks are not physical-phone/iPad or hardware pinch-gesture tests. The isolated QA project blocks private history and AI interpretation calls; this turn does not claim a new live interpretation-model test or mobile-network speed benchmark. Existing interpretation/provider regressions pass.

## Backend release

- Deployed pinned backend overlay: `49fb788cd3e91b27714528bdbb08d11f4e28abf0` on the existing STEM runtime; this is not a replacement of the base build identity.
- Archive SHA-256: `2699b8a303e5f13e992283293d8235dfcac5a8e937b74af119692234635628e7`; 20,095,402 bytes; 147 allowlisted files.
- Read-only resource/identity/rollback gates passed before upload and after upload, activation and restart. Verified rollback exists. No server-side build or dependency installation occurred.
- Post-restart: about 2,324 MiB available memory, 9.5% swap use, 7.73 GiB filesystem free, I/O wait samples 0.5%/0%/0%; STEM and IELTS health HTTP 200. The IELTS process was not restarted.
- No changes to IELTS, databases, keys, payment, model configuration, draw probabilities, receipt IDs or expiry.

## Client release

The previous 1.0.54 upload was verified successful through its original confirmation task and reconciled in `releases/development.json`; it was not uploaded again. The next development version for artwork is 1.0.55. A client update is required for the new native gallery; future replacement artwork can use the backend catalog without repackaging images. Upload status is recorded separately and must not be inferred from passing tests or backend deployment.
