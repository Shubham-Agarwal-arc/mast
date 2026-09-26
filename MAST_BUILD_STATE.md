# MAST — Build State
**This is the file to read first, every session — before `BUILD_ROADMAP.md`, before anything else.**

| | |
|---|---|
| Last updated | September 27, 2026 |
| Updated by | Build session (Block 7) |
| Repo | **https://github.com/Shubham-Agarwal-arc/mast** |

---

## ⚡ Quick Status

- **Blocks complete:** 7 / 16 (implementation and automated validation complete; interactive Extension Host sign-in check remains pending)
- **Current block:** Block 8 — Gateway Socratic Generation Chain — **NEXT**
- **Last known-good state:** Blocks 2–7 — PostgreSQL migration, Gateway auth/health, local synthetic model/retrieval, and auth/BYOK services pass
- **Blockers:** Interactive GitHub sign-in against the local Gateway was not exercised in a VS Code Extension Host during Block 7; automated tests use mocks. Original classifier/DKT weights, original 30-KC taxonomy, prototype ChromaDB corpus and its difficulty metadata, training/session corpus, and held-out evaluation data remain unavailable. Block 4 model quality and production retrieval content remain unverified.

---

## 🚧 One-Time Setup (do this once, before Block 1)

1. Create an **empty** GitHub repo (e.g. `mast`). Don't let GitHub add a README/license/gitignore — Block 1 creates those, and a pre-existing file causes a conflict on the first push.
2. Make sure `git` is installed locally and you can already push to that repo however you normally authenticate (SSH key, GitHub CLI, credential manager, etc.). Claude never touches your git credentials and never runs `git push` itself — it only generates files. You run the commands it gives you, from your own machine.
3. Have the repo URL ready to paste into your first message of the Block 1 session, along with the two files below.

---

## ▶️ Copy This Into a New Session to Run Block 8

Attach `MAST_BUILD_ROADMAP.md`, `MAST_BUILD_STATE.md` (this file),
`docs/PRD.md`, current `/gateway/app/` and `/gateway/db/` contents,
`requirements.txt`, and `docker-compose.yml`, then paste:

```
I'm building MAST. This is Block 8 of 16 — Gateway Socratic Generation
Chain — per the attached MAST_BUILD_ROADMAP.md. My repo is
https://github.com/Shubham-Agarwal-arc/mast.

Do exactly this, nothing from Block 9 onward. Generate every file as a
real file I can download — do not run any git command yourself (no
`git init`, `add`, `commit`, `push`, `clone`, or `pull`). I'll run
whatever git commands you give me on my own machine.

1. Read MAST_BUILD_STATE.md in full first, then MAST_BUILD_ROADMAP.md,
   `docs/PRD.md`, current `/gateway/app/` and `/gateway/db/` contents, and
   the extension Gateway/auth code. Sanity-check the attachments against
   the state file. Preserve the Block-4 synthetic classifier/DKT warning,
   Block-6 missing-corpus limitation, and Block-7 note that interactive
   GitHub sign-in was not manually exercised.
2. Implement only Block 8 from the roadmap:
   - Port the Socratic generation chain to the Gateway using LangChain LCEL.
   - Add authenticated `POST /v1/chat` using the existing Block-3 JWT
     dependency and `User` model. Do not weaken or replace authentication.
   - Keep the provider abstraction real: Anthropic is the configured
     primary provider and OpenAI is a configured alternative, selected only
     by server-side environment/configuration. Never accept provider names,
     provider credentials, or model-routing choices from the client.
   - Read provider credentials only from server-side environment variables
     or server configuration. Never commit real secrets, log credentials,
     or put provider keys in extension settings or client payloads.
   - Build the Socratic prompt from bounded request context while preserving
     MAST's teaching intent. Implement generation only; do not add
     constitutional verification, response regeneration, quota, or billing.
   - Add typed request and response schemas for `/v1/chat`. Do not add
     extension chat UI or retrieval changes.
3. Add focused tests with mocked provider clients proving authenticated
   requests return generated Socratic content, unauthenticated requests
   receive 401, provider selection is server-controlled, and provider
   failures do not expose secrets. Automated tests must not make real LLM
   calls.
4. Validate Block 8's Definition of Done from MAST_BUILD_ROADMAP.md:
   - An authenticated request returns a Socratic-style response using a
     mocked/sandboxed provider if real server keys are unavailable.
   - An unauthenticated request receives HTTP 401.
   - Tests pass; distinguish mocked provider validation from any real
     provider manual smoke check.
5. Update MAST_BUILD_STATE.md as one of the generated files: record Block 8
   results and deviations, preserve Blocks 2–7 validation and the pending
   interactive sign-in note plus synthetic model/corpus limitations, then
   write Block 9's full session-ready prompt in the "Copy This Into a New
   Session" section in this format.
6. Give me every generated/changed file, then the exact Git Bash commands
   to add, commit, and push with a clear conventional commit message. Do
   not run any git command yourself.
7. Report what shipped, test/provider validation results, the exact Block 9
   prompt, and any remaining blocker.

Out of scope for Block 8: constitutional verification/regeneration,
quota/billing, telemetry/dashboards, Gateway authentication changes,
extension chat UI, and anything from Block 9 onward.

Stay strictly inside Block 8. If real provider credentials are unavailable,
use mocked provider tests and document the real-provider smoke check as
pending; do not introduce credentials or weaken the test boundary.
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
| 8 | Gateway Socratic Generation Chain | ➡️ Next |
| 9 | Constitutional Verify + Regen + Quota | ⬜ Not started |
| 10 | Chat Panel Webview | ⬜ Not started |
| 11 | Knowledge Map + Error Capture | ⬜ Not started |
| 12 | Billing (Stripe) & Quota Enforcement | ⬜ Not started |
| 13 | Observability & Telemetry | ⬜ Not started |
| 14 | Packaging & Marketplace Listing | ⬜ Not started |
| 15 | QA & Regression Validation | ⬜ Not started |
| 16 | Launch Checklist & Go-Live | ⬜ Not started |

Full detail on every block — scope, boundaries, deliverables, Definition of Done — lives in `BUILD_ROADMAP.md`. This file only ever holds the *current* full-detail prompt, for whichever block is next.
