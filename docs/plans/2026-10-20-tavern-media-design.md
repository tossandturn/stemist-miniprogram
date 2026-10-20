# Tavern reply media design

Approved direction: the user selected an original sticker and illustration library, chosen by AI for the conversation, then requested a large library. This is message content, not decorative page art. No per-turn image-generation service or new paid service is enabled.

Architecture: a server-owned, versioned catalog holds immutable IDs, captions, categories, provenance and image descriptors. Replies use one bounded structured text/media envelope; the server validates IDs against the actual catalog and persists accepted media with the canonical assistant turn. The client renders text plus at most two media items and never accepts arbitrary model URLs. Old text-only clients/messages remain supported.

Large-library target: 96 distinct sticker frames across eight original character atlases plus 12 original scene illustrations. Frames are visually different expressions, not duplicate resizing; the delivery report must distinguish catalog entries from source image files. A fixed-grid atlas is displayed using bounded image framing, with no generative image editing or extra request at chat time. Unsatisfactory frames are excluded rather than counted as ready.

Candidate retrieval: select a bounded relevant subset by categories/tags and recent conversation, preserving broad emotional coverage. The model chooses whether and which item to send; retrieval is not presented as an AI decision. Avoid recent repeats and use no media for sensitive/safety responses unless clearly appropriate. Do not send the entire catalog to the model or bundle the full library in the Mini Program.

Safety: fixed asset mapping, bounded media count, immutable versioning, no external URLs/data URLs, no student image uploads, no real-person portraits, no licensed character copies. Invalid media must not erase valid text. Persist IDs transactionally with the reply and preserve replay identity, owner isolation, paging, quotas and account-change fences.

Acceptance: red/green protocol and persistence tests; actual rendering of sticker and scene messages; preview only for catalog images; failed image fallback; restored/replayed messages identical; complete existing client and focused backend regressions. Production activation requires fresh server readiness, exact live source comparison, rollback and deployed end-to-end evidence. Simulator events are not physical-device evidence.
