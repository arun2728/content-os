import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { UserMessageInputSchema } from '@content-os/shared';
import { InMemoryJobStore, InMemorySessionStore } from './stores/in-memory.js';
import { SessionService } from './services/session-service.js';
import { EventBus, type JobEvent } from './events/event-bus.js';
import { JobRunner } from './jobs/job-runner.js';
import { BloggerMcpClient } from './mcp/blogger-client.js';

const app = express();
app.use(cors());
app.use(express.json());

const sessionStore = new InMemorySessionStore();
const jobStore = new InMemoryJobStore();
const eventBus = new EventBus<JobEvent>();
const sessionService = new SessionService(sessionStore, jobStore);
const jobRunner = new JobRunner({
  sessionStore,
  jobStore,
  eventBus,
  bloggerPublisher: new BloggerMcpClient()
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'content-os-api', timestamp: new Date().toISOString() });
});

app.post('/api/sessions', async (_req, res) => {
  const session = await sessionService.createSession();
  res.status(201).json({ sessionId: session.id, status: session.status, brief: session.brief });
});

app.get('/api/sessions/:sessionId', async (req, res) => {
  const session = await sessionService.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.post('/api/sessions/:sessionId/messages', async (req, res) => {
  const parsed = UserMessageInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await sessionService.addMessage(req.params.sessionId, parsed.data.content);
    res.json({
      assistantMessage: result.assistantMessage,
      brief: result.session.brief,
      ready: result.session.brief.ready,
      completenessScore: result.session.brief.completenessScore
    });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : 'Session not found' });
  }
});

app.post('/api/sessions/:sessionId/jobs', async (req, res) => {
  try {
    const job = await sessionService.createJob(req.params.sessionId);
    void jobRunner.start(job.id);
    res.status(201).json({ jobId: job.id, status: job.status });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not create job' });
  }
});

app.get('/api/jobs/:jobId', async (req, res) => {
  const job = await jobStore.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.get('/api/jobs/:jobId/events', async (req, res) => {
  const jobId = req.params.jobId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const unsubscribe = eventBus.subscribe((event) => {
    if (event.jobId !== jobId) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

const ProviderConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'openai_compatible']),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional()
});

app.post('/api/settings/provider/:sessionId', async (req, res) => {
  const parsed = ProviderConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const session = await sessionService.updateProvider(req.params.sessionId, parsed.data);
    res.json({ sessionId: session.id, providerConfig: session.providerConfig });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : 'Session not found' });
  }
});

app.get('/api/integrations/blogger/status', async (_req, res) => {
  const blogs = await new BloggerMcpClient().listBlogs();
  res.json({ connected: true, blogs });
});

const port = Number(process.env.API_PORT ?? 4000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
