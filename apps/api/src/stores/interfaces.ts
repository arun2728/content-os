import type { Job, Session } from '@content-os/shared';

export interface SessionStore {
  create(session: Session): Promise<void>;
  get(sessionId: string): Promise<Session | null>;
  update(session: Session): Promise<void>;
}

export interface JobStore {
  create(job: Job): Promise<void>;
  get(jobId: string): Promise<Job | null>;
  update(job: Job): Promise<void>;
}
