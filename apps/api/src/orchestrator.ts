import {
  ContentJob,
  Brief,
  Outline,
  Draft,
  EditedDraft,
  ModelProvider,
  store,
  JobStageResult,
} from '@content-os/shared';

// ============================================================================
// JOB ORCHESTRATOR
// ============================================================================

/**
 * Orchestrates the full content generation pipeline:
 * clarify → outline → write → edit → publish
 *
 * Each stage produces artifacts that feed into the next stage.
 */
export class JobOrchestrator {
  constructor(private modelProvider: ModelProvider) {}

  /**
   * Execute the outline stage
   */
  async executeOutlineStage(job: ContentJob, brief: Brief): Promise<Outline> {
    const systemPrompt = `You are a content structure expert. Based on the brief, create a detailed outline 
for the content. Structure it hierarchically with clear sections and subsections.

Return your response as JSON with:
{
  "items": [
    {
      "id": "unique-id",
      "title": "Section Title",
      "description": "Brief description of what this section covers",
      "depth": 0
    }
  ]
}

Depth indicates nesting level (0 for main sections, 1 for subsections, etc.)
Aim for 5-8 main sections with relevant subsections.`;

    const response = await this.modelProvider.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Create an outline for this content:\n\n${
            brief.refinedPrompt || brief.initialPrompt
          }`,
        },
      ],
      temperature: 0.7,
      maxTokens: 2000,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid outline response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const outlineId = `outline_${Date.now()}`;

      const outline: Outline = {
        id: outlineId,
        briefId: brief.id,
        items: parsed.items || [],
        createdAt: new Date(),
      };

      store.createOutline(outline);
      return outline;
    } catch (error) {
      console.error('[Orchestrator] Error parsing outline:', error);
      throw new Error('Failed to generate outline');
    }
  }

  /**
   * Execute the write stage
   */
  async executeWriteStage(
    job: ContentJob,
    brief: Brief,
    outline: Outline
  ): Promise<Draft> {
    const outlineText = outline.items
      .map((item) => `${'  '.repeat(item.depth)}• ${item.title}`)
      .join('\n');

    const systemPrompt = `You are a professional content writer. Based on the brief and outline, 
write comprehensive, engaging content. 

Guidelines:
- Follow the outline structure
- Write in the tone specified in the brief
- Make content engaging and valuable to the audience
- Include transitions between sections
- Aim for natural, readable prose`;

    const response = await this.modelProvider.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Brief: ${
            brief.refinedPrompt || brief.initialPrompt
          }\n\nOutline:\n${outlineText}`,
        },
      ],
      temperature: 0.7,
      maxTokens: 3500,
    });

    const draftId = `draft_${Date.now()}`;
    const draft: Draft = {
      id: draftId,
      briefId: brief.id,
      outlineId: outline.id,
      content: response.content,
      createdAt: new Date(),
    };

    store.createDraft(draft);
    return draft;
  }

  /**
   * Execute the edit stage
   */
  async executeEditStage(
    job: ContentJob,
    draft: Draft
  ): Promise<EditedDraft> {
    const systemPrompt = `You are a professional editor. Review and improve the following content.
Focus on:
- Clarity and readability
- Grammar and punctuation
- Flow and coherence
- Engagement and impact
- Removing redundancy

Provide the improved version of the content.`;

    const response = await this.modelProvider.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Please edit this draft:\n\n${draft.content}`,
        },
      ],
      temperature: 0.5, // Lower temperature for editing
      maxTokens: 3500,
    });

    const editedDraftId = `edited_draft_${Date.now()}`;
    const editedDraft: EditedDraft = {
      id: editedDraftId,
      draftId: draft.id,
      content: response.content,
      suggestions: [],
      createdAt: new Date(),
    };

    store.createEditedDraft(editedDraft);
    return editedDraft;
  }

  /**
   * Add a stage result to the job
   */
  addStageResult(
    job: ContentJob,
    stage: JobStageResult
  ): ContentJob {
    const updated = store.updateJob(job.id, {
      stageResults: [...job.stageResults, stage],
    });
    return updated;
  }

  /**
   * Update job progress
   */
  updateJobProgress(
    jobId: string,
    status: 'pending' | 'clarifying' | 'ready' | 'outlining' | 'writing' | 'editing' | 'publishing' | 'completed' | 'failed',
    currentStage: 'clarify' | 'outline' | 'write' | 'edit' | 'publish'
  ): ContentJob {
    return store.updateJob(jobId, {
      status,
      currentStage,
    });
  }

  /**
   * Execute publish stage (placeholder)
   */
  async executePublishStage(
    job: ContentJob,
    editedDraft: EditedDraft,
    title: string
  ) {
    // In a real implementation, this would:
    // 1. Call the MCP Blogger server
    // 2. Handle OAuth flow if needed
    // 3. Publish the post
    // 4. Return the published post URL

    // For v1, return a mock post
    return {
      id: `post_${Date.now()}`,
      blogUrl: 'https://example.blogspot.com',
      postUrl: `https://example.blogspot.com/post-${Date.now()}.html`,
      publishedAt: new Date(),
    };
  }
}
