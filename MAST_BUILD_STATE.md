# MAST — Build State
**This is the file to read first, every session — before `BUILD_ROADMAP.md`, before anything else.**

| | |
|---|---|
| Last updated | September 27, 2026 |
| Updated by | Build session (Block 6) |
| Repo | **https://github.com/Shubham-Agarwal-arc/mast** |

---

## ⚡ Quick Status

- **Blocks complete:** 6 / 16 (retrieval pipeline and offline validation complete; import of the original reference corpus remains blocked on source material)
- **Current block:** Block 7 — Extension Auth Flow + Gateway API Client + BYOK — **NEXT**
- **Last known-good state:** Blocks 2–6 — PostgreSQL migration, Gateway auth/health, synthetic ONNX inference, and local MiniLM retrieval pass
- **Blockers:** Original classifier/DKT weights, original 30-KC taxonomy, prototype ChromaDB corpus and its difficulty metadata, training/session corpus, and held-out evaluation data were not present. Block 4 artifacts and the Block 6 retrieval fixture are synthetic; model-quality and production-corpus claims remain unverified.

---

## 🚧 One-Time Setup (do this once, before Block 1)

1. Create an **empty** GitHub repo (e.g. `mast`). Don't let GitHub add a README/license/gitignore — Block 1 creates those, and a pre-existing file causes a conflict on the first push.
2. Make sure `git` is installed locally and you can already push to that repo however you normally authenticate (SSH key, GitHub CLI, credential manager, etc.). Claude never touches your git credentials and never runs `git push` itself — it only generates files. You run the commands it gives you, from your own machine.
3. Have the repo URL ready to paste into your first message of the Block 1 session, along with the two files below.

---

## ▶️ Copy This Into a New Session to Run Block 7

Attach `MAST_BUILD_ROADMAP.md`, `MAST_BUILD_STATE.md` (this file),
`docs/PRD.md`, current `/extension/` and `/gateway/app/` contents,
`requirements.txt`, and `docker-compose.yml`, then paste:

```
I'm building MAST. This is Block 7 of 16 — Extension Auth Flow + Gateway API
Client + BYOK — per the attached MAST_BUILD_ROADMAP.md. My repo is
https://github.com/Shubham-Agarwal-arc/mast.

Do exactly this, nothing from Block 8 onward. Generate every file as a
real file I can download — do not run any git command yourself (no
`git init`, `add`, `commit`, `push`, `clone`, or `pull`). I'll run
whatever git commands you give me on my own machine.

1. Read MAST_BUILD_STATE.md in full first, then MAST_BUILD_ROADMAP.md,
   `docs/PRD.md`, the current `/extension/` and `/gateway/app/` contents,
   and the attached Block-2 database files. Sanity-check that attachments
   match the state file before changing anything. Preserve the Block-4
   synthetic model warning and the Block-6 note that original corpus data
   was unavailable.
2. Implement only Block 7 from the roadmap:
   - Implement GitHub sign-in using VS Code's built-in Authentication API.
     Request only the scopes needed for identity, then exchange the provider
     access token with the existing Gateway `POST /v1/auth/github` endpoint.
   - Add a typed Gateway API client configured with a server base URL from
     extension settings. The token-exchange payload and response must match
     the existing Gateway contract; do not modify Gateway code in this
     block.
   - Store MAST access/refresh tokens only with VS Code `SecretStorage`.
     Do not use `globalState`, settings JSON, plaintext files, logs, or
     source control for credentials.
   - Add `MAST: Configure API Key` and `MAST: Clear API Key` commands using
     a masked input and `SecretStorage`. The BYOK key must never be sent to
     the MAST Gateway. Add an explicit Managed Cloud vs BYOK mode selector
     that later generation blocks can use.
3. Add focused tests with mocked VS Code authentication, Gateway transport,
   and SecretStorage proving sign-in/exchange, access and refresh token
   persistence, BYOK set/read/clear, and mode selection. Do not make real
   network calls or require real credentials in automated tests.
4. Validate Block 7's Definition of Done from MAST_BUILD_ROADMAP.md:
   - TypeScript checks and tests pass.
   - Manually verify sign-in against the running local Block-3 Gateway when
     available; clearly distinguish mocked tests from this manual check.
   - Verify no BYOK key is written to plaintext or transmitted to MAST.
   - Preserve Block 6's local inference/retrieval behavior and its offline
     tests; do not add chat functionality.
5. Update MAST_BUILD_STATE.md as one of the generated files: record Block 7
   results and deviations, preserve Blocks 2–6 results and both synthetic
   model/corpus limitations, then write Block 8's full session-ready prompt
   in the "Copy This Into a New Session" section in this format.
6. Give me every generated/changed file, then the exact Git Bash commands
   to add, commit, and push with a clear conventional commit message. Do
   not run any git command yourself.
7. Report what shipped, test and manual sign-in results, the exact Block 8
   prompt, and any remaining blocker.

Out of scope for Block 7: Gateway changes, Google OAuth, chat/LLM calls,
embeddings/retrieval changes, billing, and anything from Block 8 onward.

Stay strictly inside Block 7. If VS Code authentication or SecretStorage
cannot be exercised outside the Extension Host, provide mocks for automated
tests and clearly document the manual validation still required.
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
| 7 | Extension Auth Flow + API Client + BYOK | ➡️ Next |
| 8 | Gateway Socratic Generation Chain | ⬜ Not started |
| 9 | Constitutional Verify + Regen + Quota | ⬜ Not started |
| 10 | Chat Panel Webview | ⬜ Not started |
| 11 | Knowledge Map + Error Capture | ⬜ Not started |
| 12 | Billing (Stripe) & Quota Enforcement | ⬜ Not started |
| 13 | Observability & Telemetry | ⬜ Not started |
| 14 | Packaging & Marketplace Listing | ⬜ Not started |
| 15 | QA & Regression Validation | ⬜ Not started |
| 16 | Launch Checklist & Go-Live | ⬜ Not started |

Full detail on every block — scope, boundaries, deliverables, Definition of Done — lives in `BUILD_ROADMAP.md`. This file only ever holds the *current* full-detail prompt, for whichever block is next.
