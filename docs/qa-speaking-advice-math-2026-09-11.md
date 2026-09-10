# Advice Speaking and native math rendering

## User-visible fixes

- Public Speaking topics such as `Advice` now resolve through the same canonical shared IELTS catalog used by the Mini Program. The direct-session endpoint no longer restricts them to the smaller Cambridge-only set.
- Direct errors for a removed topic and issuance rate limits now have specific recovery text instead of the generic request-failed message.
- AI Coach, topic marking and full-paper reports share `answer-content`. Common LaTeX is rendered as native rich text: stacked fractions, superscript/subscript, roots, symbols and readable formula cards. Raw `\\frac`, `\\pm` and braced powers are not shown for the covered syntax.
- Matrix rows/columns and cases branches retain explicit structure. Unknown environments retain visible separators instead of being silently flattened.

## Safety and performance

- Formula parsing is display-only and never evaluates expressions or accepts provider HTML.
- Rendering is bounded to 40,000 source characters, 120 blocks and 900 inline nodes. A visible truncation message replaces excessive remainder.
- Links are decoded before checking query and fragment keys. Credentials, tokens, secrets and signature-bearing URLs do not create copy buttons and are hidden from visible output.

## Evidence

- Backend Advice fix commit: `4d8308f5a64e5e475aa9786d2a40d47170bc8d73`; production changed only `server.js`. Before/after gate passed; IELTS restarted once; STEM and data were untouched.
- Sanitized production evidence tied the phone failure to three `404 direct_task_not_found` responses before token minting. It was not a microphone, Qwen quota or WSS failure.
- Current authenticated Mini Program verification for exact task `public-speaking-expanded-advice`: session updated, opening response completed, audio and transcript events received, zero retries. The verification did not capture microphone audio or write a student record.
- A separate raw WSS attempt failed transiently and is not hidden; the actual Native Speaking recovery path subsequently passed. Full phone microphone, playback, turn taking and final score remain real-device acceptance work.
- Native formula phone screenshots: `D:/CodexWork/stemist-data-completion/native-math-format-phone.png` and `native-math-structures-phone.png`. They use temporary Page data only and write no student storage.
- Independent final review found no remaining reproducible P0/P1/P2. A 40k unmatched-parenthesis input completed in 10–16 ms rather than the reproduced 20.7-second quadratic path.
- Focused answer/direct/speaking/page/WXML/compiler checks, runtime-package budget and final `npm run test:all` all passed.
