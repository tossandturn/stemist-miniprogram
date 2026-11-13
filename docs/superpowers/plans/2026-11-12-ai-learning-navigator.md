# WeChat AI Learning Navigator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a general WeChat AI learning navigator and generate upload-ready Chinese knowledge-base files from one verified feature registry.

**Architecture:** A build-time registry reads the existing STEM route mirror and describes only registered native learning pages. It generates two runtime registries plus knowledge-base and evaluation artifacts. An independent WeChat AI Skill resolves user intent into either explicit choices or a fixed native Handoff page, where the student confirms the final navigation.

**Tech Stack:** WeChat Mini Program CommonJS/WXML/WXSS, Node.js ESM generators and contract tests, existing native package builder.

**Spec:** `docs/ai-mode-general-learning-entry-2026-11-12.md`

## Global Constraints

- Base commit is `db84e999946713d0de278d22593858f542c9fc6c`; runtime base is uploaded-development `4a4a5ddbfec48b7ec04f43b2efcfdee716e2ad90`.
- Preserve the existing login/privacy gate, payment model, AI Coach, camera, microphone and submission boundaries.
- Do not access private records, tokens, photos or conversations from the Skill.
- Do not auto-start paid AI, payment, camera, microphone or answer submission.
- Keep all target pages native and registered in `app.json`.
- Generate four UTF-8 TXT knowledge files, each below 10MB; do not include exam content or unverified commercial claims.
- Reference official WeChat repositories only at the fixed SHAs recorded in the spec.

---

### Task 1: Registry And Generated Artifacts

**Files:**
- Create: `scripts/lib/ai-learning-registry.mjs`
- Create: `scripts/lib/ai-learning-evaluation.mjs`
- Create: `scripts/generate-ai-learning-assets.mjs`
- Create: `scripts/test-ai-learning-assets.mjs`
- Generate: `skills/learning-navigator/data/registry.generated.js`
- Generate: `utils/aiLearningRegistry.generated.js`
- Generate: `knowledge-base/stemist-01-product-and-scope.txt`
- Generate: `knowledge-base/stemist-02-course-navigation.txt`
- Generate: `knowledge-base/stemist-03-operations-faq.txt`
- Generate: `knowledge-base/stemist-04-account-privacy-ai-boundaries.txt`
- Generate: `knowledge-base/manifest.json`
- Generate: `evaluation/ai-mode-learning-navigation.json`

**Interfaces:**
- Produces: `buildAiLearningRegistry(): Registry`, `generateAiLearningArtifacts(root): Manifest`.
- Produces runtime methods `resolveNavigation(input)` and `destinationById(id)` in generated CommonJS modules.

- [ ] **Step 1: Write the failing asset test**

Test literal expected route examples, ambiguity for Physics without stage, ambiguity for 9709 AS without route, exact AP/IB/IELTS/competition/tool destinations, four TXT files, 50 evaluation intents, 42 positive and 8 negative cases, two valid API source names and no location/time labels.

- [ ] **Step 2: Run test to verify RED**

Run: `node scripts/test-ai-learning-assets.mjs`

Expected: FAIL because registry and generated files do not exist.

- [ ] **Step 3: Implement registry and generator**

Read `utils/stemRoutes.js` for route facts. Define task destinations with stable IDs and registered native paths. Generate deterministic CommonJS, TXT, JSON manifest and evaluation JSON using UTF-8 without BOM. Hash each upload file with SHA-256 and record its byte size and version.

- [ ] **Step 4: Generate and verify GREEN**

Run: `node scripts/generate-ai-learning-assets.mjs` then `node scripts/test-ai-learning-assets.mjs`.

Expected: PASS with deterministic artifact hashes and registry consistency.

### Task 2: Independent Skill And Safety Contract

**Files:**
- Create: `agent/AGENTS.md`
- Create: `skills/learning-navigator/SKILL.md`
- Create: `skills/learning-navigator/mcp.json`
- Create: `skills/learning-navigator/index.js`
- Create: `skills/learning-navigator/apis/discoverLearningOptions.js`
- Create: `skills/learning-navigator/apis/openLearningDestination.js`
- Create: `skills/learning-navigator/navigation.js`
- Create: `scripts/test-ai-mode-skill.mjs`

**Interfaces:**
- Consumes: generated `registry.generated.js`.
- Produces: `discoverLearningOptions(args)` and `openLearningDestination(args)` returning Mini Program MCP results with `content`, `structuredContent`, and Handoff resolver.

- [ ] **Step 1: Write the failing Skill test**

Exercise real handlers with literal inputs. Assert missing stage/route returns choices, exact input returns a real page path, unsupported and malformed input fail closed, and returned values contain no record contents, tokens, image data, payment or automatic device action.

- [ ] **Step 2: Run test to verify RED**

Run: `node scripts/test-ai-mode-skill.mjs`.

Expected: FAIL because the Skill does not exist.

- [ ] **Step 3: Implement the Skill**

Register both APIs with `wx.modelContext.createSkill('/skills/learning-navigator')`. Use a fixed `_meta.ui.pagePath` and a Handoff resolver. Mark `navigationPath` as `format: page-link` with `x-link-text-field: navigationLabel`. Keep `content` link-free.

- [ ] **Step 4: Run test to verify GREEN**

Run: `node scripts/test-ai-mode-skill.mjs`.

Expected: PASS for exact navigation, ambiguity and safety cases.

### Task 3: Native Handoff Page

**Files:**
- Create: `bundles/ai-entry/index.js`
- Create: `bundles/ai-entry/index.json`
- Create: `bundles/ai-entry/index.wxml`
- Create: `bundles/ai-entry/index.wxss`
- Modify: `app.js`
- Create: `scripts/test-ai-handoff-page.mjs`

**Interfaces:**
- Consumes: query, optional `getApp().globalData.agentHandoffs[pageId]`, and `utils/aiLearningRegistry.generated.js`.
- Produces: a selection state and one user-confirmed `wx.navigateTo` destination.

- [ ] **Step 1: Write the failing page test**

Assert query-only recovery, pageId payload consumption, no automatic navigation on load, exact option selection, route validation, 44px actions and accessible labels.

- [ ] **Step 2: Run test to verify RED**

Run: `node scripts/test-ai-handoff-page.mjs`.

Expected: FAIL because the page and Handoff listener do not exist.

- [ ] **Step 3: Implement page and listener**

Cache Handoff data in `app.js`; render existing light-purple tokens, progressive choices and a final explicit action. Do not expose internal route diagnostics to students. Keep all destination paths from the generated registry.

- [ ] **Step 4: Run test to verify GREEN**

Run: `node scripts/test-ai-handoff-page.mjs`.

Expected: PASS for phone/tablet data states and navigation safety.

### Task 4: Manifest And Package Integration

**Files:**
- Modify: `app.json`
- Create: `page-meta.json`
- Modify: `scripts/helpers/native-app-manifest.mjs`
- Modify: `scripts/build-native-package.mjs`
- Modify: `scripts/test-native-package-minification.mjs`
- Create: `scripts/test-ai-mode-manifest.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: official independent Skill subpackage and agent metadata contract.
- Produces: a clean upload package containing instruction, page metadata, Skill files and Handoff page while preserving the 128KiB main-package headroom gate.

- [ ] **Step 1: Write failing manifest/package tests**

Assert the independent `skills` package may have an empty pages list, ordinary subpackages still require pages, Skill paths are inside an independent package, instruction/SKILL/mcp byte limits pass, registered API names match, and clean packaging includes all AI files.

- [ ] **Step 2: Run tests to verify RED**

Run: `node scripts/test-ai-mode-manifest.mjs` and `npm run test:package-minification`.

Expected: FAIL because independent Skill packages are rejected and AI files are absent.

- [ ] **Step 3: Implement manifest/package support**

Add `agent.instruction`, `agent.skills`, `agent.pageMetadata`, independent `skills` package and ordinary `bundles/ai-entry` package. Extend package traversal and fixture copying without weakening size, symlink, secret or WebView gates.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `node scripts/test-ai-mode-manifest.mjs`, `npm test`, and `npm run test:package-minification`.

Expected: PASS with Skill package budget and at least 128KiB main-package headroom.

### Task 5: Documentation, Evaluation And Full Verification

**Files:**
- Modify: `README.md`
- Create: `docs/ai-mode-local-acceptance-2026-11-12.md`
- Modify: `docs/ai-mode-general-learning-entry-2026-11-12.md`

**Interfaces:**
- Consumes: generated manifest, official evaluation guide and test evidence.
- Produces: upload list, version notes, local acceptance checklist and explicit external blockers.

- [ ] **Step 1: Document upload and evaluation workflow**

Record four TXT files, byte sizes and hashes from `knowledge-base/manifest.json`. Document 50-case evaluation counts, missing location/time applicability, and that official self-test/WeChat evaluation/real-device Handoff are not run locally.

- [ ] **Step 2: Run focused verification**

Run: `npm run generate:ai-learning`, `npm run test:ai-mode`, `npm run test:device`, `npm run test:image`, `npm run test:pages`, `npm run test:wechat`.

- [ ] **Step 3: Run repository verification**

Run: `npm test`, `npm run test:all`, `npm run test:package-minification`, `git diff --check`, and the clean package `--check-only` command.

- [ ] **Step 4: Review and commit**

Review every changed file for scope and secrets. Commit only this worktree's task files with message `feat: add WeChat AI learning navigator` after all required checks pass. Do not push, upload, submit or publish.
