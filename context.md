# Agentic Content Publishing System

## Goal

Build a local-first app that helps a user go from a vague article idea to a fully written blog draft published to dev.to as a draft through an MCP server, while also generating a LinkedIn draft version of the same content.

The first version should keep the system simple:

- No local database yet.
- One UI for conversation, progress, and results.
- One orchestration backend.
- One background job worker.
- One dev.to MCP server.
- Support for multiple model providers: local Llama, OpenAI, or Anthropic.
- Draft publishing only for dev.to.
- LinkedIn output is generated as text for the user to copy.

This system should be designed so that it can later grow into:

- a multi-provider publishing platform,
- a multi-channel content ops product,
- a local or cloud deployment,
- a database-backed content workspace,
- richer user memory and brand voice,
- analytics, SEO scoring, image generation, and scheduling.

***

## Product Summary

The user enters a topic they want to write about.

The app starts a structured back-and-forth clarification loop to collect missing context such as audience, tone, desired length, point of view, technical depth, examples, CTA, and constraints.

Once the system decides the brief is complete enough, it starts a background task that:

1. Freezes the brief.
2. Creates an outline.
3. Writes the article.
4. Edits and formats the article for dev.to.
5. Publishes the result as a dev.to draft through the dev.to MCP server.
6. Generates a LinkedIn draft post based on the article.
7. Returns the dev.to draft link and LinkedIn draft text to the UI.

The user should be able to watch status updates in real time.

***

## Non-Goals for V1

Do not build these in v1 unless they come for free:

- No full multi-user auth system.
- No team collaboration.
- No scheduling engine.
- No analytics dashboard.
- No WordPress/Ghost/Medium support yet.
- No local database yet.
- No automatic LinkedIn publishing yet.
- No image generation pipeline yet.
- No retrieval of old articles from dev.to yet.
- No full agent swarm with uncontrolled autonomy.

The v1 should feel robust, but it should stay narrow.

***

## Core Product Principles

### 1. Deterministic pipeline over agent chaos

The system can internally use agent-like roles such as clarifier, planner, writer, editor, and publisher, but each stage should have bounded responsibilities and typed inputs/outputs.

Avoid a free-form autonomous multi-agent system in v1. Use a staged orchestration flow.

### 2. Provider-agnostic model layer

The rest of the system must not care whether the user selected:

- local Llama,
- OpenAI,
- Anthropic.

All providers should implement the same interface.

### 3. MCP isolation for publishing

The app backend should not directly implement dev.to logic in the orchestration layer.

All dev.to publishing should happen through a separate dev.to MCP server. This keeps the system modular and makes it easy to add other publishing targets later.

### 4. Local-first developer experience

A user should be able to clone the repo, fill `.env`, run a few commands, connect a model provider and dev.to, and use the app locally.

### 5. Human-in-the-loop by default

The system drafts. It does not silently publish final content. The dev.to output should be a draft.

***

## High-Level Architecture

```text
+---------------------------+
|         Frontend UI       |
| chat + status + artifacts |
+------------+--------------+
             |
             | HTTP / SSE or WebSocket
             v
+---------------------------+
|    Backend Orchestrator   |
| session logic             |
| brief management          |
| model provider adapter    |
| job creation              |
| MCP client                |
+------------+--------------+
             |
             | internal queue / background task
             v
+---------------------------+
|       Background Worker   |
| finalize brief            |
| outline                   |
| write article             |
| edit + format             |
| generate LinkedIn draft   |
| publish via MCP           |
+------------+--------------+
             |
             | MCP over stdio / stream transport
             v
+---------------------------+
|     dev.to MCP Server    |
| ghcr.io/arun2728/         |
|   dev-to-mcp:latest       |
| Streamable HTTP (/mcp)    |
| create draft article      |
| list articles             |
| get article               |
+------------+--------------+
             |
             | dev.to API
             v
+---------------------------+
|         dev.to API       |
+---------------------------+
```

> Note: In v1 the dev.to MCP server is consumed as the public Docker image
> `ghcr.io/arun2728/dev-to-mcp:latest` (see
> [source](https://github.com/arun2728/dev-to-mcp)) rather than built from a
> sibling repo. The backend talks to it over Streamable HTTP at
> `${DEVTO_MCP_URL}` (default `http://devto-mcp:3000/mcp` in docker compose).

***

## Recommended Tech Stack

### Frontend

- Next.js or React + Vite.
- TypeScript.
- Tailwind or simple component library.
- SSE for job updates, or WebSocket if preferred.

Recommendation: use Next.js if the coding agent wants a single repo with frontend and backend routes. Use React + separate backend if clean service boundaries matter more.

### Backend

- TypeScript with Node.js.
- Fastify or Express.
- Zod for schema validation.
- In-memory stores behind interfaces.
- Background jobs via BullMQ, simple in-process queue, or a lightweight worker abstraction.

Recommendation: start with a simple in-process job runner and event bus. Keep the interfaces ready for Redis or BullMQ later.

### MCP Server

- TypeScript Node.js server.
- MCP SDK.
- Google OAuth integration.
- dev.to API client.

### Model Providers

- OpenAI-compatible adapter for local Llama servers.
- OpenAI adapter.
- Anthropic adapter.

### Shared Utilities

- Zod schemas.
- Prompt templates.
- Logging.
- Retry utilities.
- HTML sanitization.
- Markdown to dev.to HTML conversion.

***

## Suggested Monorepo Structure

```text
content-os/
  apps/
    web/
      src/
        app/
        components/
        hooks/
        lib/
    api/
      src/
        server/
        routes/
        services/
        stores/
        jobs/
        providers/
        prompts/
        events/
        mcp/
  packages/
    shared/
      src/
        schemas/
        types/
        constants/
        utils/
  Dockerfile.api
  Dockerfile.web
  docker-compose.yml       # pulls ghcr.io/arun2728/dev-to-mcp:latest
  .env.example
  pnpm-workspace.yaml
  package.json
  README.md
```

The dev.to MCP server is **not** part of this repo. It is consumed as the
public image `ghcr.io/arun2728/dev-to-mcp:latest`
(source: https://github.com/arun2728/dev-to-mcp) and wired up as a separate
compose service.

***

## Major Components

## 1. Frontend UI

### Purpose

The frontend is the user-facing workspace for:

- entering the topic,
- answering clarifying questions,
- watching job progress,
- viewing generated artifacts,
- copying the LinkedIn draft,
- opening the dev.to draft link.

### Key Screens

#### A. Conversation Workspace

Displays:

- user messages,
- assistant clarifying questions,
- current brief summary,
- a readiness indicator.

#### B. Job Progress Panel

Displays stages like:

- clarifying,
- ready,
- queued,
- outlining,
- writing,
- editing,
- generating_linkedin,
- publishing_draft,
- completed,
- failed.

#### C. Artifact Panel

Displays:

- title,
- outline,
- final blog content preview,
- dev.to draft URL,
- dev.to article metadata,
- LinkedIn draft text,
- copy buttons.

### UI Expectations

- Chat-like interaction for clarification.
- Real-time progress updates.
- Manual “Start draft” button only if the system is confident enough.
- A visible “what the system knows so far” brief panel.
- Clear error messages.
- Copy LinkedIn draft button.
- Open dev.to draft button.
- Model provider selector in settings.
- dev.to connection status in settings.

***

## 2. Backend Orchestrator

### Purpose

The orchestrator is the brain of the app. It should:

- manage sessions,
- manage the content brief,
- call the selected model provider,
- decide what follow-up question to ask,
- determine when the brief is complete,
- create background jobs,
- stream state changes to the UI,
- invoke MCP tools through the MCP client.

### Responsibilities

- Accept user input.
- Load the active session state.
- Update the working brief.
- Decide whether to ask another question or move to ready state.
- Create a job from the frozen brief.
- Expose job and artifact APIs.
- Store all state in memory for now.

### What it should NOT do

- It should not directly implement dev.to API logic.
- It should not directly do OAuth for dev.to.
- It should not keep provider-specific prompt logic spread across the codebase.

***

## 3. Background Worker

### Purpose

The worker performs the longer-running writing and publishing flow outside the request-response loop.

### Responsibilities

- Receive a frozen brief.
- Generate outline.
- Generate article draft.
- Run editorial cleanup.
- Convert output into dev.to-ready HTML.
- Generate a LinkedIn draft.
- Publish to dev.to as draft through MCP.
- Save artifacts in memory.
- Update job state throughout.

### Important rule

Each stage should write artifacts incrementally so the system can recover or debug easily.

***

## 4. dev.to MCP Server

### Purpose

Encapsulate all dev.to-related behavior behind MCP tools.

### Responsibilities

- Authenticate via dev.to API key.
- Create draft articles.
- List and fetch articles.
- Return normalized structured results.

### Why separate service

This keeps the core app clean and makes it easy to add:

- WordPress MCP server,
- Ghost MCP server,
- Notion MCP server,
- Google Docs MCP server,
- image generation MCP server.

***

## Domain Model

### Session

Represents one user interaction workspace.

```ts
interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  providerConfig: ProviderConfig;
  messages: Message[];
  brief: ContentBrief;
  status: 'clarifying' | 'ready' | 'job_running' | 'completed' | 'failed';
  activeJobId?: string;
}
```

### Message

```ts
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  kind?: 'topic' | 'clarification' | 'answer' | 'status' | 'artifact';
}
```

### ContentBrief

```ts
interface ContentBrief {
  topic: string;
  audience?: string;
  goal?: string;
  tone?: string;
  format?: string;
  depth?: 'basic' | 'intermediate' | 'advanced';
  length?: 'short' | 'medium' | 'long';
  pointOfView?: string;
  coreArguments?: string[];
  examples?: string[];
  constraints?: string[];
  seoKeywords?: string[];
  callToAction?: string;
  titleHints?: string[];
  completenessScore: number;
  missingFields: string[];
  ready: boolean;
}
```

### Job

```ts
interface Job {
  id: string;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  status:
    | 'queued'
    | 'running'
    | 'outlining'
    | 'writing'
    | 'editing'
    | 'generating_linkedin'
    | 'publishing_draft'
    | 'completed'
    | 'failed';
  frozenBrief: ContentBrief;
  artifacts: JobArtifacts;
  error?: JobError;
}
```

### JobArtifacts

```ts
interface JobArtifacts {
  outline?: string[];
  articleMarkdown?: string;
  articleHtml?: string;
  finalTitle?: string;
  linkedinDraft?: string;
  devtoDraft?: DevToDraftResult;
}
```

### DevToDraftResult

```ts
interface DevToDraftResult {
  articleId: string;
  title: string;
  url?: string;
  dashboardUrl?: string;
  createdAt?: string;
  published?: boolean;
}
```

***

## Provider Layer Design

Create a strict abstraction.

```ts
interface ModelProvider {
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T>;
  streamChat(input: StreamChatInput): AsyncIterable<StreamChunk>;
}
```

### Required Adapters

- `OpenAIProvider`
- `AnthropicProvider`
- `OpenAICompatibleProvider` for local Llama endpoints

### Provider Config

```ts
interface ProviderConfig {
  provider: 'openai' | 'anthropic' | 'openai_compatible';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}
```

### Design Rules

- The UI only selects provider config.
- The backend resolves the provider adapter.
- Prompts remain provider-neutral.
- Structured output should be validated with Zod.
- Retries should happen only in safe stages.

***

## Clarification Flow Design

### Objective

The clarification phase is responsible for gathering enough context to produce a good article.

It should not write the article.

### Clarifier behavior

The clarifier should:

- inspect the current brief,
- determine missing information,
- ask one or two focused questions at a time,
- update the brief after every user reply,
- stop once confidence is high enough.

### Suggested required fields for readiness

Minimum required before writing:

- topic,
- audience,
- goal,
- tone,
- length,
- depth,
- at least 2 core arguments or takeaways.

Optional but useful:

- examples,
- CTA,
- SEO keywords,
- title direction,
- constraints.

### Clarifier output contract

Use structured output.

```ts
interface ClarifierTurnResult {
  extractedUpdates: Partial<ContentBrief>;
  nextQuestion?: string;
  ready: boolean;
  completenessScore: number;
  missingFields: string[];
  rationale?: string;
}
```

### Suggested clarifier prompt strategy

System instructions should tell the model:

- you are not writing the article yet,
- your job is to collect missing context,
- ask only the most useful next question,
- do not ask redundant questions,
- if enough information exists, set ready to true.

### UX behavior

- The UI should show the brief summary live.
- The assistant should ask concise questions.
- The user should be able to say “use your judgment” or “keep it technical”.
- The system should absorb that into the brief.

***

## Background Job Pipeline

Use a strict pipeline with typed stage outputs.

### Stage 0: Freeze Brief

Input: live session brief.

Output: immutable frozen brief stored on the job.

Purpose: prevent the article from changing midway because the chat changes.

### Stage 1: Outline Generation

Input: frozen brief.

Output:

```ts
interface OutlineResult {
  proposedTitle: string;
  sections: { heading: string; bullets: string[] }[];
}
```

Requirements:

- The outline must reflect audience and depth.
- The title should be strong but editable.
- The outline must avoid fluff.

### Stage 2: Article Writing

Input: frozen brief + approved/generated outline.

Output: markdown article.

Requirements:

- clear intro,
- logical section flow,
- concrete examples where available,
- consistent tone,
- not overly repetitive,
- not too obviously AI-sounding.

### Stage 3: Editorial Cleanup

Input: article markdown.

Output: cleaned markdown + final title.

Tasks:

- reduce repetition,
- improve transitions,
- tighten headings,
- remove generic AI filler phrases,
- ensure CTA exists if asked.

### Stage 4: dev.to Formatting

Input: final markdown.

Output: dev.to-compatible markdown.

Tasks:

- ensure heading levels are clean,
- ensure code blocks use proper fenced syntax,
- validate front matter compatibility,
- remove unsupported constructs if needed.

### Stage 5: LinkedIn Draft Generation

Input: final article + brief.

Output: concise LinkedIn post draft.

Requirements:

- hook in first line,
- 1 short summary arc,
- end with CTA or conversation prompt,
- no hashtags spam,
- easy to copy.

### Stage 6: dev.to Draft Publish via MCP

Input:

- selected blog id,
- final title,
- article HTML.

Output:

- dev.to article metadata,
- draft URL if available,
- post id.

### Stage 7: Final Artifact Assembly

Store and expose:

- final title,
- outline,
- markdown,
- html,
- linkedin draft,
- dev.to publish response.

***

## Job Orchestration Patterns

### State Machine

Implement an explicit state machine. Do not treat job states as random strings spread across the codebase.

```ts
type SessionStatus = 'clarifying' | 'ready' | 'job_running' | 'completed' | 'failed';

type JobStatus =
  | 'queued'
  | 'running'
  | 'outlining'
  | 'writing'
  | 'editing'
  | 'generating_linkedin'
  | 'publishing_draft'
  | 'completed'
  | 'failed';
```

### Retries

Retry only these stages automatically:

- outline generation,
- article writing,
- editorial cleanup,
- LinkedIn draft generation,
- transient MCP publishing failures.

Do not blindly retry malformed prompt logic or invalid OAuth state.

### Idempotency

Publishing to dev.to should be protected against accidental duplicate drafts.

Possible strategy:

- add an idempotency key at the job level,
- store publish result on the job,
- do not republish if a publish result already exists.

***

## API Design

The backend API should stay small and predictable.

## Session APIs

### `POST /api/sessions`

Creates a new session.

Response:

```json
{
  "sessionId": "sess_123",
  "status": "clarifying"
}
```

### `GET /api/sessions/:sessionId`

Returns full session state.

### `POST /api/sessions/:sessionId/messages`

Adds a user message and returns the assistant response plus updated brief.

Request:

```json
{
  "content": "I want to write about why MCP matters for small startups"
}
```

Response:

```json
{
  "assistantMessage": "Who is the target audience for this article?",
  "brief": { "topic": "why MCP matters for small startups" },
  "ready": false,
  "completenessScore": 0.22
}
```

## Job APIs

### `POST /api/sessions/:sessionId/jobs`

Creates a background job from the current brief.

### `GET /api/jobs/:jobId`

Returns job state and artifacts.

### `GET /api/jobs/:jobId/events`

SSE stream for progress updates.

Event examples:

```json
{ "type": "status", "status": "writing" }
{ "type": "artifact", "artifact": "outline" }
{ "type": "status", "status": "publishing_draft" }
{ "type": "completed", "jobId": "job_123" }
```

## Settings APIs

### `POST /api/settings/provider`

Sets active provider config for the session.

### `GET /api/integrations/devto/status`

Returns dev.to connection status and available blogs if connected.

***

## MCP Design

## Why MCP here

Publishing should be exposed as tools instead of hardcoded backend logic. That keeps the app extensible and consistent with the MCP model.

## dev.to MCP tool surface for v1

Keep it small.

### Tool: `list_blogs`

Input:

```json
{}
```

Output:

```json
{
  "blogs": [
    {
      "id": "123456",
      "name": "My Engineering Blog",
      "url": "https://example.blogspot.com"
    }
  ]
}
```

### Tool: `create_draft_post`

Input:

```json
{
  "blogId": "123456",
  "title": "Why MCP matters for modern AI products",
  "contentHtml": "<h1>...</h1><p>...</p>",
  "labels": ["ai", "mcp", "engineering"]
}
```

Output:

```json
{
  "postId": "987654",
  "title": "Why MCP matters for modern AI products",
  "url": "https://example.blogspot.com/2026/04/...",
  "url": "https://dev.to/username/article-slug",
  "status": "DRAFT"
}
```

### Tool: `get_post`

Input:

```json
{
  "blogId": "123456",
  "postId": "987654"
}
```

Output:

```json
{
  "postId": "987654",
  "title": "Why MCP matters for modern AI products",
  "url": "https://example.blogspot.com/...",
  "status": "DRAFT"
}
```

### Optional later tools

- `update_post`
- `delete_post`
- `list_labels`
- `get_blog`
- `publish_post`

### MCP Client Wrapper in backend

Create a small `dev.toMcpClient` abstraction so the orchestration layer calls clean methods like:

```ts
interface dev.toPublisher {
  listBlogs(): Promise<BlogSummary[]>;
  createDraftPost(input: CreateDraftPostInput): Promise<dev.toDraftResult>;
  getPost(input: GetPostInput): Promise<dev.toDraftResult>;
}
```

This keeps MCP transport details out of the business logic.

***

## dev.to OAuth Design

### Requirements

The MCP server should handle dev.to authentication independently.

### Desired behavior

- User clicks connect dev.to.
- Backend opens/connects to MCP auth flow.
- MCP server completes Google OAuth.
- Access token is stored securely for local use.
- Server can now call dev.to tools.

### For local development

Acceptable temporary storage options:

- encrypted local file,
- memory for current run,
- OS keychain if easy.

Avoid putting raw tokens in the frontend.

***

## Prompt Architecture

Keep prompts separated by stage.

Suggested prompt files:

```text
prompts/
  clarifier.system.txt
  clarifier.user.txt
  outline.system.txt
  writer.system.txt
  editor.system.txt
  linkedin.system.txt
```

## Clarifier prompt goals

- collect missing information,
- ask only the highest-value next question,
- return structured JSON,
- avoid writing the article.

## Outline prompt goals

- produce a concrete, useful structure,
- match audience and tone,
- avoid generic headings.

## Writer prompt goals

- write clearly,
- sound natural,
- follow the outline,
- avoid obvious AI boilerplate,
- respect length and technical depth.

## Editor prompt goals

- tighten prose,
- improve transitions,
- improve title,
- remove repetition,
- enforce final tone.

## LinkedIn prompt goals

- convert article into a concise platform-native draft,
- keep it readable,
- keep it conversational,
- avoid over-formatting.

***

## Storage Design for V1

Since there is no local database yet, create storage interfaces and back them with in-memory implementations.

### Interfaces

```ts
interface SessionStore {
  create(session: Session): Promise<void>;
  get(sessionId: string): Promise<Session | null>;
  update(session: Session): Promise<void>;
}

interface JobStore {
  create(job: Job): Promise<void>;
  get(jobId: string): Promise<Job | null>;
  update(job: Job): Promise<void>;
}
```

### In-memory implementations

- `InMemorySessionStore`
- `InMemoryJobStore`

### Important design rule

Never let route handlers read/write raw maps directly. Always use store interfaces.

This will make the future migration to SQLite/Postgres easy.

***

## Eventing and Real-Time Updates

The frontend needs live updates while the job runs.

### Recommendation

Use Server-Sent Events first.

Why:

- simpler than WebSockets,
- enough for one-way status streaming,
- perfect for local-first tools.

### Event types

- `session.updated`
- `job.status_changed`
- `job.artifact_ready`
- `job.completed`
- `job.failed`

### Example event payload

```json
{
  "type": "job.status_changed",
  "jobId": "job_123",
  "status": "editing",
  "timestamp": "2026-04-05T12:30:00Z"
}
```

***

## Error Handling

Design for errors from day one.

### Error categories

#### Model provider errors

Examples:

- invalid API key,
- quota issues,
- timeouts,
- malformed structured output.

#### Brief validation errors

Examples:

- missing required fields,
- user tried to start too early.

#### MCP errors

Examples:

- MCP server unavailable,
- tool not found,
- invalid tool input,
- auth expired.

#### dev.to API errors

Examples:

- OAuth invalid,
- bad blog ID,
- invalid HTML/content,
- rate limit.

### UX behavior

- Show friendly error messages in UI.
- Preserve generated artifacts when possible.
- Do not lose the brief on failure.
- Allow retry for failed jobs.
- Clearly say whether failure happened before or after publishing.

***

## Security and Safety

### Secrets

- API keys must only live on the backend.
- Google OAuth tokens must only live in backend or MCP server storage.
- Never send provider secrets to the frontend.

### Content safety

- Sanitize HTML before sending to dev.to.
- Avoid prompt injection from user content by separating system instructions from user input.
- Do not allow arbitrary tool invocation from the frontend.

### Publishing safety

- Draft only in v1.
- Manual review in dev.to after generation.
- Add idempotency to prevent duplicate draft creation.

***

## Observability and Debugging

This project will be much easier to debug if every stage is observable.

### Add structured logs for

- session creation,
- clarifier turn result,
- readiness transitions,
- job creation,
- stage start/end,
- model provider calls,
- MCP tool calls,
- dev.to publish result,
- failures.

### Capture stage artifacts

Keep intermediate outputs such as:

- extracted brief state,
- outline,
- raw article markdown,
- cleaned markdown,
- final HTML,
- LinkedIn draft.

This will make iteration much faster.

***

## Local Development UX

The project should be easy to run locally.

### `.env.example`

```env
# Model provider
DEFAULT_PROVIDER=openai_compatible
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_COMPATIBLE_BASE_URL=http://localhost:11434/v1
OPENAI_COMPATIBLE_MODEL=llama3
OPENAI_MODEL=gpt-4.1
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# App
PORT=3000
API_PORT=4000
NODE_ENV=development

# dev.to MCP / Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4100/oauth/callback
```

### Local run commands

Example target:

```bash
pnpm install
pnpm dev:web
pnpm dev:api

# Publish stage talks to dev.to MCP over HTTP; run the image:
docker run --rm -d --name devto-mcp -p 3005:3000 \
  -e TRANSPORT=http -e DEVTO_API_KEY=$DEVTO_API_KEY \
  ghcr.io/arun2728/dev-to-mcp:latest
export DEVTO_MCP_URL=http://localhost:3005/mcp
```

Or a single root command:

```bash
pnpm dev
```

Or bring up the whole stack with docker compose:

```bash
docker compose pull devto-mcp
docker compose up --build
```

***

## Suggested Implementation Order

This order is important. Build in thin vertical slices.

### Phase 1: Skeleton app

Build:

- monorepo setup,
- basic UI shell,
- backend server,
- in-memory stores,
- health endpoints.

### Phase 2: Provider abstraction

Build:

- provider interface,
- OpenAI adapter,
- Anthropic adapter,
- OpenAI-compatible local adapter.

Success criterion:

- UI can send a test prompt and receive a response from any provider.

### Phase 3: Clarifier system

Build:

- session creation,
- messages API,
- brief model,
- structured extraction,
- readiness logic,
- live brief panel.

Success criterion:

- user can refine an idea into a complete brief.

### Phase 4: Background jobs

Build:

- job model,
- in-process queue,
- SSE updates,
- outline/writer/editor pipeline.

Success criterion:

- system can generate article + LinkedIn draft locally without publishing.

### Phase 5: dev.to MCP server

The dev.to MCP server is provided as a prebuilt public image:
`ghcr.io/arun2728/dev-to-mcp:latest`
([source](https://github.com/arun2728/dev-to-mcp)).

Integration work:

- add the image as a `devto-mcp` service in `docker-compose.yml`,
- pass `TRANSPORT=http`, `PORT=3000`, and `DEVTO_API_KEY`,
- expose `/mcp` on the compose network.

Success criterion:

- `docker compose up` brings the MCP service up healthy and the
  `create_article` tool creates a dev.to draft end-to-end.

### Phase 6: End-to-end publish flow

Build:

- backend MCP client wrapper,
- publish step in worker,
- artifact panel with dev.to result.

Success criterion:

- user can go from topic to dev.to draft URL.

### Phase 7: Polish

Build:

- retry flows,
- nicer errors,
- better prompts,
- settings page,
- blog selection UI,
- copy buttons,
- artifact persistence strategy preparation.

***

## Acceptance Criteria

The v1 is complete when all of the following are true:

### Functional

- User can choose a provider.
- User can enter a topic.
- System asks clarifying questions.
- System updates a structured brief.
- System knows when the brief is ready.
- User can start the draft job.
- Background worker creates outline, article, LinkedIn draft.
- dev.to MCP server can create a draft post.
- UI shows dev.to draft result and LinkedIn draft.

### Technical

- Backend is provider-agnostic.
- dev.to publishing is isolated behind MCP.
- State is stored through interfaces, not ad hoc objects.
- Job statuses are explicit and stream to UI.
- Failures are recoverable and visible.

### UX

- User always knows current state.
- User can read the brief summary.
- User can copy LinkedIn draft easily.
- User can open dev.to draft easily.
- Errors are understandable.

***

## Future Extensions

The architecture should make these easy later:

### Data and memory

- SQLite/Postgres storage,
- saved sessions,
- content history,
- brand voice memory,
- document ingestion from dev.to or Google Docs.

### More publishing targets

- WordPress MCP server,
- Ghost MCP server,
- Dev.to connector,
- Medium export,
- Notion publishing.

### Better creation workflow

- image generation step,
- SEO suggestions,
- internal linking suggestions,
- title A/B variants,
- scheduled publishing.

### Richer agent system

- separate research agent,
- SEO editor agent,
- brand voice agent,
- analytics feedback loop,
- feedback from published post performance.

***

## Engineering Notes for the Coding Agent

### Important architectural decisions

1. Keep model provider logic isolated behind interfaces.
2. Keep dev.to integration isolated behind MCP.
3. Keep state behind stores, even though it is in-memory now.
4. Use typed schemas for every boundary.
5. Prefer deterministic pipelines over free-form autonomy.
6. Preserve intermediate artifacts for debugging.
7. Stream progress updates from the worker to the UI.
8. Build draft-only publishing first.

### Common mistakes to avoid

- Letting the clarifier generate the article.
- Mixing provider-specific code into business logic.
- Directly calling dev.to from the orchestration layer.
- Storing secrets in the frontend.
- Treating background jobs as opaque black boxes.
- Skipping typed structured output.
- Hardcoding UI assumptions into backend stages.

***

## Suggested Minimal End-to-End Flow

```text
1. User opens app.
2. User selects provider and connects dev.to.
3. User enters article topic.
4. Clarifier asks follow-up questions until brief is ready.
5. User confirms and starts draft generation.
6. Job is created.
7. Worker generates outline.
8. Worker writes article.
9. Worker edits and formats article.
10. Worker generates LinkedIn draft.
11. Worker calls dev.to MCP create_draft_post.
12. dev.to MCP server publishes draft to dev.to.
13. Worker stores result.
14. UI shows dev.to draft link and LinkedIn draft.
```

***

## Final Recommendation

Build this as a local-first monorepo with a strict separation between UI, orchestration, worker, and dev.to MCP server.

Do not overcomplicate v1 with a database or too many agents. The strongest version of this project is one that feels clean, extensible, and production-minded.

If built well, this will not look like a toy blog generator. It will look like the first version of a serious content operating system.