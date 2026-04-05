export type SessionStatus = 'clarifying' | 'ready' | 'job_running' | 'completed' | 'failed';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'outlining'
  | 'writing'
  | 'editing'
  | 'generating_linkedin'
  | 'publishing_draft'
  | 'completed'
  | 'failed';

export interface ProviderConfig {
  provider: 'openai' | 'anthropic' | 'openai_compatible';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  kind?: 'topic' | 'clarification' | 'answer' | 'status' | 'artifact';
}

export interface ContentBrief {
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

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  providerConfig: ProviderConfig;
  messages: Message[];
  brief: ContentBrief;
  status: SessionStatus;
  activeJobId?: string;
}

export interface BloggerDraftResult {
  blogId: string;
  postId: string;
  title: string;
  url?: string;
  selfLink?: string;
  published?: string;
  updated?: string;
  status?: string;
}

export interface JobArtifacts {
  outline?: string[];
  articleMarkdown?: string;
  articleHtml?: string;
  finalTitle?: string;
  linkedinDraft?: string;
  bloggerDraft?: BloggerDraftResult;
}

export interface JobError {
  stage: JobStatus;
  message: string;
}

export interface Job {
  id: string;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  status: JobStatus;
  frozenBrief: ContentBrief;
  artifacts: JobArtifacts;
  error?: JobError;
}
