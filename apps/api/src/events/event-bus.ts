type Listener<T> = (event: T) => void;

export class EventBus<T> {
  private listeners = new Set<Listener<T>>();

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: T): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export interface JobEvent {
  type: 'job.status_changed' | 'job.artifact_ready' | 'job.completed' | 'job.failed';
  jobId: string;
  status?: string;
  artifact?: string;
  timestamp: string;
  message?: string;
}
