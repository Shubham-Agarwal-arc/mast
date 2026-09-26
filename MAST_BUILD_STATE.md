# MAST — Build State
**This is the file to read first, every session — before `BUILD_ROADMAP.md`, before anything else.**

| | |
|---|---|
| Last updated | September 26, 2026 |
| Updated by | Build session (Block 2) |
| Repo | **https://github.com/Shubham-Agarwal-arc/mast** |

---

## ⚡ Quick Status

- **Blocks complete:** 2 / 16 (Block 2 implementation complete; live PostgreSQL validation remains a handoff check)
- **Current block:** Block 3 — Gateway Service Skeleton + Auth — **NEXT, gated on the PostgreSQL check below**
- **Last known-good state:** Block 2 — schema, SQLite migration test, and PostgreSQL DDL generation pass
- **Blockers:** Docker and a PostgreSQL service were unavailable in the Block 2 environment. Before beginning Block 3, run the fresh-PostgreSQL integration test and root Alembic upgrade as specified in the next-session prompt.

---

## 🚧 One-Time Setup (do this once, before Block 1)

1. Create an **empty** GitHub repo (e.g. `mast`). Don't let GitHub add a README/license/gitignore — Block 1 creates those, and a pre-existing file causes a conflict on the first push.
2. Make sure `git` is installed locally and you can already push to that repo however you normally authenticate (SSH key, GitHub CLI, credential manager, etc.). Claude never touches your git credentials and never runs `git push` itself — it only generates files. You run the commands it gives you, from your own machine.
3. Have the repo URL ready to paste into your first message of the Block 1 session, along with the two files below.

---

## ▶️ Copy This Into a New Session to Run Block 3

Attach `MAST_BUILD_ROADMAP.md`, `MAST_BUILD_STATE.md` (this file),
`docs/PRD.md`, and the Block-2 database files under `gateway/db/`, plus
`alembic.ini`, `docker-compose.yml`, `requirements.txt`, and
`tests/test_database.py`, then paste:

```
I'm building MAST. This is Block 3 of 16 — Gateway Service Skeleton + Auth —
per the attached MAST_BUILD_ROADMAP.md. My repo is
https://github.com/Shubham-Agarwal-arc/mast.

Do exactly this, nothing from Block 4 onward. Generate every file as a
real file I can download — do not run any git command yourself (no
`git init`, `add`, `commit`, `push`, `clone`, or `pull`). I'll run
whatever git commands you give me on my own machine.

1. Read MAST_BUILD_STATE.md in full first, then MAST_BUILD_ROADMAP.md,
   `docs/PRD.md`, and the attached Block-2 files. Sanity-check that the
   attached files match the state file before changing anything.
2. Before implementing Block 3, close the Block-2 PostgreSQL validation
   gate. Start the local database with `docker compose up -d db`, set
   `MAST_TEST_DATABASE_URL=postgresql+psycopg://mast:mast@localhost:5432/mast`,
   and run `python -m pytest -q`. Confirm the fresh-PostgreSQL migration
   test runs (not skips) and passes. Then run `alembic upgrade head` and
   verify all five tables exist. If this gate fails, stop and fix only the
   Block-2 migration/test issue before starting Block 3.
3. Implement only Block 3 from the roadmap:
   - FastAPI skeleton under `/gateway/app/`
   - Server-side environment configuration only
   - `GET /v1/health`
   - GitHub OAuth token exchange endpoint: accept a GitHub token from the
     extension, verify it with GitHub, and issue a short-lived MAST JWT plus
     refresh token
   - JWT issuance/verification middleware and create-on-first-signin using
     the existing Block-2 `User` model
   - Structured logging with request id, user id, and latency; never log
     tokens, secrets, or credential-bearing headers
4. Add focused tests, including a mocked OAuth exchange proving a JWT is
   issued and a `User` row is created, plus health and unauthenticated
   behavior tests appropriate to the implemented surface.
5. Validate Block 3's Definition of Done from MAST_BUILD_ROADMAP.md:
   - `uvicorn` boots locally against the Block-2 database
   - `/v1/health` returns HTTP 200
   - mocked OAuth exchange issues a JWT and creates a `User` row
   - tests pass
6. Update MAST_BUILD_STATE.md as one of the generated files: mark Block 3
   done with a short factual summary and any deviation, then write Block 4's
   full session-ready prompt in the "Copy This Into a New Session" section
   following this format. Preserve the documented Block-2 PostgreSQL
   validation result.
7. Give me every generated/changed file, then the exact Git Bash commands
   to run locally to add, commit, and push with a clear conventional
   commit message. Do not run any git command yourself.
8. Report what shipped, validation results, the exact Block 4 prompt, and
   any remaining blocker.

Out of scope for Block 3: Google OAuth, billing/quota, chat/LLM endpoints,
Redis/caching, production hosting, and anything from Blocks 4 onward.

Stay strictly inside Block 3 after the PostgreSQL gate passes. If anything
is ambiguous, make the smallest reasonable call, record it in
MAST_BUILD_STATE.md, and keep moving.
```

## ✅ What's Done

Each entry records the block, date, factual summary, and any deviation from the roadmap.

| Block | Date | Summary |
|---|---|---|
| 1 | September 25, 2026 | Created the Block-1 repository structure (`/gateway`, `/extension`, `/ml`, `/docs`), copied the supplied PRD to `docs/PRD.md` and the supplied roadmap to `MAST_BUILD_ROADMAP.md` exactly, added the root README, Python/Node/OS/secret-focused `.gitignore`, minimal GitHub Actions placeholder, and MIT license placeholder. Because Git does not track empty directories, `.gitkeep` files were added only to the intentionally empty `/gateway`, `/extension`, and `/ml` directories so the required structure survives a fresh clone. The MIT copyright-holder text is provisional and should be confirmed later. No gateway, extension, ML, or CI implementation was added; Block 2 is now the next block. |
| 2 | September 26, 2026 | Added SQLAlchemy 2 models and PostgreSQL-compatible Alembic migration for `User`, `Session`, `Interaction`, `MasteryState`, and `Subscription`, root Alembic configuration, local PostgreSQL Compose service, requirements, DB engine/session dependency, and schema/import tests. PRD §14 fields are represented; UUID primary keys and JSON columns model IDs, device/client metadata, and `kc_ids[]`; uniqueness constraints enforce provider identity, per-user KC state, and one subscription per user. Validation: `pytest -q` reported 2 passed and 1 skipped; the skipped test provisions a disposable PostgreSQL database and was skipped because Docker and a local PostgreSQL service were unavailable. PostgreSQL offline DDL generation succeeded with `PostgresqlImpl`. Deviation: live-Postgres execution of the migration could not be confirmed in this environment, so the next session must pass the explicit PostgreSQL gate in its prompt before Block 3 work. |

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
| 2 | Database Schema & Persistence Layer | ✅ Implemented; live PostgreSQL gate pending |
| 3 | Gateway Service Skeleton + Auth | ➡️ Next, after Block-2 PostgreSQL gate |
| 4 | Local ML Export Pipeline (ONNX) | ⬜ Not started |
| 5 | Extension Scaffold + Local Inference | ⬜ Not started |
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
