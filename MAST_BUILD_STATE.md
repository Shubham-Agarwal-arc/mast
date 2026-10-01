# MAST — Build State
**This is the file to read first, every session — before `BUILD_ROADMAP.md`, before anything else.**

| | |
|---|---|
| Last updated | October 1, 2026 |
| Updated by | Build session (Block 14, in progress) |
| Repo | **https://github.com/Shubham-Agarwal-arc/mast** |

---

## ⚡ Quick Status
- **Blocks complete:** 13 / 16; Block 14 implementation is in progress.
- **Current block:** Block 14 — Packaging & Marketplace Listing.
- **Last known-good state:** Full Python suite passed 37 tests with 1 PostgreSQL integration skip in Block 13. Block 14's static manifest/asset assertions and changed-file editor diagnostics pass. Extension npm tests and `.vsix` packaging remain unverified.
- **Blockers:** Node.js/npm and local `vsce`/`ovsx` are unavailable, so extension tests/typecheck, VSIX creation/content inspection, and install tests are pending. No real Extension Host is available for walkthrough, visuals, GitHub sign-in, or cross-platform checks. The publisher `mast` remains unconfirmed and no registry credentials were configured; nothing has been published. No live Anthropic/OpenAI or Stripe smoke calls were made. The PostgreSQL server is healthy/reachable, but Block 13's fresh-PostgreSQL migration runner timed out before creating its Alembic version table; fresh SQLite migration passed. Original classifier/DKT research weights, original 30-KC taxonomy, prototype ChromaDB corpus/difficulty metadata, training/session corpus, and held-out evaluation data remain unavailable; model quality and production retrieval content are unverified. The production reference corpus is empty and mastery thresholds/taxonomy were not supplied, so the Knowledge Map uses neutral bars without inferred color bands. Resolved mastery updates occur only when local retrieval identifies a KC.

---

## 🚧 One-Time Setup (do this once, before Block 1)

1. Create an **empty** GitHub repo (e.g. `mast`). Don't let GitHub add a README/license/gitignore — Block 1 creates those, and a pre-existing file causes a conflict on the first push.
2. Make sure `git` is installed locally and you can already push to that repo however you normally authenticate (SSH key, GitHub CLI, credential manager, etc.). Claude never touches your git credentials and never runs `git push` itself — it only generates files. You run the commands it gives you, from your own machine.
3. Have the repo URL ready to paste into your first message of the Block 1 session, along with the two files below.

---

## ▶️ Copy This Into a New Session to Continue Block 14

Attach `MAST_BUILD_ROADMAP.md`, `MAST_BUILD_STATE.md` (this file),
`docs/PRD.md`, all extension source/tests and package files, `extension/.vscodeignore`,
walkthrough media, bundled model assets and provenance/licenses, root
`artifacts/synthetic/`, `.gitignore`, and Block 14 packaging tests, then paste:

```
I'm building MAST. Continue Block 14 of 16 — Packaging & Marketplace Listing — per
the attached MAST_BUILD_ROADMAP.md.
My repo is
https://github.com/Shubham-Agarwal-arc/mast.

Do only Block 14, nothing from Block 15 onward. Work in the current
workspace. Do not run any git command yourself and do not publish to either
registry without explicit authorization and publisher credentials.

1. Read MAST_BUILD_STATE.md in full first, then MAST_BUILD_ROADMAP.md,
	 `docs/PRD.md` §§6.4 and 12, all extension package/source/tests,
	 bundled/generated model metadata/licenses, `.vscodeignore`, and the
	 Block 14 files. Sanity-check them against the state and preserve all
	 Node/npm, Extension Host/sign-in, provider/Stripe, PostgreSQL,
	 cross-platform, synthetic model/corpus, and KC threshold caveats.
2. Finish only Block 14:
	 - If Node.js/npm are available, run `npm ci`, `npm test`, and
		 `npm run typecheck` in `/extension`.
	 - Build a `.vsix` with `npm run package:vsix`. Inspect package contents
		 for runtime dependencies, icon, walkthrough media, model/data assets,
		 licenses, and notices; confirm tests, source, secrets, and dev-only
		 files are excluded.
	 - Validate the contributed walkthrough schema. Confirm it opens once on
		 first activation, has no more than five steps, does not request a
		 provider key in Managed Cloud mode, and completes its final step only
		 after a successful first Socratic response.
	 - Install and smoke-check on at least two of Windows/macOS/Linux if
		 available. Record exactly which platforms and Extension Host checks
		 were not possible.
	 - Confirm the `mast` publisher identity before preparing registry
		 submissions. Do not publish without explicit authorization; never
		 request or handle publishing tokens in chat.
	 - Preserve the facts that the MAST classifier/DKT assets are synthetic,
		 production reference corpus is empty, original KC taxonomy/thresholds
		 are absent, and no research-quality claim is established.
3. Do not call live providers, Stripe, Marketplace, Open VSX, or external
	 telemetry. Do not begin Block 15 QA, launch/go-live, instructor console,
	 model retraining, or taxonomy invention.
4. Update MAST_BUILD_STATE.md with Block 14 results/deviations and remain
	 on Block 14 if any Definition of Done gate is unverified. Only after all
	 gates pass, advance the state and write the full Block 15 prompt.
5. Report changed files, exact validation results, pending platform/manual
	 checks, and any remaining blockers. Do not run any git command yourself.

Stay strictly inside Block 14. If Node/npm, registry authorization, or a
real Extension Host is unavailable, perform local static/package checks
where possible, keep Block 14 marked in progress, and identify the
unverified Definition of Done items precisely.
```

## ✅ What's Done

Each entry records the block, date, factual summary, and any deviation from the roadmap.

| Block | Date | Summary |
|---|---|---|
| 1 | September 25, 2026 | Created the Block-1 repository structure (`/gateway`, `/extension`, `/ml`, `/docs`), copied the supplied PRD to `docs/PRD.md` and the supplied roadmap to `MAST_BUILD_ROADMAP.md` exactly, added the root README, Python/Node/OS/secret-focused `.gitignore`, minimal GitHub Actions placeholder, and MIT license placeholder. Because Git does not track empty directories, `.gitkeep` files were added only to the intentionally empty `/gateway`, `/extension`, and `/ml` directories so the required structure survives a fresh clone. The MIT copyright-holder text is provisional and should be confirmed later. No gateway, extension, ML, or CI implementation was added; Block 2 is now the next block. |
| 2 | September 26, 2026 | Added SQLAlchemy 2 models and PostgreSQL-compatible Alembic migration for `User`, `Session`, `Interaction`, `MasteryState`, and `Subscription`, root Alembic configuration, local PostgreSQL Compose service, requirements, DB engine/session dependency, and schema/import tests. PRD §14 fields are represented; UUID primary keys and JSON columns model IDs, device/client metadata, and `kc_ids[]`; uniqueness constraints enforce provider identity, per-user KC state, and one subscription per user. Initial SQLite tests passed; after Docker became available, the fresh-PostgreSQL migration integration test passed and `alembic upgrade head` created all five tables in the Compose database. |
| 3 | September 26, 2026 | Added FastAPI Gateway app/configuration, `/v1/health`, GitHub `/user` token verification and create-on-first-signin, signed short-lived access and refresh JWTs, refresh and protected identity routes, and JSON request logging with request ID, authenticated user ID, method, path, status, and latency only. Added mocked provider/auth tests. Validation: full suite with the PostgreSQL integration test enabled reported 9 passed, 0 skipped; Uvicorn started with the Compose DB URL and `/v1/health` returned 200. Deviation: added `/v1/auth/me` and `/v1/auth/refresh` as the smallest useful surfaces to exercise access-token verification and make the issued refresh token usable. GitHub/provider tokens are neither persisted nor included in request logs. |
| 4 | September 26, 2026 | Repository inspection found only `ml/.gitkeep`; no classifier/DKT source, trained weights, original 30-KC mapping, training/session corpus, or holdout data were supplied. Added a deterministic synthetic bootstrap pipeline under `ml/export/` that creates eight placeholder text-error classes and 30 generic KC IDs, uses BKT-style `p_slip=0.02`/`p_guess=0.05`, clustered/prerequisite-aware sampling, 200 simulated interactions per student, hidden size 256, embedding size 64, and two LSTM layers; exports classifier and DKT ONNX plus clearly named synthetic native artifacts and provenance metadata under `artifacts/synthetic/`. Added Python determinism/schema tests, Node `onnxruntime-node` smoke test, package manifest/lock, and DKT state-format documentation. Validation: full repository suite with PostgreSQL integration enabled: 12 passed, 0 skipped; Node smoke passed with 8 class scores and DKT output `[1, 3, 30]` plus `[2, 1, 256]` hidden/cell states. No Val AUC or F1-macro evaluation was possible because no real holdout set or trained research weights exist; no benchmark score is claimed. Deviation/size: generated a reproducible synthetic scaffold rather than claiming to retrain the unavailable research models. Artifacts must be replaced with the supplied real models/data before any product or learning-quality claims. |
| 5 | September 27, 2026 | Added a VS Code extension manifest/TypeScript scaffold, local `onnxruntime-node` adapter resolving models from the existing repo-root `artifacts/synthetic/` directory without copying them, classifier labels/scores, DKT one-interaction updates, strict graph name/shape checks, and explicit Base64 little-endian float32 hidden-state persistence in `globalState`. Added `MAST: Classify Python Error` and `MAST: Update Mastery From Interaction` commands; classifier input and inference remain local. Offline tests disable `fetch`, cover path resolution, eight labels/confidence, 30 KC outputs, state serialization/version validation, and warm classifier latency. Validation: `npm run typecheck` passed; `npm test` passed 4/4 with no network; latest warm classifier measurement was median 0.109ms / p95 3.632ms over 100 calls. Full repository Python suite remained green at 12 passed with the PostgreSQL integration enabled. Deviation: the extension resolves repo-root synthetic assets for development; Marketplace packaging of assets outside `/extension/` remains Block 14 work. All inference quality remains unvalidated because Block 4 artifacts are synthetic. |
| 6 | September 27, 2026 | Inspected the repository and found no prototype ChromaDB documents, source text, original KC mapping, or difficulty metadata. Added a versioned portable corpus schema with an empty `source_not_provided` production corpus, import/validation support, a local deterministic cosine vector index, the exact per-KC ceiling `0.4 + mastery * 0.6`, and an explicit difficulty-proximity rerank score (`0.8 * cosine + 0.2 * (1 - abs(document difficulty - KC mastery))`; the PRD names both ranking signals but gives no weight). Bundled the pinned `Xenova/all-MiniLM-L6-v2` INT8 ONNX model and tokenizer/config under `extension/models/` (upstream revision `751bff37182d3f1213fa05d7196b954e230abad9`, Apache-2.0; verified model SHA-256). Added `@xenova/transformers` with remote models disabled and a clearly synthetic test-only corpus. Validation: TypeScript check passed; `npm test` passed 11/11 with global `fetch` disabled, covering low/mid/high mastery filtering, ranking, deterministic index behavior, empty-corpus behavior, actual local MiniLM embedding and retrieval. Latest local test-fixture query latency was median 2.844ms / p95 3.599ms over 30 warm queries; this small synthetic fixture is not comparable to the prototype's full corpus benchmark. Deviation/blocker: production import of the original reference corpus remains blocked until its source documents and metadata are provided; no substitute is presented as original MAST content. Block 4's synthetic classifier/DKT caveat and unverified accuracy claims remain in force. |
| 7 | September 27, 2026 | Added a typed extension Gateway client matching `/v1/auth/github` and `/v1/auth/refresh`, a VS Code GitHub Authentication API adapter requesting only `read:user`, MAST access/refresh token persistence through `SecretStorage`, BYOK key set/read/clear through a separate `SecretStorage` service, and a Managed Cloud/BYOK setting and selector. Remote Gateway URLs require HTTPS; loopback HTTP is allowed for local development. No Gateway code changed and no BYOK key is sent to the Gateway. Automated tests mock VS Code auth, Gateway transport, and storage. Validation: `npm run typecheck` passed; `npm test` passed 20/20 with mocked transport and no real credentials; full Python/PostgreSQL suite passed 12/12. Manual interactive sign-in against the local Gateway was not performed because this environment did not launch a VS Code Extension Host for real Authentication API consent; that manual smoke check remains pending. Blocks 4–6 synthetic model and missing original corpus limitations remain. |
| 8 | September 27, 2026 | Added server-side LangChain LCEL generation for authenticated `POST /v1/chat`, bounded request/response schemas, Socratic system instructions, server-only Anthropic/OpenAI provider selection and env configuration, and generic safe errors for missing providers or generation failures. No Block-9 verifier/regeneration, quota, billing, or extension UI was added. Tests use `FakeListChatModel`/Runnable mocks, prove the existing JWT dependency returns 401 when unauthenticated, provider selection comes from server settings, extra client provider fields and overlong context are rejected, and provider exception details do not reach responses. Validation: full PostgreSQL-enabled Python suite reported 19 passed, 0 skipped; no real provider credentials were configured and no live LLM call was made. Manual provider smoke remains pending. Existing Block-7 interactive sign-in check and Block-4/6 synthetic data limitations remain. |
| 9 | September 27, 2026 | Added a server-selected constitutional classification chain after every generation candidate, explicit two-regeneration cap, Socratic regeneration guidance, and fail-closed behavior (generic 502) if the final candidate is still direct or verification fails. Added safe per-request constitutional outcome logs (request/interaction correlation ID, user ID, trigger flag, retry count, retry success, final verification status) without content, credentials, tokens, or provider exceptions. Added a thread-safe process-local fixed-window quota counter keyed by authenticated user, with optional server environment limits (`MAST_CHAT_QUOTA_LIMIT`, `MAST_CHAT_QUOTA_WINDOW_SECONDS`) and generic 429/Retry-After response; no Free/Pro policy, persistence, Redis, or billing was added. Validation: focused chat tests 14 passed; full Python suite 25 passed, 1 skipped, 39 warnings. All provider calls were mocked; no live-provider smoke call was made. Deviation: because no quota storage/service existed and tier enforcement is Block 12, the mechanism is process-local and its limit defaults to disabled while requests are counted. Block-7 interactive sign-in remains pending; Blocks 4–6 synthetic model/corpus and unavailable holdout-data limitations remain. |
| 10 | September 27, 2026 | Added `MAST: Open Chat`, a secure Chat Panel webview with message thread, mastery/session badges, input, two category-aware follow-up suggestions, and Resolved action. Added local classifier/retrieval-to-Gateway workflow using the SecretStorage bearer token, safe response validation/errors, one token refresh retry on 401, follow-up context reuse, and DKT updates for the top retrieved KC. Added focused mocked Gateway/workflow/message/CSP/draft-preservation tests. Editor diagnostics reported no errors; npm typecheck/tests could not be executed because Node.js was not available in PATH or searched common locations. Manual Extension Host visual/sign-in checks remain pending. Deviation: because the production corpus is `source_not_provided` and empty, a Resolved interaction updates DKT only when retrieval identifies a KC; it does not fabricate a category-to-KC mapping. Prior live-provider, Block-7 sign-in, synthetic model/corpus, and missing holdout-data limitations remain. |
| 11 | October 1, 2026 | Added a Knowledge Map webview with all 30 synthetic KCs, numeric mastery bars, explicit neutral rendering when the original taxonomy/threshold source is unavailable, and local CSP-protected assets. Added `mast.runCode`, which validates an active Python file is inside the workspace, launches the configured executable with a safe argument array and `shell: false`, bounds captured output, and routes stderr through the existing Block 10 ChatWorkflow/Panel; no local server or shell concatenation was added. Added mocked Knowledge Map, threshold-source, safe execution, stderr routing, mapped-KC Resolved mastery, and CSP tests. Editor diagnostics are clean and Gateway chat tests pass 14/14; extension npm typecheck/tests could not run because Node.js is unavailable. Deviation: the original 30-KC names, red/yellow/green cutoffs, and production corpus remain unavailable, so no color bands or fabricated taxonomy are claimed. Extension Host visual, sign-in, provider, and cross-platform checks remain pending. |
| 12 | October 1, 2026 | Added server-only Stripe configuration with placeholder Free/Pro price IDs, authenticated `/v1/billing/checkout`, signed `/v1/billing/webhook`, idempotent subscription event processing via durable `last_event_id`, and migration `0002`. Replaced Block 9's optional global quota limit with subscription-aware Free/Pro policy: configured Free daily cap, active/trialing Pro unlimited, durable subscription state, `Retry-After`, and `X-MAST-Upgrade-Required: true` without changing the chat response contract. Added offline mocked checkout, signature/error, idempotency, cancellation, quota-lifting, and session-preservation tests. Validation: focused billing/chat tests 19 passed; database/gateway tests 8 passed, 1 skipped; full Python suite 30 passed, 1 skipped, 47 warnings. No live Stripe, LLM provider, Node.js extension, or Extension Host checks were run. |
| 13 | October 1, 2026 | Added safe, allowlisted structured interaction logs and durable Interaction metadata (classification category/confidence, retrieved KC IDs, hint depth, mastery delta when Resolved feedback arrives, constitutional trigger/regen/verification outcome, quota outcome, latency components, and optional predicted-hints input). Added migration `0003`, metadata-only authenticated `/v1/feedback`, and bounded authenticated per-user `GET /v1/metrics` with rolling LVM, resolution rate, constitutional trigger rate, latency percentiles, and quota counts. Existing chat JSON and billing contracts remain unchanged; interaction ID is returned in a header. Added default-off `mast.telemetryEnabled`; when enabled, only confidence/KC metadata and content-free resolution feedback are sent. No third-party telemetry SDK. Tests: full Python suite 37 passed, 1 skipped; focused Gateway suite 28 passed, 1 skipped; editor diagnostics clean. Fresh SQLite Alembic migration passed. PostgreSQL is reachable/healthy, but the fresh-PostgreSQL migration attempt timed out before migration began and is still pending. Deviation: the extension has no predicted-hints estimate, so LVM remains null until a real estimate is supplied; local/network latency components are null because the Gateway cannot observe extension timings. No research baselines are claimed. Node/npm checks, Extension Host, sign-in, live provider/Stripe, and cross-platform checks remain pending. |
| 14 | October 1, 2026 | In progress. Added Marketplace metadata, MIT license, PNG icon, changelog, extension README/listing copy, `.vscodeignore`, third-party license/provenance notices, packaged synthetic classifier/DKT ONNX assets, a packaged model-path preference with a development fallback, and a 3-step first-run walkthrough whose final completion event follows a successful Socratic response. Added package/walkthrough and model-path tests. Static manifest/asset/provenance assertions and editor diagnostics pass. Node/npm/vsce/ovsx are unavailable, so extension tests, VSIX build/content inspection, Extension Host walkthrough, publisher confirmation, and two-platform install checks remain pending. Nothing was published. |

---

## 🔒 Locked Decisions — never contradict these in any future block

- **No API key, ever, in the default (Managed Cloud) flow.** This is the entire point of the redesign. BYOK is opt-in only, via VS Code `SecretStorage`, never a `.env` file.
- **No local server process for the default mode.** The extension talks to the cloud Gateway over HTTPS. Error classification, DKT mastery updates, and document retrieval all run **locally in the extension** (ONNX + Transformers.js) — only Socratic generation and constitutional verification cross the network.
- **Stack:** Gateway = Python/FastAPI + Postgres (SQLAlchemy/Alembic) + LangChain LCEL. Extension = TypeScript, `onnxruntime-node`, `@xenova/transformers`. Auth = VS Code Authentication API (GitHub) → MAST-issued JWT. Billing = Stripe. Multi-provider LLM (Anthropic primary, OpenAI configured server-side) — provider choice is never a client concern.
- **Persistence is git-based, but Claude never touches git.** `BUILD_STATE.md` lives in the repo. Every session starts with the human attaching the current files and ends with the human running the git bash commands Claude provides. Claude only ever generates files — it never runs `git init`, `add`, `commit`, `push`, `clone`, or `pull` itself, and it never needs, sees, or handles a GitHub token or any other credential. No other hand-off mechanism.
- **Never commit secrets.** Enforced by `.gitignore` from Block 1 — check it before any commit touching config.
- **Full spec of record:** `docs/PRD.md`. If this state file and the PRD ever disagree, the PRD wins unless `BUILD_STATE.md` explicitly logs a deliberate, reasoned change.

---

## 📋 Session Protocol (condensed — full version in BUILD_ROADMAP.md)

1. Human attaches the current repo docs/files to a fresh session → 2. Claude reads this file fully → 3. Claude confirms what's attached matches what this file claims → 4. Claude does *only* the next block, generating real files → 5. Claude validates against its Definition of Done → 6. Claude updates this file (What's Done + next block's full prompt) as one of the generated files → 7. Claude hands over every generated file plus the exact git bash commands to commit and push them (Claude never runs them) → 8. Human runs those commands locally → 9. Human starts the next session with the next prompt.

If a block can't finish inside budget: commit only what's genuinely complete and working, mark the rest undone here with exact remaining steps. Never leave broken code disguised as done.

---

## 🗺️ Full Block List

| # | Block | Status |
|---|---|---|
| 1 | Repo Bootstrap & Conventions | ✅ Complete |
| 2 | Database Schema & Persistence Layer | ✅ Complete; live PostgreSQL gate passed |
| 3 | Gateway Service Skeleton + Auth | ✅ Complete |
| 4 | Local ML Export Pipeline (ONNX) | ✅ Complete; synthetic bootstrap only, research benchmarks unverified |
| 5 | Extension Scaffold + Local Inference | ✅ Complete; synthetic model interfaces only |
| 6 | Local Embeddings & Mastery-Gated Retrieval | ✅ Complete; original reference corpus import pending |
| 7 | Extension Auth Flow + API Client + BYOK | ✅ Complete; interactive sign-in smoke check pending |
| 8 | Gateway Socratic Generation Chain | ✅ Complete; mocked providers only, live-provider smoke pending |
| 9 | Constitutional Verify + Regen + Quota | ✅ Complete; mocked providers only, process-local optional quota |
| 10 | Chat Panel Webview | ✅ Implementation complete; Node test execution and Extension Host checks pending |
| 11 | Knowledge Map + Error Capture | ✅ Implementation complete; Node test execution and Extension Host checks pending |
| 12 | Billing (Stripe) & Quota Enforcement | ✅ Complete; mocked Stripe only, live Stripe and extension checks pending |
| 13 | Observability & Telemetry | ✅ Complete; production LVM inputs and PostgreSQL migration gate pending |
| 14 | Packaging & Marketplace Listing | 🟡 In progress; VSIX build and install validation pending |
| 15 | QA & Regression Validation | ⬜ Not started |
| 16 | Launch Checklist & Go-Live | ⬜ Not started |

Full detail on every block — scope, boundaries, deliverables, Definition of Done — lives in `BUILD_ROADMAP.md`. This file only ever holds the *current* full-detail prompt, for whichever block is next.
