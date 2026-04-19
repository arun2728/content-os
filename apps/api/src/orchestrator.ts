import {
  ContentJob,
  Brief,
  Outline,
  Draft,
  EditedDraft,
  LinkedInDraft,
  ModelProvider,
  store,
  JobStageResult,
} from '@content-os/shared';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// ============================================================================
// JOB ORCHESTRATOR
// ============================================================================

/**
 * Orchestrates the full content generation pipeline:
   * clarify → outline → write → edit → linkedin → publish
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
    status: 'pending' | 'clarifying' | 'ready' | 'outlining' | 'writing' | 'editing' | 'generating_linkedin' | 'publishing' | 'completed' | 'failed',
    currentStage: 'clarify' | 'outline' | 'write' | 'edit' | 'linkedin' | 'publish'
  ): ContentJob {
    return store.updateJob(jobId, {
      status,
      currentStage,
    });
  }

  /**
   * Execute the LinkedIn draft stage.
   * Generates a concise LinkedIn post from the edited article + brief.
   */
  async executeLinkedInStage(
    job: ContentJob,
    editedDraft: EditedDraft,
    brief: Brief
  ): Promise<LinkedInDraft> {
    const systemPrompt = `You are a LinkedIn content strategist. Convert the following blog article into a compelling LinkedIn post.

Rules:
- Open with a strong hook in the first line that grabs attention
- Keep it under 3000 characters total
- Use short paragraphs (1-2 sentences each) with line breaks between them
- Include one clear summary arc that conveys the article's key insight
- End with a call-to-action or conversation prompt (e.g. a question)
- Do NOT spam hashtags — use at most 3 relevant ones at the very end
- Write in a natural, professional tone that matches the article
- Do NOT include any markdown formatting — plain text only`;

    const response = await this.modelProvider.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Article brief: ${brief.refinedPrompt || brief.initialPrompt}\n\nFull article:\n${editedDraft.content}`,
        },
      ],
      temperature: 0.7,
      maxTokens: 1500,
    });

    const linkedinDraftId = `linkedin_${Date.now()}`;
    const linkedinDraft: LinkedInDraft = {
      id: linkedinDraftId,
      editedDraftId: editedDraft.id,
      content: response.content,
      createdAt: new Date(),
    };

    store.createLinkedInDraft(linkedinDraft);
    return linkedinDraft;
  }

  /**
   * Execute publish stage via dev-to-mcp (create_article with published=false for draft).
   *
   * Connects to the standalone `ghcr.io/arun2728/dev-to-mcp` service over
   * Streamable HTTP. The URL is configurable via `DEVTO_MCP_URL` and defaults
   * to the docker-compose service name `http://devto-mcp:3000/mcp`.
   */
  async executePublishStage(
    job: ContentJob,
    editedDraft: EditedDraft,
    title: string
  ) {
    const mcpUrl = process.env.DEVTO_MCP_URL || 'http://devto-mcp:3000/mcp';

    console.log(`[Orchestrator] Connecting to dev.to MCP Server at ${mcpUrl}...`);

    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

    const mcpClient = new Client(
      {
        name: 'content-os-api',
        version: '0.1.0',
      },
      {
        capabilities: {},
      }
    );

    await mcpClient.connect(transport);

    try {
      console.log('[Orchestrator] Calling create_article tool on dev.to MCP...');
      const result = await mcpClient.callTool({
        name: 'create_article',
        arguments: {
          title: title || 'Generated Content Draft',
          body_markdown: editedDraft.content,
          published: false,
        },
      });

      if ((result as any).isError) {
        throw new Error(`MCP Tool Error: ${((result as any).content[0] as any).text}`);
      }

      const contentText = ((result as any).content[0] as any).text;
      const parsedPost = JSON.parse(contentText);

      console.log('[Orchestrator] Draft created successfully on dev.to via MCP.');

      const articleId = String(parsedPost.id);
      return {
        id: articleId,
        postUrl: parsedPost.url || `https://dev.to/dashboard/articles/${articleId}`,
        dashboardUrl: `https://dev.to/dashboard`,
        publishedAt: new Date(parsedPost.created_at || Date.now()),
      };
    } catch (err) {
      console.error('[Orchestrator] dev.to MCP Server invocation failed', err);
      throw err;
    } finally {
      try {
        await transport.close();
      } catch (e) {}
    }
  }
}
