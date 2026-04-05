# content-os

A local-first **agentic content publishing system** scaffolded from `context.md`.

## What is implemented

- Monorepo workspace with three runnable apps:
  - `apps/web`: minimal UI shell
  - `apps/api`: orchestration API with in-memory session + job stores
  - `apps/mcp-blogger`: Blogger MCP-like tool service (local mock)
- Shared domain types and schemas in `packages/shared`.
- Clarification loop with structured brief updates.
- Deterministic background pipeline stages:
  - `queued`
  - `running`
  - `outlining`
  - `writing`
  - `editing`
  - `generating_linkedin`
  - `publishing_draft`
  - `completed`/`failed`
- SSE endpoint for real-time job events.

## Quick start

```bash
pnpm install
pnpm dev
```

Services:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- MCP Blogger mock: `http://localhost:4100`

## API flow (example)

1. Create session

```bash
curl -sX POST http://localhost:4000/api/sessions
```

2. Send topic / answers (prefix with field labels)

```bash
curl -sX POST http://localhost:4000/api/sessions/<sessionId>/messages \
  -H 'Content-Type: application/json' \
  -d '{"content":"audience: startup founders\ngoal: explain practical benefits\ntone: practical\nlength: medium\ndepth: intermediate\narguments: better modularity, faster publishing"}'
```

3. Start job (only when `brief.ready=true`)

```bash
curl -sX POST http://localhost:4000/api/sessions/<sessionId>/jobs
```

4. Stream status

```bash
curl -N http://localhost:4000/api/jobs/<jobId>/events
```

5. Fetch final artifacts

```bash
curl -s http://localhost:4000/api/jobs/<jobId>
```

## Notes

- Provider adapters are currently stubbed via a deterministic mock provider so the full system can run locally without external API keys.
- Blogger MCP integration is represented as a local mock server/tool surface (`list_blogs`, `create_draft_post`, `get_post`).
- Data is in-memory only for v1; restart clears sessions/jobs.
