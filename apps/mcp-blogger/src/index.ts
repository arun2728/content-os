import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { BloggerClient } from './blogger-client';

// ============================================================================
// MCP SERVER FOR BLOGGER INTEGRATION (API KEY AUTH)
// ============================================================================

const server = new Server(
  {
    name: 'content-os-blogger',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const bloggerClient = new BloggerClient();

// ============================================================================
// TOOLS
// ============================================================================

const tools = [
  {
    name: 'get_posts',
    description:
      'Get a list of posts from the blog. Returns post titles, URLs, content, labels, and metadata.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        maxResults: {
          type: 'number',
          description:
            'Maximum number of posts to return (default: 10, max: 500)',
        },
        pageToken: {
          type: 'string',
          description: 'Token for pagination (from a previous response)',
        },
        labels: {
          type: 'string',
          description: 'Comma-separated list of labels to filter by',
        },
        fetchBodies: {
          type: 'boolean',
          description:
            'Whether to include post content bodies (default: true)',
        },
      },
    },
  },
  {
    name: 'get_post',
    description: 'Get a single post by its ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        postId: {
          type: 'string',
          description: 'The ID of the post to retrieve',
        },
      },
      required: ['postId'],
    },
  },
  {
    name: 'search_posts',
    description: 'Search blog posts by a query string',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find matching posts',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_blog',
    description:
      'Get blog metadata (name, description, URL, post count, etc.)',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'create_draft',
    description: 'Create a new draft post on Blogger',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Title of the draft post',
        },
        content: {
          type: 'string',
          description: 'HTML content of the draft post',
        },
      },
      required: ['title', 'content'],
    },
  },
];

// ============================================================================
// HANDLERS
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_posts': {
      console.error(`[MCP Blogger] Tool called: get_posts. Arguments:`, args);
      try {
        const { maxResults, pageToken, labels, fetchBodies } = (args || {}) as {
          maxResults?: number;
          pageToken?: string;
          labels?: string;
          fetchBodies?: boolean;
        };

        const result = await bloggerClient.getPosts({
          maxResults: maxResults || 10,
          pageToken,
          labels,
          fetchBodies: fetchBodies ?? true,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error fetching posts: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case 'get_post': {
      console.error(`[MCP Blogger] Tool called: get_post. Arguments:`, args);
      try {
        const { postId } = args as { postId: string };
        const result = await bloggerClient.getPost(postId);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error fetching post: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case 'search_posts': {
      console.error(`[MCP Blogger] Tool called: search_posts. Arguments:`, args);
      try {
        const { query } = args as { query: string };
        const result = await bloggerClient.searchPosts(query);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error searching posts: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case 'get_blog': {
      console.error(`[MCP Blogger] Tool called: get_blog.`);
      try {
        const result = await bloggerClient.getBlog();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error fetching blog: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case 'create_draft': {
      console.error(`[MCP Blogger] Tool called: create_draft. Arguments:`, { title: (args as any)?.title });
      try {
        const { title, content } = args as { title: string; content: string };
        const result = await bloggerClient.createDraft(title, content);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error creating draft: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }

    default:
      return {
        content: [
          {
            type: 'text' as const,
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
  }
});

// ============================================================================
// SERVER START
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP Env BLOGGER_BLOG_ID] ', process.env.BLOGGER_BLOG_ID);
  console.error('[MCP Env] ', process.env.BLOGGER_API_KEY ? '(Secret exists)' : '(Missing)');
  console.error('[MCP Blogger] Server is up and connected to stdio transport');
}

main().catch(console.error);
