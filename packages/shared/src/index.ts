// Type definitions and utilities shared across all apps
import { z } from 'zod';

// Re-export all types and utilities
export * from './providers';
export * from './stores';

// ============================================================================
// CLARIFIER TYPES
// ============================================================================

export const ClarifyingQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  category: z.enum(['topic', 'audience', 'tone', 'length', 'format', 'other']),
  userAnswer: z.string().optional(),
});

export type ClarifyingQuestion = z.infer<typeof ClarifyingQuestionSchema>;

export const BriefSchema = z.object({
  id: z.string(),
  initialPrompt: z.string(),
  refinedPrompt: z.string().optional(),
  clarifyingQuestions: z.array(ClarifyingQuestionSchema),
  isReady: z.boolean().default(false),
  createdAt: z.date(),
});

export type Brief = z.infer<typeof BriefSchema>;

// ============================================================================
// CONTENT GENERATION TYPES
// ============================================================================

export const OutlineItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  depth: z.number().default(0),
});

export type OutlineItem = z.infer<typeof OutlineItemSchema>;

export const OutlineSchema = z.object({
  id: z.string(),
  briefId: z.string(),
  items: z.array(OutlineItemSchema),
  createdAt: z.date(),
});

export type Outline = z.infer<typeof OutlineSchema>;

export const DraftSchema = z.object({
  id: z.string(),
  briefId: z.string(),
  outlineId: z.string(),
  content: z.string(),
  createdAt: z.date(),
});

export type Draft = z.infer<typeof DraftSchema>;

export const EditSuggestionSchema = z.object({
  id: z.string(),
  type: z.enum(['clarity', 'grammar', 'tone', 'structure', 'engagement']),
  location: z.string(),
  suggestion: z.string(),
  appliedAt: z.date().optional(),
});

export type EditSuggestion = z.infer<typeof EditSuggestionSchema>;

export const EditedDraftSchema = z.object({
  id: z.string(),
  draftId: z.string(),
  content: z.string(),
  suggestions: z.array(EditSuggestionSchema),
  createdAt: z.date(),
});

export type EditedDraft = z.infer<typeof EditedDraftSchema>;

// ============================================================================
// BLOGGER PUBLISHING TYPES
// ============================================================================

export const BloggerCredentialsSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  blogId: z.string().optional(),
});

export type BloggerCredentials = z.infer<typeof BloggerCredentialsSchema>;

export const PublishedPostSchema = z.object({
  id: z.string(),
  blogUrl: z.string(),
  postUrl: z.string(),
  publishedAt: z.date(),
});

export type PublishedPost = z.infer<typeof PublishedPostSchema>;

// ============================================================================
// JOB & ORCHESTRATION TYPES
// ============================================================================

export const JobStatusEnum = z.enum([
  'pending',
  'clarifying',
  'ready',
  'outlining',
  'writing',
  'editing',
  'publishing',
  'completed',
  'failed',
]);

export type JobStatus = z.infer<typeof JobStatusEnum>;

export const JobStageResultSchema = z.object({
  stage: z.enum(['clarify', 'outline', 'write', 'edit', 'publish']),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  data: z.record(z.any()).optional(),
  error: z.string().optional(),
  completedAt: z.date().optional(),
});

export type JobStageResult = z.infer<typeof JobStageResultSchema>;

export const ContentJobSchema = z.object({
  id: z.string(),
  status: JobStatusEnum,
  userPrompt: z.string(),
  currentStage: z.enum(['clarify', 'outline', 'write', 'edit', 'publish']),
  stageResults: z.array(JobStageResultSchema),
  publishedPost: PublishedPostSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ContentJob = z.infer<typeof ContentJobSchema>;

// ============================================================================
// MODEL PROVIDER TYPES
// ============================================================================

export const ModelProviderConfigSchema = z.object({
  provider: z.enum(['openai', 'openai-compatible', 'anthropic']),
  apiKey: z.string(),
  baseUrl: z.string().optional(), // For OpenAI-compatible (Ollama, etc)
  model: z.string(),
});

export type ModelProviderConfig = z.infer<typeof ModelProviderConfigSchema>;

export const ModelResponseSchema = z.object({
  content: z.string(),
  tokensUsed: z.number().optional(),
});

export type ModelResponse = z.infer<typeof ModelResponseSchema>;

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export const CreateJobRequestSchema = z.object({
  userPrompt: z.string(),
});

export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

export const AnswerClarifyingQuestionsRequestSchema = z.object({
  briefId: z.string(),
  answers: z.record(z.string()),
});

export type AnswerClarifyingQuestionsRequest = z.infer<
  typeof AnswerClarifyingQuestionsRequestSchema
>;

export const JobProgressEventSchema = z.object({
  jobId: z.string(),
  stage: z.enum(['clarify', 'outline', 'write', 'edit', 'publish']),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.date(),
});

export type JobProgressEvent = z.infer<typeof JobProgressEventSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.date(),
  services: z.object({
    api: z.enum(['ok', 'error']),
    blogger: z.enum(['ok', 'error']).optional(),
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
