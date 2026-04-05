import type { ContentBrief, Job, Message, ProviderConfig, Session } from '@content-os/shared';
import { applyUserInputToBrief } from './clarifier.js';
import type { JobStore, SessionStore } from '../stores/interfaces.js';
import { randomUUID } from 'node:crypto';

const DEFAULT_PROVIDER: ProviderConfig = {
  provider: (process.env.DEFAULT_PROVIDER as ProviderConfig['provider']) ?? 'openai_compatible',
  model: process.env.OPENAI_COMPATIBLE_MODEL ?? 'llama3'
};

function emptyBrief(): ContentBrief {
  return {
    topic: '',
    completenessScore: 0,
    missingFields: ['topic', 'audience', 'goal', 'tone', 'length', 'depth', 'coreArguments'],
    ready: false
  };
}

export class SessionService {
  constructor(
    private readonly sessions: SessionStore,
    private readonly jobs: JobStore
  ) {}

  async createSession(): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: `sess_${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      providerConfig: DEFAULT_PROVIDER,
      messages: [],
      brief: emptyBrief(),
      status: 'clarifying'
    };
    await this.sessions.create(session);
    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId);
  }

  async addMessage(sessionId: string, content: string): Promise<{ assistantMessage: string; session: Session }> {
    const session = await this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    if (!session.brief.topic) {
      session.brief.topic = content;
    }

    const userMessage: Message = {
      id: `msg_${randomUUID()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      kind: session.messages.length === 0 ? 'topic' : 'answer'
    };
    session.messages.push(userMessage);

    const clarifier = applyUserInputToBrief(session.brief, content);
    session.brief = { ...session.brief, ...clarifier.extractedUpdates };
    session.status = clarifier.ready ? 'ready' : 'clarifying';
    const assistantMessage = clarifier.ready
      ? 'Great — your brief is ready. Click “Start draft” to run the pipeline.'
      : clarifier.nextQuestion ?? 'Could you provide a little more detail?';

    session.messages.push({
      id: `msg_${randomUUID()}`,
      role: 'assistant',
      content: assistantMessage,
      createdAt: new Date().toISOString(),
      kind: 'clarification'
    });

    session.updatedAt = new Date().toISOString();
    await this.sessions.update(session);

    return { assistantMessage, session };
  }

  async updateProvider(sessionId: string, providerConfig: ProviderConfig): Promise<Session> {
    const session = await this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.providerConfig = providerConfig;
    session.updatedAt = new Date().toISOString();
    await this.sessions.update(session);
    return session;
  }

  async createJob(sessionId: string): Promise<Job> {
    const session = await this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    if (!session.brief.ready) throw new Error('Brief is not ready');

    const now = new Date().toISOString();
    const job: Job = {
      id: `job_${randomUUID()}`,
      sessionId: session.id,
      createdAt: now,
      updatedAt: now,
      status: 'queued',
      frozenBrief: structuredClone(session.brief),
      artifacts: {}
    };

    session.status = 'job_running';
    session.activeJobId = job.id;
    session.updatedAt = now;

    await this.jobs.create(job);
    await this.sessions.update(session);
    return job;
  }
}
