

// ============================================================================
// BLOGGER API CLIENT (API KEY + OAuth2)
// ============================================================================

/**
 * Client for interacting with Google Blogger API.
 * Uses BLOGGER_API_KEY for read access and OAuth2 tokens for write access.
 */
export class BloggerClient {
  private apiBaseUrl = 'https://www.googleapis.com/blogger/v3';
  private apiKey: string;
  private blogId: string;
  private accessToken: string;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.apiKey = process.env.BLOGGER_API_KEY || '';
    this.blogId = process.env.BLOGGER_BLOG_ID || '';
    this.accessToken = process.env.GOOGLE_ACCESS_TOKEN || '';
    this.refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

    if (!this.apiKey) {
      console.error('[BloggerClient] BLOGGER_API_KEY is not set');
    }
    if (!this.blogId) {
      console.error('[BloggerClient] BLOGGER_BLOG_ID is not set');
    }
    if (!this.accessToken) {
      console.error('[BloggerClient] GOOGLE_ACCESS_TOKEN is not set (write operations will fail)');
    }
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error('Cannot refresh token: missing GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, or GOOGLE_CLIENT_SECRET');
    }

    console.error('[BloggerClient] Refreshing access token...');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json() as any;

    if (data.error) {
      throw new Error(`Token refresh failed: ${data.error} - ${data.error_description}`);
    }

    this.accessToken = data.access_token;
    console.error('[BloggerClient] Access token refreshed successfully.');
    return this.accessToken;
  }

  /**
   * Make an authenticated write request, with auto-retry on 401
   */
  private async authenticatedFetch(url: string, options: RequestInit): Promise<Response> {
    const makeRequest = (token: string) =>
      fetch(url, {
        ...options,
        headers: {
          ...options.headers as Record<string, string>,
          'Authorization': `Bearer ${token}`,
        },
      });

    let response = await makeRequest(this.accessToken);

    // If 401, try refreshing the token and retry once
    if (response.status === 401 && this.refreshToken) {
      console.error('[BloggerClient] Got 401, attempting token refresh...');
      const newToken = await this.refreshAccessToken();
      response = await makeRequest(newToken);
    }

    return response;
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
   * Create a draft post on Blogger (requires OAuth2)
   */
  async createDraft(title: string, content: string): Promise<Record<string, unknown>> {
    if (!this.accessToken) {
      throw new Error(
        'OAuth2 access token is required to create drafts. ' +
        'Run: npx tsx apps/mcp-blogger/scripts/get-oauth-token.ts'
      );
    }

    const url = `${this.apiBaseUrl}/blogs/${this.blogId}/posts?isDraft=true`;

    console.error(`[BloggerClient] Creating draft: "${title}" on blog ${this.blogId}`);

    const response = await this.authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'blogger#post',
        blog: { id: this.blogId },
        title,
        content,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[BloggerClient] Draft creation failed: ${response.status} - ${errorBody}`);
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    const result = await response.json() as Record<string, unknown>;
    console.error(`[BloggerClient] Draft created successfully. Post ID: ${result.id}, URL: ${result.url}`);
    return result;
  }
}

