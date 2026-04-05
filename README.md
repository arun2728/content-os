# Content OS

AI-powered content orchestration: clarify → outline → write → edit → publish to Blogger.

Content OS is a monorepo application that guides users through the entire content creation process, from initial ideation through final publication.

## Architecture

Content OS uses a monorepo structure with pnpm workspaces:

```
content-os/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── api/              # Express.js backend
│   └── mcp-blogger/      # MCP server for Blogger integration
├── packages/
│   └── shared/           # Shared types, providers, stores
└── pnpm-workspace.yaml
```

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

#### `apps/mcp-blogger` - MCP Server
- **Protocol**: Model Context Protocol
- **Features**:
  - Google Blogger OAuth integration
  - Encrypted credential storage
  - Post publication tools
- **Key Classes**:
  - `CredentialManager`: Handles encrypted credential storage
  - `BloggerClient`: Manages Blogger API interactions

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

# Update .env.local with your API keys:
# - OPENAI_API_KEY (or use OLLAMA_BASE_URL for local development)
# - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (for Blogger integration)
```

### Development

```bash
# Start all apps in development mode
pnpm dev

# Or start specific apps:
pnpm dev:web      # Frontend on http://localhost:3000
pnpm dev:api      # Backend on http://localhost:3001
pnpm dev:blogger  # MCP Blogger server
```

### Building

```bash
# Build all apps
pnpm build

# Build specific app
pnpm build:web
pnpm build:api
pnpm build:blogger
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

### `apps/mcp-blogger`
```env
# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
GOOGLE_API_KEY=...

# Default blog for publishing
BLOGGER_BLOG_ID=your-blog-id

# Encryption key for credential storage
CONTENT_OS_SECRET=your-secret-key
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
- `POST /api/jobs/:jobId/publish` - Publish post

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

### 5. Publish
- Publishes to Blogger via MCP
- Returns published post URL
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

## Blogger MCP Server

The MCP Blogger server provides tools for AI models to publish content:

### Tools
- `authenticate_blogger` - OAuth authentication
- `list_blogs` - List user's blogs
- `publish_draft_to_blogger` - Publish post

### Credentials
Credentials are encrypted with AES-256-GCM and stored in `~/.content-os/credentials.enc`.

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
4. **MCP Changes**: Modify `apps/mcp-blogger`, test with tools

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

### MCP Server
```bash
# Deploy apps/mcp-blogger
# Can run as separate process or containerized
```

## Troubleshooting

### "No questions were generated"
- Check API key is valid
- Verify model is available
- Check rate limits

### Blogger authentication fails
- Verify OAuth credentials are correct
- Check redirect URI matches configuration
- Ensure `CONTENT_OS_SECRET` is set for credential encryption

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
