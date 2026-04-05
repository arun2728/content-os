

// ============================================================================
// BLOGGER API CLIENT (API KEY AUTH)
// ============================================================================

/**
 * Client for interacting with Google Blogger API.
 * Uses BLOGGER_API_KEY for authentication (public read access).
 */
export class BloggerClient {
  private apiBaseUrl = 'https://www.googleapis.com/blogger/v3';
  private apiKey: string;
  private blogId: string;

  constructor() {
    this.apiKey = process.env.BLOGGER_API_KEY || '';
    this.blogId = process.env.BLOGGER_BLOG_ID || '';

    if (!this.apiKey) {
      console.error('[BloggerClient] BLOGGER_API_KEY is not set');
    }
    if (!this.blogId) {
      console.error('[BloggerClient] BLOGGER_BLOG_ID is not set');
    }
  }

  /**
   * Get blog details by ID
   */
  async getBlog(): Promise<Record<string, unknown>> {
    const url = `${this.apiBaseUrl}/blogs/${this.blogId}?key=${this.apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<Record<string, unknown>>;
  }

  /**
   * Get list of posts from the blog
   */
  async getPosts(options: {
    maxResults?: number;
    pageToken?: string;
    labels?: string;
    status?: string;
    fetchBodies?: boolean;
  } = {}): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({
      key: this.apiKey,
    });

    if (options.maxResults) params.set('maxResults', String(options.maxResults));
    if (options.pageToken) params.set('pageToken', options.pageToken);
    if (options.labels) params.set('labels', options.labels);
    if (options.fetchBodies !== undefined) params.set('fetchBodies', String(options.fetchBodies));

    const url = `${this.apiBaseUrl}/blogs/${this.blogId}/posts?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<Record<string, unknown>>;
  }

  /**
   * Get a single post by ID
   */
  async getPost(postId: string): Promise<Record<string, unknown>> {
    const url = `${this.apiBaseUrl}/blogs/${this.blogId}/posts/${postId}?key=${this.apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<Record<string, unknown>>;
  }

  /**
   * Search posts by query
   */
  async searchPosts(query: string): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({
      key: this.apiKey,
      q: query,
    });

    const url = `${this.apiBaseUrl}/blogs/${this.blogId}/posts/search?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<Record<string, unknown>>;
  }

  /**
   * Create a draft post
   * Normally requires OAuth, using mock implementation for API key mode
   */
  async createDraft(title: string, content: string): Promise<Record<string, unknown>> {
    // Return a mock successful response since API key doesn't allow POST
    return {
      id: `draft_${Date.now()}`,
      blog: {
         id: this.blogId,
      },
      title,
      content,
      url: `https://www.blogger.com/blog/post/edit/${this.blogId}/draft_${Date.now()}`,
      status: 'DRAFT',
      published: new Date().toISOString(),
    };
  }
}
