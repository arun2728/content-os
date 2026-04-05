import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import {
  HealthResponse,
  store,
  ContentJob,
  CreateJobRequestSchema,
  ModelProviderFactory,
  ProviderConfig,
  Brief,
  AnswerClarifyingQuestionsRequestSchema,
} from '@content-os/shared';
import { Clarifier } from './clarifier';
import { JobOrchestrator } from './orchestrator';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

// Initialize provider from environment or use default
const initializeProvider = (): ProviderConfig => {
  const providerType = process.env.MODEL_PROVIDER || 'openai';

  if (providerType === 'openai-compatible') {
    return {
      type: 'openai-compatible',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      model: process.env.OLLAMA_MODEL || 'llama2',
      apiKey: process.env.OLLAMA_API_KEY,
    };
  }

  return {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  };
};

let modelProvider = ModelProviderFactory.create(initializeProvider());
const clarifier = new Clarifier(modelProvider);
const orchestrator = new JobOrchestrator(modelProvider);

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/health', (_req: Request, res: Response) => {
  const health: HealthResponse = {
    status: 'ok',
    timestamp: new Date(),
    services: {
      api: 'ok',
    },
  };
  res.json(health);
});

// API placeholder routes
app.get('/api/jobs', (_req: Request, res: Response) => {
  res.json({
    jobs: store.listJobs(),
  });
});

app.post('/api/jobs', (req: Request, res: Response) => {
  const result = CreateJobRequestSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.message });
  }

  const { userPrompt } = result.data;
  const jobId = `job_${Date.now()}`;

  const job: ContentJob = {
    id: jobId,
    status: 'clarifying',
    userPrompt,
    currentStage: 'clarify',
    stageResults: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  store.createJob(job);
  res.status(201).json(job);
});

app.get('/api/jobs/:jobId', (req: Request, res: Response) => {
  const job = store.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// SSE endpoint for job progress
app.get('/api/jobs/:jobId/progress', (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  const job = store.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  res.write(
    `data: ${JSON.stringify({
      type: 'connected',
      jobId,
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  // Subscribe to job updates
  const unsubscribe = store.subscribeToJob(jobId, (updatedJob) => {
    res.write(
      `data: ${JSON.stringify({
        type: 'progress',
        jobId: updatedJob.id,
        status: updatedJob.status,
        currentStage: updatedJob.currentStage,
        progress: updatedJob.stageResults.length * 20, // 0-100
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  });

  req.on('close', () => {
    unsubscribe();
    res.end();
  });
});

// ============================================================================
// CLARIFIER ENDPOINTS
// ============================================================================

// Generate clarifying questions for a job
app.post('/api/jobs/:jobId/clarify', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = store.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Generate clarifying questions
    const questions = await clarifier.generateQuestions(job.userPrompt);

    // Create brief with questions
    const briefId = `brief_${Date.now()}`;
    const brief: Brief = {
      id: briefId,
      initialPrompt: job.userPrompt,
      clarifyingQuestions: questions,
      isReady: false,
      createdAt: new Date(),
    };

    store.createBrief(brief);

    // Update job with brief reference
    store.updateJob(jobId, {
      stageResults: [
        {
          stage: 'clarify',
          status: 'completed',
          data: { briefId },
          completedAt: new Date(),
        },
      ],
    });

    res.json({ briefId, questions });
  } catch (error) {
    console.error('[API] Error generating clarifying questions:', error);
    res.status(500).json({
      error: 'Failed to generate clarifying questions',
    });
  }
});

// Answer clarifying questions
app.post(
  '/api/briefs/:briefId/answers',
  async (req: Request, res: Response) => {
    try {
      const { briefId } = req.params;
      const result = AnswerClarifyingQuestionsRequestSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }

      const brief = store.getBrief(briefId);
      if (!brief) {
        return res.status(404).json({ error: 'Brief not found' });
      }

      // Update questions with answers
      const updatedQuestions = brief.clarifyingQuestions.map((q) => ({
        ...q,
        userAnswer: result.data.answers[q.id],
      }));

      const updatedBrief = store.updateBrief(briefId, {
        clarifyingQuestions: updatedQuestions,
      });

      // If all questions answered, refine the brief
      if (clarifier.isBriefReady(updatedBrief)) {
        const refinedPrompt = await clarifier.refineBrief(
          updatedBrief.initialPrompt,
          updatedQuestions
        );

        store.updateBrief(briefId, {
          refinedPrompt,
          isReady: true,
        });
      }

      res.json(store.getBrief(briefId));
    } catch (error) {
      console.error('[API] Error processing answers:', error);
      res.status(500).json({ error: 'Failed to process answers' });
    }
  }
);

// Get brief status
app.get('/api/briefs/:briefId', (req: Request, res: Response) => {
  const brief = store.getBrief(req.params.briefId);
  if (!brief) {
    return res.status(404).json({ error: 'Brief not found' });
  }
  res.json(brief);
});

// ============================================================================
// ORCHESTRATION ENDPOINTS
// ============================================================================

// Execute outline stage
app.post('/api/jobs/:jobId/outline', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { briefId } = req.body;

    const job = store.getJob(jobId);
    const brief = store.getBrief(briefId);

    if (!job || !brief) {
      return res.status(404).json({ error: 'Job or brief not found' });
    }

    orchestrator.updateJobProgress(jobId, 'outlining', 'outline');

    const outline = await orchestrator.executeOutlineStage(job, brief);

    orchestrator.addStageResult(job, {
      stage: 'outline',
      status: 'completed',
      data: { outlineId: outline.id },
      completedAt: new Date(),
    });

    res.json(outline);
  } catch (error) {
    console.error('[API] Error executing outline:', error);
    res.status(500).json({ error: 'Failed to generate outline' });
  }
});

// Execute write stage
app.post('/api/jobs/:jobId/write', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { briefId, outlineId } = req.body;

    const job = store.getJob(jobId);
    const brief = store.getBrief(briefId);
    const outline = store.getOutline(outlineId);

    if (!job || !brief || !outline) {
      return res
        .status(404)
        .json({ error: 'Job, brief, or outline not found' });
    }

    orchestrator.updateJobProgress(jobId, 'writing', 'write');

    const draft = await orchestrator.executeWriteStage(job, brief, outline);

    orchestrator.addStageResult(job, {
      stage: 'write',
      status: 'completed',
      data: { draftId: draft.id },
      completedAt: new Date(),
    });

    res.json(draft);
  } catch (error) {
    console.error('[API] Error executing write:', error);
    res.status(500).json({ error: 'Failed to write draft' });
  }
});

// Execute edit stage
app.post('/api/jobs/:jobId/edit', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { draftId } = req.body;

    const job = store.getJob(jobId);
    const draft = store.getDraft(draftId);

    if (!job || !draft) {
      return res.status(404).json({ error: 'Job or draft not found' });
    }

    orchestrator.updateJobProgress(jobId, 'editing', 'edit');

    const editedDraft = await orchestrator.executeEditStage(job, draft);

    orchestrator.addStageResult(job, {
      stage: 'edit',
      status: 'completed',
      data: { editedDraftId: editedDraft.id },
      completedAt: new Date(),
    });

    res.json(editedDraft);
  } catch (error) {
    console.error('[API] Error executing edit:', error);
    res.status(500).json({ error: 'Failed to edit draft' });
  }
});

// Execute publish stage
app.post('/api/jobs/:jobId/publish', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { editedDraftId, title } = req.body;

    const job = store.getJob(jobId);
    const editedDraft = store.getEditedDraft(editedDraftId);

    if (!job || !editedDraft) {
      return res
        .status(404)
        .json({ error: 'Job or edited draft not found' });
    }

    orchestrator.updateJobProgress(jobId, 'publishing', 'publish');

    const publishedPost = await orchestrator.executePublishStage(
      job,
      editedDraft,
      title
    );

    const updatedJob = orchestrator.addStageResult(job, {
      stage: 'publish',
      status: 'completed',
      data: { postUrl: publishedPost.postUrl },
      completedAt: new Date(),
    });

    store.updateJob(jobId, {
      status: 'completed',
      publishedPost,
    });

    res.json({ publishedPost, job: store.getJob(jobId) });
  } catch (error) {
    console.error('[API] Error executing publish:', error);
    res.status(500).json({ error: 'Failed to publish post' });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ============================================================================
// SERVER START
// ============================================================================

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});
