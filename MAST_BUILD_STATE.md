# MAST — Build State
**This is the file to read first, every session — before `BUILD_ROADMAP.md`, before anything else.**

| | |
|---|---|
| Last updated | September 27, 2026 |
| Updated by | Build session (Block 9) |
| Repo | **https://github.com/Shubham-Agarwal-arc/mast** |

---

## ⚡ Quick Status

- **Blocks complete:** 9 / 16 (constitutional verification, capped regeneration, safe outcome logging, and optional in-process quota mechanism complete; live provider smoke test pending server credentials)
- **Current block:** Block 10 — Chat Panel Webview — **NEXT**
- **Last known-good state:** Blocks 2–9 — PostgreSQL migration, Gateway auth/health, local synthetic inference/retrieval, auth/BYOK services, authenticated generation, constitutional verification, and quota-mechanism tests pass
- **Blockers:** No Anthropic/OpenAI server credentials were configured, so no live-provider smoke call was made. Block 7's interactive GitHub sign-in against local Gateway also remains a manual Extension Host check. Original classifier/DKT weights, original 30-KC taxonomy, prototype ChromaDB corpus/difficulty metadata, training/session corpus, and held-out evaluation data remain unavailable; model quality and production retrieval content are unverified.

---

## 🚧 One-Time Setup (do this once, before Block 1)

1. Create an **empty** GitHub repo (e.g. `mast`). Don't let GitHub add a README/license/gitignore — Block 1 creates those, and a pre-existing file causes a conflict on the first push.
2. Make sure `git` is installed locally and you can already push to that repo however you normally authenticate (SSH key, GitHub CLI, credential manager, etc.). Claude never touches your git credentials and never runs `git push` itself — it only generates files. You run the commands it gives you, from your own machine.
3. Have the repo URL ready to paste into your first message of the Block 1 session, along with the two files below.

---

## ▶️ Copy This Into a New Session to Run Block 10

Attach `MAST_BUILD_ROADMAP.md`, `MAST_BUILD_STATE.md` (this file),
`docs/PRD.md`, current `/extension/src/` and `/extension/test/` contents,
`extension/package.json`, the Gateway chat/auth contract and relevant tests,
local inference/retrieval modules, and model/corpus metadata, then paste:

```
I'm building MAST. This is Block 10 of 16 — Chat Panel Webview — per the
attached MAST_BUILD_ROADMAP.md.
My repo is
https://github.com/Shubham-Agarwal-arc/mast.

Do exactly this, nothing from Block 10 onward. Generate every file as a
real file I can download — do not run any git command yourself (no
`git init`, `add`, `commit`, `push`, `clone`, or `pull`). I'll run
whatever git commands you give me on my own machine.

1. Read MAST_BUILD_STATE.md in full first, then MAST_BUILD_ROADMAP.md,
   `docs/PRD.md`, the extension manifest and activation code, current auth
   and Gateway client modules, local inference/retrieval modules, and the
   Block 9 Gateway chat tests. Sanity-check those files against the state
   file. Preserve the pending live-provider smoke check, pending Block-7
   interactive GitHub sign-in check, and synthetic model/corpus limitations.
2. Implement only Block 10 from the roadmap:
   - Add a VS Code Chat Panel webview with a message thread, mastery
     percentage/session-active badges, an input box, two contextual
     follow-up suggestion buttons, and a Resolved action.
   - Wire the existing local classifier (Block 5) and local mastery-gated
     retrieval (Block 6) into the Gateway `/v1/chat` flow, then render the
     unchanged `{ "response": string }` result.
   - Use the existing GitHub/MAST authentication services and securely
     stored MAST access token; do not expose provider credentials or add
     an API-key prompt to Managed Cloud Mode.
   - Keep the webview secure: restrictive Content Security Policy,
     nonce-protected scripts, escaped/untrusted content handling, and
     narrow message commands. Follow existing extension conventions and
     VS Code accessibility/theming expectations.
   - Preserve the Gateway's constitutional verifier and quota behavior.
     Handle safe API errors in the panel without discarding the user's
     draft or current interaction state.
   - Do not spawn a local subprocess/server. Do not add Knowledge Map,
     `mast.runCode`, billing/upgrade UI, Stripe, telemetry dashboards, or
     packaging work; those are later blocks.
3. Add focused Extension tests using mocked VS Code APIs, Gateway
   transport, and local inference/retrieval dependencies. Cover webview
   message validation, request construction and authenticated chat
   contract, Socratic response rendering, suggestions/Resolved behavior,
   and error/draft preservation. Tests must not make network calls or
   start a subprocess.
4. Validate Block 10's Definition of Done from MAST_BUILD_ROADMAP.md:
   - An end-to-end manual or appropriately mocked flow from an error input
     through local classification/retrieval and authenticated Gateway
     response to Resolved is covered.
   - Confirm no code in this block starts a local subprocess/server.
   - Run extension typecheck and test suite, and the Gateway chat tests if
     the request contract changes. Distinguish mocked checks from pending
     manual sign-in/provider checks.
5. Update MAST_BUILD_STATE.md as one of the generated files: record Block
   10 results/deviations, preserve Block 9 and earlier validation, the
   pending manual authentication/provider checks, and synthetic model/
   corpus caveats; then write Block 11's full session-ready prompt in the
   "Copy This Into a New Session" section in this format.
6. Give me every generated/changed file, then the exact Git Bash commands
   to add, commit, and push with a clear conventional commit message. Do
   not run any git command yourself.
7. Report what shipped, validation results, the exact Block 11 prompt, and
   any remaining blocker.

Out of scope for Block 10: Knowledge Map, `mast.runCode`, billing/upgrade
UI, Stripe, telemetry dashboards, packaging, Gateway auth redesign, and
anything from Block 11 onward.

Stay strictly inside Block 10. If real Gateway/provider credentials or an
Extension Host are unavailable, use mocked tests and leave the relevant
manual smoke checks explicitly pending.
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
| 10 | Chat Panel Webview | ⬜ Not started |
| 11 | Knowledge Map + Error Capture | ⬜ Not started |
| 12 | Billing (Stripe) & Quota Enforcement | ⬜ Not started |
| 13 | Observability & Telemetry | ⬜ Not started |
| 14 | Packaging & Marketplace Listing | ⬜ Not started |
| 15 | QA & Regression Validation | ⬜ Not started |
| 16 | Launch Checklist & Go-Live | ⬜ Not started |

Full detail on every block — scope, boundaries, deliverables, Definition of Done — lives in `BUILD_ROADMAP.md`. This file only ever holds the *current* full-detail prompt, for whichever block is next.
