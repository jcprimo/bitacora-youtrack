# Phase 3 — Agent Orchestration

## TL;DR

Build the orchestration layer to dispatch isolated Claude Code agents (Baal, iOS Sr. Developer, QA Testing) in parallel Docker containers using git worktrees. Each agent gets its own branch off `master`, works independently, and pushes results to a review queue. QA runs its own test server to execute test cases against the iOS app and web viewer. The dashboard streams agent output in real-time via WebSocket and lets you approve before merging. DB tables already exist from Phase 1.

---

**Title:** Agent Orchestration — parallel containers, git worktrees, QA test server, live streaming, and review pipeline

**Priority:** Major

**Effort:** XL

---

## Summary

Build the agent orchestration layer on top of the Phase 1/2 backend (Express + SQLite + auth). The dashboard becomes the control center for dispatching, monitoring, and reviewing agent work across the Bitacora platform.

## Platform Repos

All repos use `master` as the default branch.

| Repo | Purpose | Stack | Agents |
|------|---------|-------|--------|
| `bitacora-app-dashboard` | Ops dashboard (this project) | React + Express + SQLite | Baal |
| `bitacora-app` | iOS app (currently `student-reports-ios`, pending rename) | Swift/SwiftUI, MVVM, Core Data | iOS Sr. Developer |
| `bitacora-viewer` | Web app for viewing reports | Web app | Baal |

## Prerequisites (already done)

- [x] Express backend with SQLite (Phase 1)
- [x] Session auth + encrypted credentials (Phase 2)
- [x] DB tables `agent_jobs` and `agent_logs` already created
- [x] Baal agent defined with prompt, template, and SKILLS.md
- [x] Agent-shared repo planned for cross-project agent configs

## Core Agents

| Agent | Role | Container | Repos | Conflict Risk |
|-------|------|-----------|-------|---------------|
| **Baal** | Full Stack Engineer | Claude Code CLI | `bitacora-app-dashboard`, `bitacora-viewer` | High — touches everything |
| **iOS Sr. Developer** | Swift/SwiftUI | Claude Code CLI | `bitacora-app` | Medium — scoped to Swift files |
| **QA Testing** | Test creation + execution | Claude Code CLI + test server | All repos (read) + own test server | Low — isolated test environment |

Non-code agents (PM, UX, Security, etc.) generate tickets only — no container needed, they run inline via the Anthropic API.

---

## Deliverables

### 1. Git Worktree Isolation

Each code-modifying agent gets its own git worktree so they never conflict:

```bash
# Orchestrator creates isolated workspaces per job
# All branches fork from master (project standard)
git worktree add /tmp/agent-baal-job-42 -b agent/baal/job-42 master
git worktree add /tmp/agent-ios-job-43 -b agent/ios/job-43 master
git worktree add /tmp/agent-qa-job-44 -b agent/qa/job-44 master
```

- Each agent works on its own branch forked from `master`
- No merge conflicts between parallel agents
- Results are reviewed as PRs before merging to `master`
- Worktrees are cleaned up after job completion

### 2. Docker Container Per Agent

```dockerfile
# agents/Dockerfile.claude
FROM node:22-alpine
RUN npm install -g @anthropic-ai/claude-code
WORKDIR /workspace
# Worktree mounted as volume
CMD ["claude", "-p", "$AGENT_PROMPT", "--output-format", "json"]
```

Each container gets:
- Git worktree mounted as a volume (`/workspace`)
- Agent-specific system prompt + context bundle
- Anthropic API key (injected as env var)
- Scoped file access (iOS agent only sees `*.swift`, Baal sees everything)
- Resource limits (CPU, memory, timeout)

### 3. QA Test Server

The QA agent is different from Baal and iOS — it doesn't just write code. It **creates test cases AND executes them** against running instances of the app.

#### QA Server Architecture

```
┌──────────────────────────────────────────────────┐
│  QA Agent Container                               │
│                                                   │
│  ┌─────────────────┐   ┌──────────────────────┐  │
│  │ Claude Code CLI  │   │ QA Test Server       │  │
│  │                  │   │ (Node.js + Playwright)│  │
│  │ 1. Reads ticket  │   │                      │  │
│  │ 2. Reads QA CSV  │──▶│ 3. Generates tests   │  │
│  │ 3. Writes tests  │   │ 4. Runs against:     │  │
│  │ 4. Triggers run  │   │    - bitacora-viewer  │  │
│  │ 5. Reports       │   │    - bitacora-app     │  │
│  │    results       │   │      (via simulator)  │  │
│  └─────────────────┘   └──────────────────────┘  │
└──────────────────────────────────────────────────┘
```

#### QA Workflow

1. **Receive task** — ticket or QA CSV test case with scenario description
2. **Generate test cases** — Claude writes Playwright tests (web) or XCUITest stubs (iOS)
3. **Execute tests** against:
   - `bitacora-viewer` — Playwright runs against a staging/preview URL
   - `bitacora-app` — XCUITest via iOS Simulator (requires macOS runner) or API-level tests
4. **Collect results** — pass/fail per test case, screenshots on failure, logs
5. **Report back** — updates the QA Tracker in the dashboard, creates bug tickets for failures
6. **Push test files** — committed to the repo on its own branch for review

#### QA Server Stack

| Component | Purpose |
|-----------|---------|
| Playwright | E2E testing for `bitacora-viewer` (web) |
| Test runner (Node.js) | Orchestrates test execution, collects results |
| Screenshot capture | Visual evidence on test failure |
| Result reporter | Updates `qa_test_cases` table + creates YouTrack tickets |
| Staging URL config | Points tests at preview/staging deployments |

#### QA Agent Modes

| Mode | Trigger | What it does |
|------|---------|-------------|
| **On-demand** | Manual dispatch from dashboard | Runs specific test cases or full regression |
| **Post-deploy** | After `restart-bitacora.sh` completes | Smoke test the deployment |
| **Nightly regression** | Cron (scheduled) | Full test suite against staging |
| **Pre-merge** | PR created by Baal or iOS agent | Validates the PR branch before approval |

### 4. Job Queue & Orchestrator

```
Dashboard (React)
  │ "Dispatch Baal: implement WebSocket streaming"
  ▼
Express Orchestrator
  │ 1. Creates agent_job record (status: queued)
  │ 2. Determines target repo (dashboard, app, viewer)
  │ 3. Creates git worktree on isolated branch from master
  │ 4. Builds context bundle (ticket + relevant files + QA cases)
  │ 5. Spawns Docker container with worktree mounted
  │ 6. Streams stdout via WebSocket to dashboard
  │ 7. On completion: collects result, updates status, notifies
  ▼
┌────────────────────────────────┐
│ Docker: baal-job-42            │
│ - /workspace (git worktree)    │
│ - claude -p "implement..."     │
│ - commits to agent/baal/job-42 │
│ - pushes branch                │
└────────────────────────────────┘
  │ result
  ▼
Review Queue → Diff View → Approve → Create PR → Merge to master
```

### 5. Live Streaming (WebSocket)
- WebSocket server on Express (`server/ws.js`)
- Per-job log channel — dashboard subscribes by job ID
- Streams agent stdout/stderr line by line
- Auto-scroll with pause-on-hover
- Connection resilience (reconnect on drop, replay missed logs from `agent_logs` table)

### 6. Result Review Queue
- Agent pushes commits to its feature branch
- Dashboard shows a diff view (files changed, lines added/removed)
- User approves → orchestrator creates a GitHub PR targeting `master` via `gh` CLI
- User rejects → branch deleted, worktree cleaned up
- One-click "approve + merge" for fast iteration
- QA agent results show pass/fail table + failure screenshots

### 7. Agent Control Panel (React view)
- New "Agents" tab in the dashboard
- Job list with status badges (queued, running, done, failed)
- Start/stop/retry controls
- Live terminal viewer per job (WebSocket stream)
- Agent spend summary (cost per job from `ai_usage` table)
- Parallel job indicator (show which agents are currently active across repos)
- QA results panel (pass/fail counts, failure screenshots, test duration)

### 8. Cost Controls
- Per-agent spend limits enforced server-side before spawning
- Per-job timeout (kill container after N minutes)
- Dashboard alert when approaching limit
- Job cost estimated before dispatch (token count x model price)

### 9. Scheduling
- Cron-based QA runs (nightly regression, pre-release sweeps)
- Post-deploy smoke tests (triggered by `restart-bitacora.sh`)
- Scheduled Baal tasks (dependency updates, linting, refactoring)
- Configurable from the dashboard

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Bitacora Dashboard (React)                              │
│  ┌─────────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ Agent Panel  │  │ Live Log │  │ Review Queue       │ │
│  │ dispatch/    │  │ viewer   │  │ diff + approve     │ │
│  │ stop/retry   │  │ (WS)    │  │ → create PR        │ │
│  │              │  │          │  │ QA: pass/fail table │ │
│  └──────┬──────┘  └────┬─────┘  └───────┬────────────┘ │
└─────────┼──────────────┼────────────────┼───────────────┘
          │ REST API     │ WebSocket      │ REST API
┌─────────▼──────────────▼────────────────▼───────────────┐
│  Express Backend (Orchestrator)                          │
│  ├── server/routes/jobs.js     (CRUD, dispatch)          │
│  ├── server/orchestrator.js    (spawn, stream, collect)  │
│  ├── server/ws.js              (WebSocket hub)           │
│  ├── server/context-builder.js (prompt assembly)         │
│  ├── server/worktree.js        (git worktree mgmt)       │
│  └── server/qa-runner.js       (QA test execution mgmt)  │
│                                                          │
│  SQLite: agent_jobs, agent_logs, ai_usage, qa_test_cases │
└───────────────────┬──────────────────────────────────────┘
                    │ docker run / docker exec
       ┌────────────┼────────────┐
       ▼            ▼            ▼
 ┌──────────┐ ┌──────────┐ ┌─────────────────────┐
 │  Baal    │ │  iOS Sr  │ │  QA Testing          │
 │          │ │          │ │                       │
 │ repos:   │ │ repo:    │ │ Claude + Test Server  │
 │ dashboard│ │ bitacora-│ │ ┌───────────────────┐ │
 │ viewer   │ │ app      │ │ │ Playwright        │ │
 │          │ │          │ │ │ (bitacora-viewer)  │ │
 │ worktree │ │ worktree │ │ │                   │ │
 │ mounted  │ │ mounted  │ │ │ XCUITest stubs    │ │
 └──────────┘ └──────────┘ │ │ (bitacora-app)    │ │
  agent/       agent/       │ └───────────────────┘ │
  baal/        ios/         │ test results → DB     │
  job-42       job-43       └─────────────────────┘
                             agent/qa/job-44
```

---

## Backend Work

| Task | Details |
|------|---------|
| `server/routes/jobs.js` | CRUD for agent_jobs, dispatch endpoint, cancel/retry |
| `server/orchestrator.js` | Spawns containers, manages lifecycle, streams output |
| `server/ws.js` | WebSocket server attached to Express, per-job channels |
| `server/worktree.js` | Create/cleanup git worktrees per repo, branch from `master` |
| `server/context-builder.js` | Assembles prompt from ticket + files + QA cases + SKILLS.md |
| `server/qa-runner.js` | Manages QA test execution, result collection, screenshot storage |
| `agents/Dockerfile.claude` | Claude Code container image |
| `agents/Dockerfile.qa` | QA container image (Claude Code + Playwright + test runner) |
| `agents/docker-compose.agents.yml` | Agent container definitions with resource limits |

## Frontend Work

| Task | Details |
|------|---------|
| `src/views/AgentsView.jsx` | Job list, dispatch form (repo selector), controls, live terminal |
| `src/hooks/useAgentJobs.js` | Job CRUD + WebSocket connection for live logs |
| `src/components/DiffViewer.jsx` | Side-by-side diff view for agent results |
| `src/components/ReviewModal.jsx` | Approve/reject agent output, create PR to `master` |
| `src/components/QAResultsPanel.jsx` | Pass/fail table, failure screenshots, test duration |
| New tab in App.jsx | "Agents" tab wired to AgentsView |

---

## Acceptance Criteria

- [ ] Can dispatch Baal/iOS/QA agent jobs from the dashboard
- [ ] Dispatch form includes repo selector (dashboard, app, viewer)
- [ ] Each agent runs in an isolated Docker container with its own git worktree
- [ ] Worktrees branch from `master` (project standard)
- [ ] Multiple agents can run in parallel without code conflicts
- [ ] Job status updates live via WebSocket (queued → running → done)
- [ ] Agent stdout streams to the dashboard terminal viewer in real-time
- [ ] Completed job shows diff of files changed
- [ ] Approved result creates a GitHub PR targeting `master` via `gh` CLI
- [ ] Rejected result cleans up branch and worktree
- [ ] Failed jobs show error logs and can be retried
- [ ] Job history persisted in `agent_jobs` table with repo reference
- [ ] Cost tracked per job in `ai_usage` table
- [ ] Per-agent timeout kills container after configurable limit
- [ ] Agents can work across multiple repos (agent-shared config)
- [ ] QA agent generates Playwright tests for `bitacora-viewer`
- [ ] QA agent executes tests against staging URL and reports results
- [ ] QA test results update `qa_test_cases` table with pass/fail status
- [ ] QA failures auto-create bug tickets in YouTrack
- [ ] QA can run post-deploy smoke tests and nightly regression

---

## Decision Points

### Path A: Claude Code CLI in Containers
- **Pros:** Battle-tested, full Claude Code capabilities (file editing, bash, etc.), simple to containerize
- **Cons:** Requires Claude Max subscription or API key per concurrent session, CLI output parsing needed, heavier containers (~500MB+)
- **Cost:** ~$0.05-0.50 per agent job (depends on task complexity and model)

### Path B: Claude Agent SDK (Programmatic)
- **Pros:** Lighter weight, structured JSON responses, finer control over tool use, cheaper per call
- **Cons:** Less autonomous (you define the tools), more code to write, no built-in file editing
- **Cost:** Direct API pricing ($3/$15 per MTok for Sonnet, more for Opus)

### Path C: Hybrid (Recommended)
- **Baal & iOS** → Claude Code CLI in containers (they need full file editing + bash)
- **QA Testing** → Claude Code CLI + Playwright test server (needs to write tests AND run them)
- **PM, Security, etc.** → Inline API calls (already working in Create tab)

### Critical Questions Before Starting

1. **Compute budget:** Your Hostinger VPS — how much RAM/CPU does it have? Each Claude Code container needs ~512MB RAM. Running 3 in parallel = ~1.5GB just for agents. The QA container with Playwright needs more (~1GB for headless Chromium).

2. **API costs:** Are you on Claude Max ($100/mo unlimited) or pay-per-use API? Three concurrent agents on pay-per-use could cost $5-50/day depending on task complexity.

3. **QA test targets:** Does the QA agent test against production URLs, a staging environment, or locally spun-up instances? If staging, do you have separate staging deployments for `bitacora-viewer` and `bitacora-app`?

4. **iOS testing depth:** Should QA run XCUITest on an iOS Simulator (requires macOS, not possible on Linux VPS) or stick to API-level testing + Playwright for the web viewer? A macOS CI runner (GitHub Actions, etc.) may be needed for real iOS testing.

5. **Review bottleneck:** If 3 agents produce PRs simultaneously, who reviews? Is auto-merge acceptable for low-risk changes (QA test plans, docs), with manual review only for code changes?

6. **Failure handling:** When an agent fails mid-task (API timeout, bad output), should it auto-retry with the same prompt, retry with a modified prompt, or just fail and notify?

7. **Shared state:** If Baal modifies `App.jsx` and iOS agent modifies Swift files at the same time, they won't conflict (different repos). But if both Baal jobs target the same repo (`dashboard` + `viewer`), the orchestrator should serialize or detect conflicts.

8. **Agent memory:** Should agents have access to the lessons_learned memory and SKILLS.md? This means mounting the agent-shared repo into each container.

9. **`student-reports-ios` rename timeline:** When will this rename to `bitacora-app`? The orchestrator needs to know the correct repo name for worktree creation and PR targeting.

---

## When to Upgrade from SQLite

Move to Postgres when any of these become true:
- Multiple VPS instances (horizontal scaling)
- >50 concurrent users
- Agent jobs need row-level locking for concurrent workers
- Full-text search across agent logs
- QA test result storage exceeds SQLite's practical limits (~1GB)

Drizzle ORM makes this a config change, not a rewrite.

---

## Suggested Implementation Order

| Step | What | Effort | Depends On |
|------|------|--------|------------|
| 1 | `server/worktree.js` — git worktree create/cleanup, multi-repo | S | — |
| 2 | `agents/Dockerfile.claude` — Claude Code container | S | — |
| 3 | `server/orchestrator.js` — spawn + collect | M | 1, 2 |
| 4 | `server/routes/jobs.js` — CRUD + dispatch API with repo selector | M | 3 |
| 5 | `server/ws.js` — WebSocket log streaming | M | 3 |
| 6 | `src/views/AgentsView.jsx` — control panel + terminal | M | 4, 5 |
| 7 | `src/components/DiffViewer.jsx` — result diff view | M | 6 |
| 8 | `src/components/ReviewModal.jsx` — approve → PR to `master` | M | 7 |
| 9 | Cost controls + timeouts | S | 4 |
| 10 | `agents/Dockerfile.qa` — QA container with Playwright | M | 2 |
| 11 | `server/qa-runner.js` — test execution + result collection | L | 10, 3 |
| 12 | `src/components/QAResultsPanel.jsx` — pass/fail + screenshots | M | 11, 6 |
| 13 | Post-deploy smoke tests (triggered by restart script) | S | 11 |
| 14 | Scheduling (cron) — nightly regression | S | 11 |
| 15 | Multi-repo support (dashboard, app, viewer) | M | 3 |
| 16 | Agent-shared repo integration | S | 15 |
| 17 | Rename `student-reports-ios` → `bitacora-app` | S | — |

Steps 1-8 form the MVP (agents + review). Steps 10-14 add QA test execution. Steps 15-17 complete multi-repo support.
