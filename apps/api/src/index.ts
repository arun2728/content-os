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
      console.log(`[API] Received answers for brief ${req.params.briefId}`);
      const { briefId } = req.params;
      const result = AnswerClarifyingQuestionsRequestSchema.safeParse(req.body);

      if (!result.success) {
        console.error('[API] Validation failed for answers:', result.error.message);
        return res.status(400).json({ error: result.error.message });
      }

      const brief = store.getBrief(briefId);
      if (!brief) {
        console.error(`[API] Brief ${briefId} not found`);
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

      console.log(`[API] Brief ${briefId} updated with answers. Checking completeness...`);

      const allAnswered = updatedBrief.clarifyingQuestions.every(
        (q) => q.userAnswer && q.userAnswer.trim().length > 0
      );

      // If all questions answered and prompt not refined yet, refine the brief
      if (allAnswered && !updatedBrief.refinedPrompt) {
        console.log(`[API] All questions answered for brief ${briefId}. Refining prompt...`);
        const refinedPrompt = await clarifier.refineBrief(
          updatedBrief.initialPrompt,
          updatedQuestions
        );

        store.updateBrief(briefId, {
          refinedPrompt,
          isReady: true,
        });
        console.log(`[API] Brief ${briefId} is now ready with refined prompt.`);
      } else {
        console.log(`[API] Brief ${briefId} completeness check: allAnswered=${allAnswered}, alreadyRefined=${!!updatedBrief.refinedPrompt}`);
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
// ARTIFACT ENDPOINTS
// ============================================================================

app.get('/api/outlines/:outlineId', (req: Request, res: Response) => {
  const outline = store.getOutline(req.params.outlineId);
  if (!outline) {
    return res.status(404).json({ error: 'Outline not found' });
  }
  res.json(outline);
});

app.get('/api/drafts/:draftId', (req: Request, res: Response) => {
  const draft = store.getDraft(req.params.draftId);
  if (!draft) {
    return res.status(404).json({ error: 'Draft not found' });
  }
  res.json(draft);
});

app.get('/api/edited-drafts/:editedDraftId', (req: Request, res: Response) => {
  const editedDraft = store.getEditedDraft(req.params.editedDraftId);
  if (!editedDraft) {
    return res.status(404).json({ error: 'Edited draft not found' });
  }
  res.json(editedDraft);
});

app.get('/api/linkedin-drafts/:linkedinDraftId', (req: Request, res: Response) => {
  const linkedinDraft = store.getLinkedInDraft(req.params.linkedinDraftId);
  if (!linkedinDraft) {
    return res.status(404).json({ error: 'LinkedIn draft not found' });
  }
  res.json(linkedinDraft);
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
    console.log(`[API] Orchestrator: Generating outline for job ${jobId} (brief: ${briefId})...`);

    const outline = await orchestrator.executeOutlineStage(job, brief);
    console.log(`[API] Orchestrator: Outline generated successfully for job ${jobId}.`);

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
    console.log(`[API] Orchestrator: Writing draft for job ${jobId} (outline: ${outlineId})...`);

    const draft = await orchestrator.executeWriteStage(job, brief, outline);
    console.log(`[API] Orchestrator: Draft written successfully for job ${jobId}.`);

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
    console.log(`[API] Orchestrator: Editing draft for job ${jobId} (draft: ${draftId})...`);

    const editedDraft = await orchestrator.executeEditStage(job, draft);
    console.log(`[API] Orchestrator: Draft edited successfully for job ${jobId}.`);

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

// Execute LinkedIn draft stage
app.post('/api/jobs/:jobId/linkedin', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { editedDraftId, briefId } = req.body;

    const job = store.getJob(jobId);
    const editedDraft = store.getEditedDraft(editedDraftId);
    const brief = store.getBrief(briefId);

    if (!job || !editedDraft || !brief) {
      return res
        .status(404)
        .json({ error: 'Job, edited draft, or brief not found' });
    }

    orchestrator.updateJobProgress(jobId, 'generating_linkedin', 'linkedin');
    console.log(`[API] Orchestrator: Generating LinkedIn draft for job ${jobId}...`);

    const linkedinDraft = await orchestrator.executeLinkedInStage(
      job,
      editedDraft,
      brief
    );
    console.log(`[API] Orchestrator: LinkedIn draft generated for job ${jobId}.`);

    orchestrator.addStageResult(job, {
      stage: 'linkedin',
      status: 'completed',
      data: { linkedinDraftId: linkedinDraft.id },
      completedAt: new Date(),
    });

    store.updateJob(jobId, { linkedinDraft });

    res.json(linkedinDraft);
  } catch (error) {
    console.error('[API] Error generating LinkedIn draft:', error);
    res.status(500).json({ error: 'Failed to generate LinkedIn draft' });
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
    console.log(`[API] Orchestrator: Publishing draft to dev.to for job ${jobId}...`);

    const publishedPost = await orchestrator.executePublishStage(
      job,
      editedDraft,
      title
    );
    console.log(`[API] Orchestrator: Draft published to dev.to for job ${jobId}.`);

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
    res.status(500).json({ error: 'Failed to publish draft to dev.to' });
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
