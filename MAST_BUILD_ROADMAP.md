# MAST — Build Roadmap
### The master plan. Stable reference — doesn't change often. Pair with `MAST_BUILD_STATE.md`, which changes every session.

**Scope:** takes MAST from the research prototype (PRD §2) to the full v1 launch defined in PRD §4.3 — Managed Cloud Mode, no API key required, cross-platform, billed, packaged, and live on the Marketplace. Phase 3 items (instructor console, education partnerships, other IDEs) are intentionally **not** blocked out here — they're post-launch, see the closing note.

---

## How This System Works

Two files run this project:

- **`MAST_BUILD_ROADMAP.md`** *(this file)* — the full plan. What each of the 16 blocks covers, its boundaries, and how to know it's done. Read this once per block for the details; it rarely changes.
- **`MAST_BUILD_STATE.md`** — the live tracker. What's actually done, what's next, and — most important — the exact, fully-detailed prompt to paste into the next session. **This is the file you read first, every time.**

Each block is sized to be completable inside one focused session (one conversation, one context window) — narrow enough not to run out of budget mid-task, wide enough to be a real, shippable unit of work. Don't combine blocks to save a session unless a block's own notes say it's safe to.

---

## Persistence: Why This Has to Live in Git — and Why Claude Never Touches Git

Every fresh session — a new chat, a new sandbox — starts with an empty filesystem. Nothing from a previous session survives unless it was pushed somewhere durable. **A GitHub repo is that durable place**, and it's also where `BUILD_STATE.md` itself lives, so pulling the repo restores *both* the code *and* the instructions for what to do next, in one step.

**Claude's role in every session is generation only.** It reads the attached docs, writes the files a block calls for, and hands them back as real, downloadable files — plus the exact `git` bash commands to run. It never runs `git init`, `git add`, `git commit`, `git push`, `git clone`, or `git pull` itself, and it never needs, sees, or handles a GitHub token or any other credential. Every git operation — including the very first push in Block 1 — is run by the human, locally, using whatever auth they already have set up (SSH key, GitHub CLI, credential manager). This is deliberate: credentials stay on the human's machine, never pasted into a chat.

**One-time setup, before Block 1 ever runs:**

1. Create an empty GitHub repository (e.g. `mast`). Don't add a README/license through GitHub's UI — Block 1 creates those so there's no merge conflict on the first push.
2. Confirm you can already push to that repo from your local machine (clone it, and make sure `git push` works with whatever auth you normally use).
3. Keep the repo URL handy to paste into the *first* prompt of each session.

**Never commit a token, an `.env` file, or any real secret to the repo.** `.gitignore` is set up in Block 1 specifically to make this hard to get wrong by accident. Since Claude never sees or generates credentials, the only way a secret reaches the repo is if you paste one into a tracked file yourself — the `.gitignore` patterns are the backstop for that.

---

## Session Protocol — Follow This Every Single Block

1. Human attaches the current `BUILD_STATE.md`, `BUILD_ROADMAP.md`, and any repo files this block builds on.
2. Claude reads `BUILD_STATE.md` in full before touching anything else.
3. Claude sanity-checks that what's attached matches what `BUILD_STATE.md` claims. If they don't match, stop and flag the mismatch — don't guess and proceed.
4. Claude does **only** the block `BUILD_STATE.md` names as next, generating real files for all of it. Nothing from later blocks, even if it feels efficient to fold it in.
5. Claude validates against that block's Definition of Done (below) before calling it finished. Partial credit isn't done — see the Golden Rules.
6. Claude updates `BUILD_STATE.md`, as one of the generated files: moves the block to "What's Done" with a short factual summary (including any deviation from this roadmap, and why), then writes the *next* block's prompt in full, session-ready detail.
7. Claude hands over every generated file, plus the exact git bash commands to add, commit (with a clear, conventional message, e.g. `feat(gateway): auth service skeleton — Block 3`), and push them. Claude does not run these commands itself.
8. Human runs those commands locally, against their own clone of the repo.
9. Claude's report back: what shipped and the exact next prompt — so the human can act on it immediately or save it for the next session.

---

## Golden Rules (never violated, in any block)

- **No API key, ever, in the default flow.** This is the entire point of the redesign (PRD §6). If a block's implementation would require the end user to see or paste a key in Managed Cloud Mode, that block isn't done — it's wrong.
- **No secrets in the repo.** Ever. `.gitignore` from Block 1 exists to enforce this; check it before every commit that touches config.
- **Claude never runs git, and never handles credentials.** Every block ends with generated files and a list of git commands for the human to run — never with Claude executing `git init`/`add`/`commit`/`push`/`clone`/`pull` itself, and never with Claude holding a token or PAT.
- **Every block ends in a working, buildable state.** No "fix it next session" half-finished commits. If a block can't finish inside budget, commit only what's genuinely complete and working, mark the rest explicitly undone in `BUILD_STATE.md` with exact remaining steps — don't leave broken code disguised as done.
- **A later block cannot silently break an earlier block's Definition of Done.** If it must change earlier behavior, it updates that block's tests too and logs the change in `BUILD_STATE.md`.
- **Stay inside the block's boundary.** Scope creep between blocks is exactly what makes multi-session builds fall apart — resist "while I'm in here."

---

## All 16 Blocks at a Glance

| # | Block | Depends on | Size |
|---|---|---|---|
| 1 | Repo Bootstrap & Conventions | — | S |
| 2 | Database Schema & Persistence Layer | 1 | M |
| 3 | Gateway Service Skeleton + Auth | 2 | M/L |
| 4 | Local ML Export Pipeline (Classifier + DKT → ONNX) | 1 | M |
| 5 | Extension Scaffold + Local Classifier/DKT Inference | 1, 4 | M |
| 6 | Local Embeddings & Mastery-Gated Retrieval | 5 | M |
| 7 | Extension Auth Flow + Gateway API Client + BYOK | 3, 5 | M |
| 8 | Gateway Socratic Generation Chain | 3 | L |
| 9 | Constitutional Verify + Regeneration + Quota Middleware | 8 | M/L |
| 10 | Chat Panel Webview | 6, 7, 9 | M |
| 11 | Knowledge Map Webview + Error Capture Command | 5, 7, 10 | M |
| 12 | Billing (Stripe) & Quota Enforcement | 3, 9 | M/L |
| 13 | Observability & Telemetry | 9 | S/M |
| 14 | Packaging & Marketplace Listing | 10, 11 | S/M |
| 15 | QA & Regression Validation | all | M |
| 16 | Launch Checklist & Go-Live | 15 | S |

Blocks 1–4 have some internal reordering flexibility (4 only truly depends on 1); everything from Block 5 onward should run in order.

---

## Milestone A — Foundation

### Block 1 — Repo Bootstrap & Conventions
**Depends on:** nothing · **Size:** S

**In scope**
- Folder structure: `/gateway`, `/extension`, `/ml`, `/docs`
- `docs/PRD.md` — the already-written PRD, placed as-is
- `BUILD_ROADMAP.md` and `BUILD_STATE.md` at repo root (placed as-is, not regenerated)
- Root `README.md` — project summary, links to the three docs above
- `.gitignore` — Python, Node, OS cruft, and explicitly `.env`, `*.key`, common secret patterns
- Minimal GitHub Actions placeholder (lint/test stubs — doesn't need real logic yet)
- `LICENSE` — pick a placeholder (e.g. MIT) and flag it as confirmable later; don't block on it

**Out of scope:** any gateway/extension code, real CI logic, final Marketplace publisher name

**Definition of Done**
- [ ] The generated files reproduce the exact structure above
- [ ] The git bash commands Claude hands over, once run locally by the human, produce one clean initial commit
- [ ] `BUILD_STATE.md` updated: Block 1 done, Block 2 fully detailed as next

---

### Block 2 — Database Schema & Persistence Layer
**Depends on:** Block 1 · **Size:** M

**In scope**
- SQLAlchemy models + Alembic migrations for: `User`, `Session`, `Interaction`, `MasteryState`, `Subscription` (fields per PRD §14)
- `docker-compose.yml` for a local dev Postgres
- Connection/session management module in `/gateway/db/`
- Tests: models import cleanly; migration applies cleanly against a fresh local Postgres

**Out of scope:** any API endpoints (Block 3), Redis/caching (Block 9/12), production hosting choice (PRD §21, TBD)

**Definition of Done**
- [ ] `docker compose up -d db && alembic upgrade head` succeeds from a fresh clone
- [ ] All 5 tables exist with PRD §14 fields
- [ ] Tests pass

---

### Block 3 — Gateway Service Skeleton + Auth
**Depends on:** Block 2 · **Size:** M/L

**In scope**
- FastAPI skeleton in `/gateway/app/`, config read from server-side environment variables only
- `/v1/health`
- GitHub OAuth token exchange endpoint (extension hands it a GitHub token from VS Code's Authentication API; Gateway verifies and issues its own short-lived JWT + refresh token)
- JWT issuance/verification middleware; create-on-first-signin against the `User` table
- Structured logging baseline (request id, user id, latency — no secrets, ever)

**Out of scope:** Google OAuth (fast-follow, not a blocker), billing/quota (Block 12), chat/LLM endpoints (Blocks 8–9)

**Definition of Done**
- [ ] `uvicorn` boots locally against the Block-2 DB
- [ ] `/v1/health` → 200
- [ ] Mocked OAuth exchange test proves a JWT is issued and a `User` row is created

---

### Block 4 — Local ML Export Pipeline (Classifier + DKT → ONNX)
**Depends on:** Block 1 · **Size:** M

**In scope**
- `/ml/export/` scripts loading the trained sklearn classifier and PyTorch DKT LSTM, exporting both to ONNX
- **If the trained weights themselves weren't provided** (only the report was) — this block includes retraining from scratch using the parameters documented in PRD §2.6 and the original report's bug-fix table (p_slip=0.02, p_guess=0.05, 200 steps/student, hidden=256/embed=64, clustered+prerequisite-aware sampling); flag this explicitly in `BUILD_STATE.md` if it happens, since it changes this block's real size from M to L
- Node.js smoke test proving both ONNX models load with correct output shapes (8-class; 30-dim sigmoid)
- Document the DKT hidden-state serialization format (needed by Blocks 2/6)

**Out of scope:** wiring into the extension (Block 5), improving model quality beyond documented benchmarks

**Definition of Done**
- [ ] Both models load in a Node.js smoke test with correct output shapes
- [ ] Spot-checked against PRD §2.4 benchmarks (Val AUC ≥ 0.90, F1-macro ≥ 0.87) on available holdout data

---

## Milestone B — Local Inference in the Extension

### Block 5 — Extension Scaffold + Local Classifier/DKT Inference
**Depends on:** Blocks 1, 4 · **Size:** M

**In scope**
- `/extension/` TypeScript scaffold (manifest, activation events, `package.json`)
- `onnxruntime-node` running the Block-4 artifacts in-process
- `classifyError()` / `updateMastery()` module
- Offline unit tests on sample error strings (no network calls made — verify this explicitly)

**Out of scope:** any webview UI (Blocks 10–11), embeddings/retrieval (Block 6), Gateway calls (Block 7)

**Definition of Done**
- [ ] `npm test` passes with zero network activity
- [ ] Classification latency stays in the ~5–10ms range (PRD §9)

---

### Block 6 — Local Embeddings & Mastery-Gated Retrieval
**Depends on:** Block 5 · **Size:** M

**In scope**
- Reference-document corpus ported from the prototype's ChromaDB content into a bundled, portable format
- `@xenova/transformers` running all-MiniLM-L6-v2 fully client-side
- Lightweight local vector index + cosine similarity search
- Difficulty-ceiling filter (`0.4 + mastery × 0.6`) and difficulty-proximity re-ranking, exactly per PRD §7.2 / FR-E2

**Out of scope:** corpus content expansion beyond porting what exists; any server-side retrieval fallback (local-only by design, PRD §6.5)

**Definition of Done**
- [ ] Retrieval returns correctly filtered, correctly ranked results across a spread of mastery levels in tests
- [ ] Fully offline; latency near the ~80ms/query prototype figure

---

### Block 7 — Extension Auth Flow + Gateway API Client + BYOK
**Depends on:** Blocks 3, 5 · **Size:** M

**In scope**
- VS Code Authentication API (GitHub) → exchange with Block 3's endpoint → MAST JWT stored securely
- Typed Gateway API client module, extended as later blocks add endpoints
- `MAST: Configure API Key` / `MAST: Clear API Key` commands via `SecretStorage` (FR-G1–G3)
- Clean Managed-Cloud-vs-BYOK mode toggle for Blocks 8–9 to branch on

**Out of scope:** actual chat functionality (needs Blocks 8–9), visual polish (Blocks 10–11)

**Definition of Done**
- [ ] Sign-in completes against a locally-running Block-3 Gateway (manual test)
- [ ] BYOK key round-trips through `SecretStorage`: set → read → clear
- [ ] Explicit check: zero plaintext key storage anywhere on disk

---

## Milestone C — Cloud Generation Pipeline

### Block 8 — Gateway Socratic Generation Chain
**Depends on:** Block 3 · **Size:** L

**In scope**
- Port the prototype's LangChain LCEL Socratic chain server-side, using MAST-held keys (Anthropic primary, OpenAI as a configured alternative — server routing only, no client input)
- `/v1/chat` (generation only at this stage; auth-gated via Block 3's JWT)
- Keep the provider abstraction real — don't hard-code a single vendor path (PRD §3, principle 4)

**Out of scope:** constitutional verification (Block 9, deliberately split), quota/billing (Block 12)

**Definition of Done**
- [ ] Authenticated request produces a Socratic-style response via a real or sandboxed provider call
- [ ] Unauthenticated request → clean 401

---

### Block 9 — Constitutional Verify + Regeneration + Quota Middleware
**Depends on:** Block 8 · **Size:** M/L

**In scope**
- Constitutional checker + 2-attempt regeneration cap, wired after generation in `/v1/chat`
- Trigger/regeneration logging per interaction (feeds the 8.3%/0.7% monitoring baseline, PRD §16–17)
- Quota-check middleware *mechanism* (counting/limiting logic) — real tier enforcement plugs in at Block 12

**Out of scope:** Stripe itself (Block 12), dashboards (Block 13)

**Definition of Done**
- [ ] A deliberately "direct-answer" response is caught and regenerated in a test
- [ ] Trigger/regen outcome logged per interaction
- [ ] Full `/v1/chat` round trip matches the architecture in PRD §7.1

---

## Milestone D — User-Facing Surfaces

### Block 10 — Chat Panel Webview
**Depends on:** Blocks 6, 7, 9 · **Size:** M

**In scope**
- Rebuild the Chat UI: message thread, mastery %/session-active badges, input box, two follow-up suggestion buttons, "Resolved" action
- Wire: local classification (5) → local retrieval (6) → Gateway `/v1/chat` (8–9) → render

**Out of scope:** Knowledge Map tab (Block 11), billing upgrade UI (Block 12 — leave an obvious extension point)

**Definition of Done**
- [ ] End-to-end manual test: paste an error → genuinely Socratic response → mark resolved
- [ ] Confirm nothing in this block spawns a local subprocess/server

---

### Block 11 — Knowledge Map Webview + Error Capture Command
**Depends on:** Blocks 5, 7, 10 · **Size:** M

**In scope**
- Knowledge Map: 30-KC cards, mastery bars, red/yellow/green bands per original thresholds
- `mast.runCode`: execute active Python file, auto-capture stderr, feed into the same pipeline as the Chat panel

**Out of scope:** cross-device sync polish beyond what Blocks 2–3 already provide

**Definition of Done**
- [ ] Known error type updates the correct KC cards with the correct color band
- [ ] Full manual loop: run buggy code → auto-captured → Socratic question → resolved → mastery visibly updates

---

## Milestone E — Monetization & Operations

### Block 12 — Billing (Stripe) & Quota Enforcement
**Depends on:** Blocks 3, 9 · **Size:** M/L

**In scope**
- Stripe products/prices for Free/Pro (placeholder price IDs — exact pricing is a PRD §21 open question, not this block's job to settle)
- `/v1/billing/checkout` + `/v1/billing/webhook`
- Wire real subscription state into Block 9's quota middleware
- In-panel, non-destructive upgrade prompt on quota exhaustion (FR-H2 — session must not be lost)

**Out of scope:** team/seat billing (Phase 3, out of this build sequence)

**Definition of Done**
- [ ] Simulated webhook correctly upgrades a test account and lifts quota
- [ ] Hitting the free cap shows the upgrade prompt without losing the in-progress session

---

### Block 13 — Observability & Telemetry
**Depends on:** Block 9 · **Size:** S/M

**In scope**
- Finalize structured logging per PRD §16 (classification category, KCs touched, mastery delta, hint depth, constitutional outcome, latency breakdown)
- Minimal metrics view (internal endpoint or lightweight dashboard) tracking LVM, resolution rate, constitutional trigger rate against PRD §2.4/§17 baselines
- Extension-side opt-in telemetry toggle in Settings

**Out of scope:** full alerting/on-call tooling (PRD §21 — an org decision, not a build task)

**Definition of Done**
- [ ] A test interaction logs every field PRD §16 specifies
- [ ] Rolling LVM/resolution-rate numbers are queryable from stored `Interaction` rows

---

### Block 14 — Packaging & Marketplace Listing
**Depends on:** Blocks 10, 11 · **Size:** S/M

**In scope**
- `vsce`/`ovsx` packaging, semver, icon, README, CHANGELOG
- Publish to VS Code Marketplace **and** Open VSX (PRD §12 — Open VSX matters for Cursor/VSCodium users)
- First-run Walkthrough content matching PRD §6.4's exact flow

**Out of scope:** marketing site/landing page (separate workstream if wanted)

**Definition of Done**
- [ ] `.vsix` installs cleanly on at least two of Windows/macOS/Linux
- [ ] Walkthrough completes in ≤5 steps, ending at a working first Socratic question, zero API-key prompts anywhere in the default path

---

## Milestone F — Validation & Launch

### Block 15 — QA & Regression Validation
**Depends on:** everything above · **Size:** M

**In scope**
- Full PRD §17 gate check: DKT Val AUC ≥ 0.90, classifier F1-macro ≥ 0.87, production LVM/resolution rate measured against the 1.04 / 71% prototype benchmarks
- Constitutional red-teaming: deliberately try to elicit direct answers; measure leakage against a target stricter than the prototype's 0.7% residual
- Basic Gateway load test
- Cross-platform smoke test of install → sign-in → first question, on Win/macOS/Linux

**Out of scope:** fixing every issue found — this block finds and logs them; fixes may become their own follow-up blocks

**Definition of Done**
- [ ] Every PRD §17 gate has a real recorded pass/fail number, not an estimate

---

### Block 16 — Launch Checklist & Go-Live
**Depends on:** Block 15 passing · **Size:** S

**In scope**
- Final pass against PRD §9 (NFRs) and §10 (security/privacy checklist)
- Confirm status of legal review (privacy policy/ToS — a non-engineering dependency to close, not draft here)
- Flip the switch: Marketplace listing and billing go live

**Definition of Done**
- [ ] Every PRD §4.3 "in scope for v1" item is shipped and verified
- [ ] `BUILD_STATE.md` marked 16/16 complete

---

## After Block 16: Phase 3

Instructor console, education/bootcamp partnerships, JetBrains/other-IDE evaluation, additional languages — these are PRD §4.2 non-goals for v1 by design. Don't block them out in detail until v1 is actually live; re-planning them now would be guessing against a product that doesn't have real usage data yet. When the time comes, this same block system applies — just start a new roadmap section.
