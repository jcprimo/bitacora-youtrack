# Bitacora YouTrack Integration

A purpose-built YouTrack integration tool for **Bitacora**, a bilingual (EN/ES) iOS app for student behavioral incident reporting in US and Mexico schools.

Manage YouTrack tickets through an agent-based workflow with AI-assisted or template-based ticket generation, inline stage/priority updates, and dual FERPA + LFPDPPP compliance awareness.

## Features

- **Full CRUD** — Create, read, update, and delete YouTrack tickets
- **8 Specialized Agents** — PM, iOS Sr. Developer, UX/UI, QA, Data, Security, GTM, Customer Success — each with tailored prompts and templates
- **AI-Assisted Generation** — Claude-powered ticket creation with structured output (summary, description, compliance flags, effort estimate)
- **Template Generation** — Structured ticket templates per agent, no API key required
- **Inline Stage & Priority** — Update ticket workflow stage and priority directly from the board
- **Dual Compliance** — FERPA (US) and LFPDPPP (Mexico) risk flagging built into every agent
- **Token Estimates** — See estimated token usage and cost before generating with AI

## Quick Start

```bash
# 1. Clone
git clone https://github.com/jcprimo/reporta-youtrack.git
cd reporta-youtrack

# 2. Configure
cp .env.example .env
# Edit .env with your YouTrack token and (optionally) Anthropic API key

# 3. Install & run
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_YT_URL` | Yes | YouTrack instance URL (e.g. `https://your-instance.youtrack.cloud`) |
| `VITE_YT_TOKEN` | Yes | YouTrack permanent token ([generate one here](https://www.jetbrains.com/help/youtrack/server/Manage-Permanent-Token.html)) |
| `VITE_YT_PROJECT_ID` | Yes | YouTrack project ID (e.g. `0-1`) |
| `VITE_ANTHROPIC_KEY` | No | Anthropic API key for AI-assisted ticket generation |

## Docker

```bash
# Build
docker build -t bitacora-youtrack .

# Run (pass your YouTrack URL for the API proxy)
docker run -p 8080:8080 \
  -e YOUTRACK_URL=https://your-instance.youtrack.cloud \
  bitacora-youtrack
```

Open [http://localhost:8080](http://localhost:8080).

> **Note:** The Docker image serves the built static app via nginx. The YouTrack token and Anthropic key are set in the browser at runtime (entered by the user or baked into the build via `VITE_*` env vars at build time).

## Project Structure

```
├── src/
│   ├── App.jsx            # Main app — board, create, and detail views
│   ├── App.css            # Styles
│   ├── youtrack.js        # YouTrack API service layer
│   ├── youtrack.test.js   # Unit tests (node:test)
│   ├── youtrack.e2e.test.js # E2E tests (against real YouTrack)
│   ├── main.jsx           # Entry point
│   └── index.css          # Base styles
├── public/
│   └── favicon.svg
├── Dockerfile             # Multi-stage build (Node → nginx)
├── nginx.conf             # Production proxy config
├── vite.config.js         # Dev server + YouTrack API proxy
├── .env.example           # Template for environment variables
└── package.json
```

## Testing

```bash
# Unit tests
npm test

# E2E tests (against a real YouTrack instance)
YOUTRACK_E2E=1 YOUTRACK_TOKEN=your-token npm test
```

## Tech Stack

- **React 19** + **Vite 8**
- **Anthropic Claude API** (claude-sonnet-4-20250514) for AI generation
- **nginx** (production container)
- **YouTrack REST API**

## Authors

Built collaboratively by:

- **Primo** ([@jcprimo](https://github.com/jcprimo)) — Product vision, architecture, and engineering
- **Claude** ([Anthropic](https://anthropic.com)) — AI pair programmer (Claude Opus 4.6)

## License

MIT
