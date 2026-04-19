# Content OS

AI-powered content orchestration: clarify → outline → write → edit → publish to dev.to.

Content OS is a monorepo application that guides users through the entire content creation process, from initial ideation through final publication on dev.to.

## Architecture

Content OS uses a monorepo structure with pnpm workspaces. The dev.to MCP
server is consumed as a **prebuilt public Docker image** published to GitHub
Container Registry, so there is no sibling repo to clone or build.

```
content-os/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # Express.js backend (talks to MCP over HTTP)
├── packages/
│   └── shared/           # Shared types, providers, stores
├── docker-compose.yml    # Orchestrates api + web + devto-mcp (pulled image)
└── pnpm-workspace.yaml
```

The `devto-mcp` service runs [`ghcr.io/arun2728/dev-to-mcp:latest`](https://github.com/arun2728/dev-to-mcp/pkgs/container/dev-to-mcp)
in Streamable HTTP mode, and the API reaches it via the compose network at
`http://devto-mcp:3000/mcp`.

## Project Structure

### Apps

#### `apps/web` - Frontend
- **Framework**: Next.js 16 with React 19
- **Styling**: Tailwind CSS with shadcn/ui components
- **State**: In-memory with SSE for real-time updates
- **Key Components**:
  - Homepage: Initial prompt submission
  - Clarifier: Interactive question-answer flow
  - JobDashboard: Real-time progress tracking

#### `apps/api` - Backend
- **Framework**: Express.js with TypeScript
- **Features**:
  - Job orchestration (clarify → outline → write → edit → publish)
  - AI provider abstraction (OpenAI, Ollama)
  - In-memory state management
  - Server-Sent Events for real-time updates
- **Key Classes**:
  - `Clarifier`: Generates and manages clarifying questions
  - `JobOrchestrator`: Orchestrates the content pipeline
  - `ModelProviderFactory`: Creates pluggable AI providers

#### External: `dev-to-mcp` - MCP Server
- **Protocol**: Model Context Protocol (Streamable HTTP transport)
- **Image**: [`ghcr.io/arun2728/dev-to-mcp:latest`](https://github.com/arun2728/dev-to-mcp/pkgs/container/dev-to-mcp) (public)
- **Source**: [github.com/arun2728/dev-to-mcp](https://github.com/arun2728/dev-to-mcp)
- **Endpoint**: `http://devto-mcp:3000/mcp` (inside the compose network)
- **Features**:
  - Create draft articles on dev.to
  - List and manage articles, comments, tags, and more
  - API key authentication via `DEVTO_API_KEY`

### Packages

#### `packages/shared`
- **Exports**:
  - Type definitions (Job, Brief, Outline, Draft, etc.)
  - Provider interfaces and factory
  - In-memory store implementation
  - Zod schemas for validation

## Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm
- (Optional) Ollama for local LLM development

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Update .env with your API keys:
# - OPENAI_API_KEY (or use OLLAMA_BASE_URL for local development)
# - DEVTO_API_KEY (get one at https://dev.to/settings/extensions)
```

### Development

```bash
# Start all apps in development mode
pnpm dev

# Or start specific apps:
pnpm dev:web      # Frontend on http://localhost:3000
pnpm dev:api      # Backend on http://localhost:3001
```

For the publish stage to work during local dev (outside Docker Compose),
also start the dev.to MCP container and point the API at it:

```bash
docker run --rm -d --name devto-mcp -p 3005:3000 \
  -e TRANSPORT=http \
  -e DEVTO_API_KEY=$DEVTO_API_KEY \
  ghcr.io/arun2728/dev-to-mcp:latest

export DEVTO_MCP_URL=http://localhost:3005/mcp
```

### Building

```bash
# Build all apps
pnpm build

# Build specific app
pnpm build:web
pnpm build:api

# Or use Docker Compose to build api + web and pull the dev-to-mcp image:
docker compose build
docker compose pull devto-mcp
```

## Environment Variables

### `apps/api`
```env
# Model Provider (openai or openai-compatible)
MODEL_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Or for Ollama (local)
MODEL_PROVIDER=openai-compatible
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama2
```

### dev.to Publishing
```env
# Get your API key at https://dev.to/settings/extensions
DEVTO_API_KEY=your-dev-to-api-key

# URL of the dev.to MCP server (Streamable HTTP).
# In docker compose, the default points at the bundled `devto-mcp` service.
# Override only if running the MCP elsewhere.
DEVTO_MCP_URL=http://devto-mcp:3000/mcp
```

## API Endpoints

### Jobs
- `POST /api/jobs` - Create a new content job
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/:jobId` - Get job status
- `GET /api/jobs/:jobId/progress` - Stream job progress (SSE)

### Clarifier
- `POST /api/jobs/:jobId/clarify` - Generate clarifying questions
- `POST /api/briefs/:briefId/answers` - Submit answers to questions

### Orchestration
- `POST /api/jobs/:jobId/outline` - Generate outline
- `POST /api/jobs/:jobId/write` - Write draft
- `POST /api/jobs/:jobId/edit` - Edit draft
- `POST /api/jobs/:jobId/linkedin` - Generate LinkedIn draft
- `POST /api/jobs/:jobId/publish` - Publish draft to dev.to

## Content Pipeline

### 1. Clarify
- User enters initial prompt
- AI generates 5 clarifying questions
- User answers questions
- AI refines brief based on answers

### 2. Outline
- Takes refined brief
- Generates hierarchical outline
- Returns structure for content

### 3. Write
- Uses brief + outline
- Generates comprehensive draft
- Follows outline structure

### 4. Edit
- Reviews draft for clarity, grammar, engagement
- Provides improved version
- Ready for publication

### 5. LinkedIn Draft
- Converts edited article into a LinkedIn post
- Concise hook, summary arc, CTA format

### 6. Publish
- Publishes draft to dev.to via MCP (create_article with published=false)
- Returns dev.to article URL
- Updates job with completion status

## Model Providers

Content OS uses a pluggable model provider system:

### OpenAI (Default)
```typescript
const config: ProviderConfig = {
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
};
```

### OpenAI-Compatible (Ollama)
```typescript
const config: ProviderConfig = {
  type: 'openai-compatible',
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama2',
};
```

Adding new providers:
1. Implement `ModelProvider` interface
2. Add to `ModelProviderFactory.create()`
3. Add Zod schema for configuration

## dev.to MCP Server

The API publishes articles through the public [`ghcr.io/arun2728/dev-to-mcp`](https://github.com/arun2728/dev-to-mcp/pkgs/container/dev-to-mcp)
image. It runs as its own container, speaks the Model Context Protocol over
Streamable HTTP, and is reached at `${DEVTO_MCP_URL}` (default
`http://devto-mcp:3000/mcp` inside docker compose).

### Run it standalone (outside Docker Compose)

```bash
docker pull ghcr.io/arun2728/dev-to-mcp:latest

docker run --rm -p 3005:3000 \
  -e TRANSPORT=http \
  -e DEVTO_API_KEY=$DEVTO_API_KEY \
  ghcr.io/arun2728/dev-to-mcp:latest

# Then point the API at it:
export DEVTO_MCP_URL=http://localhost:3005/mcp
```

### Key Tools
- `create_article` - Create a draft article on dev.to
- `get_articles` - List articles
- `get_my_articles` - List your own articles
- `update_article` - Update an existing article

## Storage

**v1 Status**: All data is stored in-memory and lost on server restart.

**Future**: Replace with persistent storage (PostgreSQL, MongoDB, etc.)

## Real-Time Updates

Frontend receives live updates via Server-Sent Events (SSE):

```typescript
const { isConnected, lastEvent } = useJobProgress({
  jobId,
  onProgress: (event) => {
    // event.stage, event.status, event.progress
  },
});
```

## Development Workflow

1. **Frontend Changes**: Modify `apps/web`, next dev will HMR
2. **Backend Changes**: Modify `apps/api`, restart dev server
3. **Shared Types**: Update `packages/shared/src`, rebuild with `pnpm build`
4. **MCP Upgrades**: Bump the image tag in `docker-compose.yml`
   (or run `docker compose pull devto-mcp` to grab the latest `:latest`).
   The MCP source lives at
   [github.com/arun2728/dev-to-mcp](https://github.com/arun2728/dev-to-mcp)
   and its image is published to
   [`ghcr.io/arun2728/dev-to-mcp`](https://github.com/arun2728/dev-to-mcp/pkgs/container/dev-to-mcp).

## Testing

```bash
# Type check all packages
pnpm type-check

# Lint code
pnpm lint

# Run tests (when available)
pnpm test
```

## Deployment

### Frontend (Vercel)
```bash
# Deploy apps/web to Vercel
# Set environment variables in Vercel dashboard
```

### Backend (Any Node.js host)
```bash
# Build and deploy apps/api
cd apps/api
pnpm build
NODE_ENV=production pnpm start
```

### Docker Compose (Recommended)
```bash
# Pull the public dev-to-mcp image and start all services (api + web + devto-mcp)
docker compose pull devto-mcp
docker compose up --build
```

The `devto-mcp` service uses the published image
`ghcr.io/arun2728/dev-to-mcp:latest` — no local clone of the MCP repo is
required. To force-refresh the MCP image later, run
`docker compose pull devto-mcp && docker compose up -d`.

## Troubleshooting

### "No questions were generated"
- Check API key is valid
- Verify model is available
- Check rate limits

### dev.to publishing fails
- Verify `DEVTO_API_KEY` is set in `.env`
- Get a key at https://dev.to/settings/extensions
- Ensure the `devto-mcp` container is healthy:
  `docker compose ps devto-mcp` and
  `curl http://localhost:3000/health` from inside the compose network
- Verify `DEVTO_MCP_URL` points at a reachable `/mcp` endpoint
- Pull the latest image in case of protocol updates:
  `docker compose pull devto-mcp`

### SSE connection drops
- Check CORS is enabled on API
- Verify connection timeout settings
- Check browser console for errors

## Future Enhancements

- [ ] Persistent database integration
- [ ] User authentication & multi-tenancy
- [ ] Content scheduling
- [ ] Multiple blog platform support
- [ ] Custom AI model training
- [ ] Content analytics
- [ ] Batch processing
- [ ] Content versioning

## License

MIT
