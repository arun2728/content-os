import type { Job, Session } from '@content-os/shared';
import type { JobStore, SessionStore } from './interfaces.js';

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();

  async create(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async get(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async update(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }
}

export class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, Job>();

  async create(job: Job): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async get(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async update(job: Job): Promise<void> {
    this.jobs.set(job.id, job);
  }
}
