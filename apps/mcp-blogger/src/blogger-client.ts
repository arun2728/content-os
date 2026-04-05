import { BloggerCredentials, PublishedPost } from '@content-os/shared';
import { CredentialManager } from './credentials';

// ============================================================================
// BLOGGER API CLIENT
// ============================================================================

/**
 * Client for interacting with Google Blogger API.
 * Handles OAuth token management and post publication.
 */
export class BloggerClient {
  private credManager: CredentialManager;
  private credentials: BloggerCredentials | null = null;
  private apiBaseUrl = 'https://www.googleapis.com/blogger/v3';

  constructor() {
    this.credManager = new CredentialManager();
  }

  /**
   * Initialize with stored credentials or perform OAuth flow
   */
  async initialize(): Promise<boolean> {
    try {
      this.credentials =
        await this.credManager.loadCredentials();

      if (this.credentials) {
        // Check if token needs refresh
        if (
          this.credentials.expiresAt &&
          this.credentials.expiresAt < Date.now() / 1000
        ) {
          await this.refreshToken();
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('[BloggerClient] Error initializing:', error);
      return false;
    }
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.credentials?.accessToken;
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(redirectUri: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const scope = encodeURIComponent(
      'https://www.googleapis.com/auth/blogger'
    );

    return (
      'https://accounts.google.com/o/oauth2/v2/auth?' +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${scope}&` +
      `access_type=offline`
    );
  }

  /**
   * Exchange authorization code for tokens
   */
  async handleAuthorizationCode(code: string): Promise<void> {
    try {
      const response = await fetch(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirect_uri:
              process.env.GOOGLE_REDIRECT_URI || '',
            grant_type: 'authorization_code',
          }).toString(),
        }
      );

      if (!response.ok) {
        throw new Error(`OAuth token error: ${response.status}`);
      }

      const tokenData = await response.json();

      this.credentials = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt:
          Math.floor(Date.now() / 1000) +
          tokenData.expires_in,
      };

      await this.credManager.saveCredentials(
        this.credentials
      );

      console.log('[BloggerClient] Authorization successful');
    } catch (error) {
      console.error(
        '[BloggerClient] Error handling authorization:',
        error
      );
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshToken(): Promise<void> {
    if (!this.credentials?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            refresh_token: this.credentials.refreshToken,
            grant_type: 'refresh_token',
          }).toString(),
        }
      );

      if (!response.ok) {
        throw new Error(`Token refresh error: ${response.status}`);
      }

      const tokenData = await response.json();

      this.credentials.accessToken = tokenData.access_token;
      this.credentials.expiresAt =
        Math.floor(Date.now() / 1000) + tokenData.expires_in;

      await this.credManager.saveCredentials(
        this.credentials
      );

      console.log('[BloggerClient] Token refreshed');
    } catch (error) {
      console.error(
        '[BloggerClient] Error refreshing token:',
        error
      );
      throw error;
    }
  }

  /**
   * Get list of user's blogs
   */
  async listBlogs(): Promise<
    Array<{ id: string; name: string; url: string }>
  > {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/blogs/byurl?url=&key=${process.env.GOOGLE_API_KEY}`,
        {
          headers: {
            Authorization: `Bearer ${this.credentials!.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // For now, return empty array (full implementation would parse response)
      return [];
    } catch (error) {
      console.error('[BloggerClient] Error listing blogs:', error);
      throw error;
    }
  }

  /**
   * Publish a post to Blogger
   */
  async publishPost(
    blogId: string,
    title: string,
    content: string,
    isDraft: boolean = false
  ): Promise<PublishedPost> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/blogs/${blogId}/posts${
          isDraft ? '/draft' : ''
        }?key=${process.env.GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.credentials!.accessToken}`,
          },
          body: JSON.stringify({
            title,
            content,
            labels: [],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Publish error: ${response.status}`);
      }

      const postData = await response.json();

      return {
        id: postData.id || `post_${Date.now()}`,
        blogUrl: `blogger.com/blog/${blogId}`,
        postUrl: postData.url || '',
        publishedAt: new Date(),
      };
    } catch (error) {
      console.error('[BloggerClient] Error publishing post:', error);
      throw error;
    }
  }
}
