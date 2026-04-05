import type { BloggerDraftResult } from '@content-os/shared';

export interface CreateDraftPostInput {
  blogId: string;
  title: string;
  contentHtml: string;
  labels?: string[];
}

export interface BlogSummary {
  id: string;
  name: string;
  url: string;
}

export interface BloggerPublisher {
  listBlogs(): Promise<BlogSummary[]>;
  createDraftPost(input: CreateDraftPostInput): Promise<BloggerDraftResult>;
}

export class BloggerMcpClient implements BloggerPublisher {
  async listBlogs(): Promise<BlogSummary[]> {
    return [{ id: 'local-blog', name: 'Local Content OS Blog', url: 'https://example.blogspot.com' }];
  }

  async createDraftPost(input: CreateDraftPostInput): Promise<BloggerDraftResult> {
    return {
      blogId: input.blogId,
      postId: `post_${Date.now()}`,
      title: input.title,
      url: `https://example.blogspot.com/draft/${Date.now()}`,
      selfLink: 'https://www.googleapis.com/blogger/v3/mock',
      status: 'DRAFT',
      updated: new Date().toISOString()
    };
  }
}
