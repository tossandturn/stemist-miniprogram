# Script visual atmosphere implementation plan

> For implementer: test first; verify the frozen native package and actual rendered screens.

**Goal:** four distinct visual worlds, scene-led openings and chapter transitions, subtle rain/fog/light/star effects, clear narration/character presentation and controllable motion.

**Architecture:** client-only presentation over existing authoritative v1/v2 room snapshots. Reuse the twelve deployed original illustrations. No server writes, model changes, new permissions, music, audio controls or additional AI requests. Presentation cannot change evidence, choices, votes, endings or privacy.

**Tech Stack:** native WeChat WXML/WXSS/JS and existing utils/page; no new runtime dependencies.

## Confirmed scope

Follow-up correction: the user rejected putting scene, roster, identity tabs, clues and recipients on the same primary screen. The room must use progressive disclosure: primary = one compact chapter entry + dialogue + composer; one “本局” menu leads to identity, tasks, players and settings. Each secondary panel has an explicit back action. Identity and debrief content open one section at a time; public/previous clues are collapsed until requested; the answer form appears only when the shared evidence is complete. Recipient choice moves into a composer action, not a permanent full-width picker. Native screenshots must verify the main dialogue area is materially larger, not merely recolored.

Apply the same hierarchy to the catalog: poster-first selection without a duplicate title/marketing hero/permanent invite form. Story details and warnings open before explicit room creation; invitations and the full history open on demand. At most one recent room is promoted. Browsing details must not create a room or consume a turn.

The user accepted the visual proposal with “你补啊”, then explicitly cancelled environment audio: “环境音不用了，主要是氛围的视觉效果”. The partial audio implementation was removed before integration; generated MP3s moved outside the app to local unshipped artifacts. Only visual features ship. General learning-app screens retain the existing brand; these entertainment rooms have scoped visual themes.

Prompt-only changes do not address the visual gap. A new WebView/game engine would unnecessarily replace auth and controls. Use native layered scenes and opaque readable text surfaces. The UI search suggested Spatial UI; retain depth and a skippable intro, reject expensive blur and the unrelated pink palette.

## Implementation and checks

1. bundles/coach/scriptAtmosphere.js + scripts/test-script-atmosphere.mjs: four allowed theme descriptors, current-act-only public intro/image, neutral unknown-script fallback; bounded owner/consent-bound seen markers. No private message becomes scenery.
2. scriptRoom.js + scripts/test-script-atmosphere-page.mjs: immediately dismissible opening once per acknowledged stage, replay current scene, no repeated intro on normal polling, preserve drafts, suspend motion while hidden, clear private UI on ownership/authorization change.
3. scriptRoom.wxml + scriptAtmosphere.wxss: scene backdrop and legible scrim, compact chapter strip, genre-specific tokens, poster lobby, narrator/speaker separation, reveal cue only after confirmed solved state. Two restrained effects maximum, reduced motion and explicit switch, no forced delay.
4. scripts.js/.wxml/.wxss: four distinct poster covers, scoped theme colors, create/join/resume remain discoverable.
5. scripts/test-script-atmosphere-layout.mjs: contrast, image geometry, touch targets, safe areas/keyboard, image failure fallback and no audio files/APIs.
6. Focused/full client tests, frozen-package checks, native simulator screenshots/geometry for four themes and intro/dismiss/replay/settings/failure. Distinguish simulated checks from real phone/iPad acceptance.
7. Push reviewed source and upload a fresh development version. No experience/public-release claim until selected; no backend deploy or restart needed.

## Invariants

- Stage and solved indicators use authenticated snapshots, never inferred AI/user text.
- Lobby shows the opening poster only; replay cannot preview future acts or expose private clues.
- Intro acknowledgement stores only an opaque local marker, no server action or consumed turn.
- Image failure leaves readable colors and full story; generated images retain their message/channel scope.
- Former-account responses cannot paint private UI or reopen a modal. Seen markers use the already-cleared Tavern namespace, with no conversation text stored.
- No flashing, strobe, involuntary shake or forced typewriter delay. Reduced motion disables decorative movement and transitions.
- Fixed controls stay compact; input and chat do not overlap on small/landscape screens.

## Sources

- https://github.com/SillyTavern/SillyTavern and https://docs.sillytavern.app/usage/core-concepts/characterdesign/ — roleplay scene/character framing; no code or third-party cards copied.
- https://docs.sillytavern.app/extensions/dynamic-audio/ was investigated before the user cancelled audio; not part of the shipped design.
- Existing original artwork provenance: backend docs/art/script-room-prompts.json and script-room-act-prompts.json.
