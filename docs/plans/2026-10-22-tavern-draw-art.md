# Tavern draw artwork implementation plan

> **For implementer:** TDD: failing identity, display and security tests before implementation.

**Goal:** Every one of the existing 78 Tarot cards and 64 hexagrams has matching artwork, with upright/reversed display, ordered three-card layouts and zoom.

**Architecture:** A separate public, validated, versioned artwork manifest and immutable image endpoint on the existing STEM backend. A lazy-loaded native component binds only the canonical server draw IDs to that catalog. No model-selected scene can replace a draw image, and no draw probabilities, deck IDs, expiry, payment or IELTS configuration change.

**Tech stack:** Existing Node backend, native WeChat component/WXML/WXSS, Node tests and local vector rendering for deterministic hexagram diagrams. No new production dependency.

1. Verify all 78 classic Rider-Waite-Smith file-description licenses through Wikimedia Commons; retain source page IDs, original SHA-1 and downloaded-thumbnail SHA-256. The initial Soimoi candidate was rejected during visual review because several minor-card scenes did not match their meanings. Download only verified 500px source thumbnails without altering their bytes. Render 64 original diagrams from independently checked King Wen trigram pairs; do not copy the Unicode chart or font data.
2. Add backend asset integrity tests before `server/tavernDrawArt.js`: all 142 IDs exactly match the existing deck, dimensions/types/digests and unique images, traversal/symlink/tamper rejection, immutable ETag and bounded manifest cache. Add only read-only artwork routes to `server/aiApi.js`.
3. Add client contract tests before `bundles/coach/drawArt.js` and `bundles/coach/draw-art/index.*`: exact deck/ID lookup, validated same-service URLs, bounded cache/coalescing, legacy draw compatibility and stale account isolation.
4. Replace the old text-only draw grid with the scoped component. Keep labels, positions, entertainment notice and retry/redraw contract. Use native movable zoom with display-only 180 degree rotation, so enlarged reversed cards do not silently turn upright. Add loading/error/retry states and source credits.
5. Test single/three-card, both orientations, hexagrams, failed assets, cache recovery, account changes, close/reopen and phone/tablet layouts; run full client and focused backend regressions.
6. Before deployment, require a fresh exact-host readiness/rollback gate. Deploy pinned allowlisted artifacts only, with no source build or secret/config/database change; verify every public asset digest and relevant native flow afterward.
7. Reconcile the previous 1.0.54 upload before assigning the next version. Upload a clean verified candidate through the official confirmation flow; pending is not success.

References: https://github.com/mixvlad/TarotCards and its `tarot/soimoi/LICENSE`; https://github.com/urschrei/hexagrams (pattern reference, not blindly copied: its hexagram 27 mapping needs independent checking); https://www.unicode.org/charts/PDF/U4DC0.pdf (reference only).
