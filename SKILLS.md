# Bitacora Agent Team — Skills & Roles

## TL;DR

The Bitacora agent team is a group of specialized AI agents that assist with different aspects of the project. Each agent has a defined role, skillset, and scope. They can be invoked from the dashboard's Create tab or via Claude Code CLI for autonomous task execution.

---

## Agents

### Baal — Full Stack Engineer

**Role:** Lead full-stack engineer responsible for both frontend (React) and backend (Express/Node.js) implementation, database work, API integration, and infrastructure.

**Scope:**
- React 19 components, hooks, views, and CSS
- Express 5 API routes, middleware, and proxy logic
- SQLite/Drizzle ORM schema, queries, and migrations
- Docker, Docker Compose, and VPS deployment
- Vite build configuration
- Authentication, session management, and credential encryption
- YouTrack, OpenAI, and Anthropic API integrations
- Responsive design (mobile-first, iPhone 16 target)
- Git workflow (feature branches, PRs, merges)

**Tech Stack:**
| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, CSS (no Tailwind) |
| Backend | Express 5, Node.js 22 |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Auth | express-session, bcryptjs, AES-256-GCM |
| Infra | Docker Compose, Caddy, Hostinger VPS |
| APIs | YouTrack REST, OpenAI Costs, Anthropic Messages |

**Conventions:**
- CSS-only theming via `:root` variables + `[data-theme="light"]`
- State management via custom hooks — no context providers or Redux
- All buttons must have explicit `type="button"` unless inside a form
- Express 5 wildcard params (`{*path}`) return arrays — always `.join("/")`
- API keys stored encrypted server-side, proxied — never in the browser
- Trust proxy must be set when behind a reverse proxy (Caddy/nginx)
- Commits include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

**Invocation:**
```bash
# From the dashboard Create tab:
# Select "Baal — Full Stack Engineer" agent, describe the task

# From Claude Code CLI:
claude --agent baal "implement the agent jobs view with WebSocket live streaming"
```

---

### PM — Product Manager
Translates business requirements into structured YouTrack tickets with acceptance criteria, compliance flags (FERPA/LFPDPPP), and effort estimates.

### iOS Sr. Developer
Creates iOS/Swift implementation tickets with architecture guidance, file paths, and test coverage expectations for the Bitacora iOS app.

### UX/UI Designer
Designs interaction flows, screen layouts, and component specifications for the bilingual (EN/ES) school incident reporting UI.

### QA Engineer
Writes structured test plans, regression checklists, and edge case scenarios. Integrates with the QA Tracker CSV pipeline.

### Data Engineer
Handles data model design, migration scripts, analytics queries, and localStorage-to-SQLite migration paths.

### Security Agent
Reviews for FERPA/LFPDPPP compliance, OWASP Top 10 vulnerabilities, credential handling, and data protection requirements.

### GTM (Go-to-Market)
Creates launch checklists, stakeholder communications, and deployment plans for school district rollouts.

### Customer Success
Writes user-facing documentation, onboarding guides, and support runbooks for school administrators and teachers.

---

## Adding New Agents

1. Define the agent in `src/constants/agents.js` (id, label, icon, color, default priority)
2. Add the system prompt in `src/constants/prompts.js`
3. Add templates in `getTemplates()` for template-based generation
4. The agent appears in the Create tab sidebar automatically

For Phase 3 orchestration agents (Docker-spawned), add:
- Agent container definition in `docker-compose.yml`
- Job handler in `server/orchestrator.js`
- Context bundle mapping in `src/constants/qaFileMap.js`
