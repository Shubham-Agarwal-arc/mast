# MAST — Build State
**This is the file to read first, every session — before `BUILD_ROADMAP.md`, before anything else.**

| | |
|---|---|
| Last updated | September 25, 2026 |
| Updated by | Build session (Block 1) |
| Repo | **https://github.com/Shubham-Agarwal-arc/mast** |

---

## ⚡ Quick Status

- **Blocks complete:** 1 / 16
- **Current block:** Block 2 — Database Schema & Persistence Layer — **NEXT**
- **Last known-good state:** Block 1 — Repo Bootstrap & Conventions
- **Blockers:** None for Block 1. Human must run the supplied git commands locally to create the first commit and push.

---

## 🚧 One-Time Setup (do this once, before Block 1)

1. Create an **empty** GitHub repo (e.g. `mast`). Don't let GitHub add a README/license/gitignore — Block 1 creates those, and a pre-existing file causes a conflict on the first push.
2. Make sure `git` is installed locally and you can already push to that repo however you normally authenticate (SSH key, GitHub CLI, credential manager, etc.). Claude never touches your git credentials and never runs `git push` itself — it only generates files. You run the commands it gives you, from your own machine.
3. Have the repo URL ready to paste into your first message of the Block 1 session, along with the two files below.

---

## ▶️ Copy This Into a New Session to Run Block 2

Attach `MAST_BUILD_ROADMAP.md`, `MAST_BUILD_STATE.md` (this file), and
`MAST_Product_Requirements_Document.md` to the message, then paste:

```
I'm building MAST. This is Block 2 of 16 — Database Schema & Persistence Layer —
per the attached MAST_BUILD_ROADMAP.md. My repo is [PASTE REPO URL].

Do exactly this, nothing from Block 3 onward. Generate every file as a
real file I can download — do not run any git command yourself (no
`git init`, `add`, `commit`, `push`, `clone`, or `pull`). I'll run
whatever git commands you give me on my own machine.

1. Read MAST_BUILD_STATE.md in full first, then MAST_BUILD_ROADMAP.md and
   the attached PRD. Sanity-check that the attached files match the state
   file before changing anything.
2. Implement the database schema and persistence layer only:
   - SQLAlchemy models for `User`, `Session`, `Interaction`, `MasteryState`,
     and `Subscription`
   - Alembic migrations for those five tables
   - Use the fields specified in PRD §14 as the source of truth
3. Add `docker-compose.yml` for a local development Postgres database.
4. Add connection/session management under `/gateway/db/`.
5. Add tests proving the models import cleanly and a fresh migration
   applies cleanly against the local Postgres database.
6. Validate Block 2's Definition of Done:
   - `docker compose up -d db && alembic upgrade head` succeeds from a
     fresh clone
   - all five tables exist with the PRD §14 fields
   - tests pass
7. Update MAST_BUILD_STATE.md as one of the generated files: mark Block 2
   done with a short factual summary, record any deviation or ambiguity
   and the smallest reasonable call taken, and write Block 3's full
   session-ready prompt in the "Copy This Into a New Session" section
   following this same format.
8. Give me every generated/changed file, then give me the exact git bash
   commands to run locally to add, commit, and push the work with a clear
   conventional commit message. Do not run any git command yourself.
9. Report back: what shipped, the validation results, and the exact
   Block 3 prompt.

Out of scope for Block 2: any API endpoints, FastAPI service behavior,
authentication, Redis/caching, billing, production hosting choices, and
anything from Blocks 3 onward.

Stay strictly inside Block 2. If anything is ambiguous, make the smallest
reasonable call, note it in MAST_BUILD_STATE.md, and keep moving.
```

## ✅ What's Done

Each entry records the block, date, factual summary, and any deviation from the roadmap.

| Block | Date | Summary |
|---|---|---|
| 1 | September 25, 2026 | Created the Block-1 repository structure (`/gateway`, `/extension`, `/ml`, `/docs`), copied the supplied PRD to `docs/PRD.md` and the supplied roadmap to `MAST_BUILD_ROADMAP.md` exactly, added the root README, Python/Node/OS/secret-focused `.gitignore`, minimal GitHub Actions placeholder, and MIT license placeholder. Because Git does not track empty directories, `.gitkeep` files were added only to the intentionally empty `/gateway`, `/extension`, and `/ml` directories so the required structure survives a fresh clone. The MIT copyright-holder text is provisional and should be confirmed later. No gateway, extension, ML, or CI implementation was added; Block 2 is now the next block. |

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
| 2 | Database Schema & Persistence Layer | ➡️ Next |
| 3 | Gateway Service Skeleton + Auth | ⬜ Not started |
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
