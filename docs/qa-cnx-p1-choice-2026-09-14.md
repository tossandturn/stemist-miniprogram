# CN X and native P1 choice acceptance

## Delivered behavior

- Calculator: selectable fx-991CW / fx-991CN X layout, persisted selection, CN X SHIFT/ALPHA mappings, variable CALC and SHIFT+CALC SOLVE. Expression, variables, memory and history survive model changes. Invalid stored model IDs fall back to CW. Native navigation title follows the selected model.
- Chapter builder: explicit Only P1 (and other allowed components) shortcuts. Counts and selection eligibility use server component-scoped source IDs, not totals inferred from other components. A P1-only request never fills missing questions with P2.
- Academic multiple-choice papers and chapter questions: native A/B/C/D selection, immediate local save, no required photograph. Mathematics P1 is not classified as multiple choice. Existing answer photographs and historical assessment revisions remain preserved.
- Objective scoring: the authenticated server first persists the submitted choice and source binding. Only then does it return a reviewed official key/result. Unavailable keys are not treated as zero and are not replaced with AI guesses. Whole-paper reports distinguish objective, AI and self-assessed results and partial versus whole-paper coverage.
- Server explicitly advertises reviewed-subset study capability. Six to eleven reviewed P1 groups can support study-only practice; formal topic progress retains the twelve-group threshold. Fewer than six remain unavailable. This does not make every chapter or OCR source ready.

## Verification

- `npm run test:all`: exit 0, including account/privacy isolation, original photo workflows, source mapping, native practice, objective reporting, calculator, responsive device rules and official WXML/WXSS compilation.
- Additional Chemistry 0620 P2 fallback test failed before adding the missing component mapping and passed afterward with `node scripts/test-native-choice.mjs`.
- Live official Developer Tools calculator taps: CN X selection, x²−2, SHIFT+CALC, initial value 1, confirm/execute; result 1.41421356237 and residual about 4.5e-12. Switching back to CW passed. Screenshot review found and fixed CW direction-pad overlap and stale native navigation title before the passing run.
- Live native pages plus production APIs under isolated QA accounts: six-question P1-only assembly, local choice, persisted submission, reviewed objective result, two-question full-paper submission and report. Both correct and incorrect selections were observed. The final run produced a topic score of 1/1 and a full-paper partial score of 1/2, objectiveCount 2 and aiCount 0. No camera or AI grading request was used. QA sessions were ended and prior local user storage restored.
- Screenshot evidence: `D:/CodexWork/stemist-qa-cnx-p1-20260914/cnx-solve.png`, `topic-p1-abcd.png`, `paper-p1-abcd-report.png`. Answer controls and report were scrolled into view and visually inspected, not just checked through page data.
- Runtime budget: 236 files, 1,943,212 bytes, 153,940 bytes below the 2 MiB project budget, no WebViews. Original local `project.config.json` diff hash remained `a60dd99f74b2f04725d99e9ff5758757f0269d2a` and is excluded from this commit.

## Backend coordination

Backend source HEAD: `29488b8cbbba0199a9a32b15810700274c87e60e`, in the dedicated STEM native API candidate worktree. Production release: `/home/ubuntu/alevel-physics/releases/20260914-mcq-29488b8`. Original corpus/asset symlinks were retained; no duplicate question bank or production build was created. Existing production-only removal of the forced-topic reservation block was retained through a reviewed merge rather than overwritten.

The backend worker recorded passing pre/post resource gates, one STEM restart, unchanged IELTS process, stable health, 68.4% available memory, 4.65% swap use, 68% disk use with 19.75 GB free, and I/O wait 0/1/0. Rollback release remains `20260906-v1-a6a0267`. Independent live native MCQ acceptance above ran against the resulting public API.

## Limits

This is a native learning calculator with CN X controls, not a full Casio firmware emulator. Matrix/vector/inequality, numerical integration/differentiation, unit conversion, Pol/Rec, random and full hardware reset remain unsupported and are disclosed in the UI. The shared Solver currently confirms the initial value, then executes; it is not a claim of identical firmware sequencing for every key.

Phone Developer Tools screenshots and responsive contract tests are not physical phone/iPad acceptance. Real hardware touch geometry, camera/microphone, poor-network endurance and unrelated speaking/listening functionality were not newly certified by this feature run. Package upload is separate from WeChat review submission and online publication.

## Primary references

- [Casio fx-991CN X product](https://www.casio.com.cn/scientific-calculators/product.FX-991CNX-BU/)
- [Casio fx-991CN X Chinese manual](https://www.casio.com/content/dam/casio/global/support/manuals/calculators/pdf/004-zh-cn/f/fx-991CN_X_B_CN.pdf)
