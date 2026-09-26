# MAST — Build State
**This is the file to read first, every session — before `BUILD_ROADMAP.md`, before anything else.**

| | |
|---|---|
| Last updated | September 27, 2026 |
| Updated by | Build session (Block 5) |
| Repo | **https://github.com/Shubham-Agarwal-arc/mast** |

---

## ⚡ Quick Status

- **Blocks complete:** 5 / 16
- **Current block:** Block 6 — Local Embeddings & Mastery-Gated Retrieval — **NEXT**
- **Last known-good state:** Blocks 2–5 — PostgreSQL migration, Gateway auth/health, synthetic ONNX export, and offline TypeScript inference pass
- **Blockers:** Original classifier/DKT weights, original 30-KC taxonomy, source retrieval corpus, training/session corpus, and held-out evaluation data were not present in the repository. Block 4 artifacts remain synthetic scaffolding; PRD model-quality benchmarks are unverified and must not be attributed to them.

---

## 🚧 One-Time Setup (do this once, before Block 1)

1. Create an **empty** GitHub repo (e.g. `mast`). Don't let GitHub add a README/license/gitignore — Block 1 creates those, and a pre-existing file causes a conflict on the first push.
2. Make sure `git` is installed locally and you can already push to that repo however you normally authenticate (SSH key, GitHub CLI, credential manager, etc.). Claude never touches your git credentials and never runs `git push` itself — it only generates files. You run the commands it gives you, from your own machine.
3. Have the repo URL ready to paste into your first message of the Block 1 session, along with the two files below.

---

## ▶️ Copy This Into a New Session to Run Block 6

Attach `MAST_BUILD_ROADMAP.md`, `MAST_BUILD_STATE.md` (this file),
`docs/PRD.md`, the current `/ml/` and `/extension/` contents,
`artifacts/synthetic/`, and `requirements.txt`, then paste:

```
I'm building MAST. This is Block 6 of 16 — Local Embeddings & Mastery-Gated
Retrieval — per the attached MAST_BUILD_ROADMAP.md. My repo is
https://github.com/Shubham-Agarwal-arc/mast.

Do exactly this, nothing from Block 7 onward. Generate every file as a
real file I can download — do not run any git command yourself (no
`git init`, `add`, `commit`, `push`, `clone`, or `pull`). I'll run
whatever git commands you give me on my own machine.

1. Read MAST_BUILD_STATE.md in full first, then MAST_BUILD_ROADMAP.md,
   `docs/PRD.md`, the current `/ml/` and `/extension/` contents, and any
   reference-document artifacts. Sanity-check that the attachments match
   the state file before changing anything. Preserve Block 4's warning:
   the ONNX classifier and DKT are synthetic scaffolding, not research
   models and not validated for accuracy.
2. Inspect the repository for the prototype's original ChromaDB documents,
   source text, metadata, KC mappings, and difficulty values. Do not assume
   the source corpus exists. If it is absent, do not invent or present
   replacement text as original MAST reference content; use only a small,
   clearly labelled synthetic fixture for algorithm tests and record that
   production corpus import remains blocked on source data.
3. Implement only Block 6 from the roadmap:
   - Port available reference documents to a bundled, portable format with
     stable document IDs, KC association, difficulty, and text.
   - Add local all-MiniLM-L6-v2 embeddings using `@xenova/transformers`.
     Keep model loading local/offline after dependencies are installed; do
     not add Gateway/server retrieval or runtime network downloads.
   - Add a lightweight local vector index and cosine-similarity search.
   - Apply the exact ceiling `0.4 + mastery * 0.6`, then rerank eligible
     documents by similarity and difficulty proximity as specified by
     PRD §7.2 / FR-E2.
   - Integrate only with the Block-5 local inference interfaces as needed
     to obtain mastery values. Do not add chat or webview UI.
4. Add focused tests proving ceiling filtering and ranking at low, middle,
   and high mastery levels, plus deterministic vector-index behavior using
   local fixtures. Tests must not make network calls. Label fixtures as
   synthetic when the source corpus is unavailable.
5. Validate Block 6's Definition of Done from MAST_BUILD_ROADMAP.md:
   - Retrieval returns correctly filtered and ranked results across a
     spread of mastery levels.
   - Confirm inference/index lookup works with network access disabled.
   - Measure local query latency and report it against the approximate
     80ms prototype reference without claiming equivalence if the original
     corpus/model environment is unavailable.
   - Tests and TypeScript checks pass.
6. Update MAST_BUILD_STATE.md as one of the generated files: record Block 6
   results, deviations, and whether original corpus content was available;
   preserve Blocks 2–5 results and the synthetic model warning; then write
   Block 7's full session-ready prompt in the "Copy This Into a New Session"
   section in this format.
7. Give me every generated/changed file, then the exact Git Bash commands
   to add, commit, and push with a clear conventional commit message. Do
   not run any git command yourself.
8. Report what shipped, validation and latency results, the exact Block 7
   prompt, and any remaining source-data blocker.

Out of scope for Block 6: Gateway retrieval, chat, UI, billing, auth,
taxonomy/model retraining, changes to Block 4 synthetic model weights, and
anything from Block 7 onward.

Stay strictly inside Block 6. If the original document corpus is absent,
keep synthetic fixtures clearly labelled and record the production corpus
blocker instead of fabricating source material.
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
| 6 | Local Embeddings & Mastery-Gated Retrieval | ➡️ Next |
| 6 | Local Embeddings & Mastery-Gated Retrieval | ⬜ Not started |
| 7 | Extension Auth Flow + API Client + BYOK | ⬜ Not started |
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
