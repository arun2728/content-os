import {
  Brief,
  ContentJob,
  Outline,
  Draft,
  EditedDraft,
  PublishedPost,
} from './index';

// ============================================================================
// IN-MEMORY STORES
// ============================================================================

/**
 * Central store for all application state.
 * In v1, everything is stored in-memory and lost on server restart.
 * Future versions can replace this with persistent storage.
 */
export class ContentStore {
  private jobs: Map<string, ContentJob> = new Map();
  private briefs: Map<string, Brief> = new Map();
  private outlines: Map<string, Outline> = new Map();
  private drafts: Map<string, Draft> = new Map();
  private editedDrafts: Map<string, EditedDraft> = new Map();
  private publishedPosts: Map<string, PublishedPost> = new Map();

  // Subscribers for real-time updates
  private jobSubscribers: Map<string, Set<Function>> = new Map();

  // ========================================================================
  // JOB OPERATIONS
  // ========================================================================

  createJob(job: ContentJob): ContentJob {
    this.jobs.set(job.id, job);
    this.notifyJobUpdate(job.id, job);
    return job;
  }

  getJob(jobId: string): ContentJob | undefined {
    return this.jobs.get(jobId);
  }

  updateJob(jobId: string, updates: Partial<ContentJob>): ContentJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const updated = {
      ...job,
      ...updates,
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, updated);
    this.notifyJobUpdate(jobId, updated);
    return updated;
  }

  listJobs(): ContentJob[] {
    return Array.from(this.jobs.values());
  }

  // ========================================================================
  // BRIEF OPERATIONS
  // ========================================================================

  createBrief(brief: Brief): Brief {
    this.briefs.set(brief.id, brief);
    return brief;
  }

  getBrief(briefId: string): Brief | undefined {
    return this.briefs.get(briefId);
  }

  updateBrief(briefId: string, updates: Partial<Brief>): Brief {
    const brief = this.briefs.get(briefId);
    if (!brief) {
      throw new Error(`Brief not found: ${briefId}`);
    }

    const updated = { ...brief, ...updates };
    this.briefs.set(briefId, updated);
    return updated;
  }

  // ========================================================================
  // OUTLINE OPERATIONS
  // ========================================================================

  createOutline(outline: Outline): Outline {
    this.outlines.set(outline.id, outline);
    return outline;
  }

  getOutline(outlineId: string): Outline | undefined {
    return this.outlines.get(outlineId);
  }

  // ========================================================================
  // DRAFT OPERATIONS
  // ========================================================================

  createDraft(draft: Draft): Draft {
    this.drafts.set(draft.id, draft);
    return draft;
  }

  getDraft(draftId: string): Draft | undefined {
    return this.drafts.get(draftId);
  }

  // ========================================================================
  // EDITED DRAFT OPERATIONS
  // ========================================================================

  createEditedDraft(editedDraft: EditedDraft): EditedDraft {
    this.editedDrafts.set(editedDraft.id, editedDraft);
    return editedDraft;
  }

  getEditedDraft(editedDraftId: string): EditedDraft | undefined {
    return this.editedDrafts.get(editedDraftId);
  }

  // ========================================================================
  // PUBLISHED POST OPERATIONS
  // ========================================================================

  createPublishedPost(post: PublishedPost): PublishedPost {
    this.publishedPosts.set(post.id, post);
    return post;
  }

  getPublishedPost(postId: string): PublishedPost | undefined {
    return this.publishedPosts.get(postId);
  }

  // ========================================================================
  // SUBSCRIPTIONS (for SSE/real-time updates)
  // ========================================================================

  subscribeToJob(jobId: string, callback: (job: ContentJob) => void): () => void {
    if (!this.jobSubscribers.has(jobId)) {
      this.jobSubscribers.set(jobId, new Set());
    }

    const subscribers = this.jobSubscribers.get(jobId)!;
    subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      subscribers.delete(callback);
    };
  }

  private notifyJobUpdate(jobId: string, job: ContentJob): void {
    const subscribers = this.jobSubscribers.get(jobId);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(job);
        } catch (error) {
          console.error('[Store] Error notifying subscriber:', error);
        }
      });
    }
  }

  // ========================================================================
  // UTILITY
  // ========================================================================

  clear(): void {
    this.jobs.clear();
    this.briefs.clear();
    this.outlines.clear();
    this.drafts.clear();
    this.editedDrafts.clear();
    this.publishedPosts.clear();
    this.jobSubscribers.clear();
  }

  getStats(): {
    jobsCount: number;
    briefs Count: number;
    outlinesCount: number;
    draftsCount: number;
  } {
    return {
      jobsCount: this.jobs.size,
      'briefs Count': this.briefs.size,
      outlinesCount: this.outlines.size,
      draftsCount: this.drafts.size,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const store = new ContentStore();
