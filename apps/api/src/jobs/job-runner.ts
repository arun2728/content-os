import type { ContentBrief, Job, JobStatus } from '@content-os/shared';
import type { JobStore, SessionStore } from '../stores/interfaces.js';
import type { EventBus, JobEvent } from '../events/event-bus.js';
import { createProvider } from '../providers/factory.js';
import type { BloggerPublisher } from '../mcp/blogger-client.js';

interface Dependencies {
  sessionStore: SessionStore;
  jobStore: JobStore;
  eventBus: EventBus<JobEvent>;
  bloggerPublisher: BloggerPublisher;
}

export class JobRunner {
  constructor(private readonly deps: Dependencies) {}

  async start(jobId: string): Promise<void> {
    const job = await this.deps.jobStore.get(jobId);
    if (!job) return;

    try {
      await this.setStatus(job, 'running');
      await this.setStatus(job, 'outlining');
      const outline = this.generateOutline(job.frozenBrief);
      job.artifacts.outline = outline;
      await this.deps.jobStore.update(job);
      this.emit({ type: 'job.artifact_ready', jobId: job.id, artifact: 'outline', timestamp: new Date().toISOString() });

      await this.setStatus(job, 'writing');
      const provider = createProvider((await this.deps.sessionStore.get(job.sessionId))!.providerConfig);
      const article = await provider.generateText({
        systemPrompt: 'Write a detailed blog post from an outline.',
        userPrompt: `${job.frozenBrief.topic}\n\nOutline:\n${outline.map((s) => `- ${s}`).join('\n')}`
      });
      job.artifacts.articleMarkdown = `# ${job.frozenBrief.topic}\n\n${article.text}`;
      await this.deps.jobStore.update(job);
      this.emit({ type: 'job.artifact_ready', jobId: job.id, artifact: 'articleMarkdown', timestamp: new Date().toISOString() });

      await this.setStatus(job, 'editing');
      job.artifacts.finalTitle = this.finalTitle(job.frozenBrief);
      job.artifacts.articleHtml = this.toHtml(job.artifacts.articleMarkdown ?? '');
      await this.deps.jobStore.update(job);

      await this.setStatus(job, 'generating_linkedin');
      job.artifacts.linkedinDraft = this.linkedinDraft(job.frozenBrief, job.artifacts.finalTitle ?? job.frozenBrief.topic);
      await this.deps.jobStore.update(job);

      await this.setStatus(job, 'publishing_draft');
      job.artifacts.bloggerDraft = await this.deps.bloggerPublisher.createDraftPost({
        blogId: 'local-blog',
        title: job.artifacts.finalTitle ?? job.frozenBrief.topic,
        contentHtml: job.artifacts.articleHtml ?? '<p></p>'
      });
      await this.deps.jobStore.update(job);

      await this.setStatus(job, 'completed');
      this.emit({ type: 'job.completed', jobId: job.id, status: 'completed', timestamp: new Date().toISOString() });

      const session = await this.deps.sessionStore.get(job.sessionId);
      if (session) {
        session.status = 'completed';
        session.updatedAt = new Date().toISOString();
        await this.deps.sessionStore.update(session);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown failure';
      job.status = 'failed';
      job.updatedAt = new Date().toISOString();
      job.error = { stage: job.status, message };
      await this.deps.jobStore.update(job);
      this.emit({ type: 'job.failed', jobId: job.id, status: 'failed', timestamp: new Date().toISOString(), message });
    }
  }

  private async setStatus(job: Job, status: JobStatus): Promise<void> {
    job.status = status;
    job.updatedAt = new Date().toISOString();
    await this.deps.jobStore.update(job);
    this.emit({ type: 'job.status_changed', jobId: job.id, status, timestamp: new Date().toISOString() });
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  private emit(event: JobEvent): void {
    this.deps.eventBus.publish(event);
  }

  private generateOutline(brief: ContentBrief): string[] {
    return [
      `Why ${brief.topic} matters now`,
      `Core arguments for ${brief.audience ?? 'your audience'}`,
      'Implementation guidance and examples',
      `Conclusion and next steps: ${brief.callToAction ?? 'apply these ideas in your workflow'}`
    ];
  }

  private finalTitle(brief: ContentBrief): string {
    return `From Idea to Draft: ${brief.topic}`;
  }

  private toHtml(markdown: string): string {
    return markdown
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
        if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
        return `<p>${line}</p>`;
      })
      .join('\n');
  }

  private linkedinDraft(brief: ContentBrief, title: string): string {
    return `Hook: Most teams stall at the idea stage.\n\nToday I published a new draft: \"${title}\" for ${brief.audience ?? 'builders'}.\n\nIf you're working on ${brief.topic}, this gives you a practical path from rough idea to a usable draft.\n\nWhat would you add to this workflow?`;
  }
}
