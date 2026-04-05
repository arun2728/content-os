import {
  Server,
  Tool,
  TextContent,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/server/index.js';
import {
  StdioServerTransport,
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/server/stdio.js';
import { BloggerClient } from './blogger-client';

// ============================================================================
// MCP SERVER FOR BLOGGER INTEGRATION
// ============================================================================

const server = new Server({
  name: 'content-os-blogger',
  version: '0.1.0',
});

const bloggerClient = new BloggerClient();

// ============================================================================
// TOOLS
// ============================================================================

const tools: Tool[] = [
  {
    name: 'publish_draft_to_blogger',
    description: 'Publish a draft post to Google Blogger',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Post title',
        },
        content: {
          type: 'string',
          description: 'Post content (HTML or plain text)',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Post labels/tags',
        },
        isDraft: {
          type: 'boolean',
          description: 'Whether to save as draft (true) or publish immediately (false)',
          default: true,
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'list_blogs',
    description: 'List authenticated user blogs',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'authenticate_blogger',
    description: 'Authenticate with Google Blogger (OAuth flow)',
    inputSchema: {
      type: 'object',
      properties: {
        authCode: {
          type: 'string',
          description: 'OAuth authorization code from Google',
        },
      },
      required: ['authCode'],
    },
  },
];

// ============================================================================
// HANDLERS
// ============================================================================

server.setRequestHandler(async (request) => {
  if (request.method === 'tools/list') {
    return { tools };
  }

  if (request.method === 'tools/call') {
    const callRequest = request as CallToolRequest;
    const { name, arguments: args } = callRequest.params;

    switch (name) {
      case 'publish_draft_to_blogger':
        try {
          const { title, content, labels, isDraft } = args as {
            title: string;
            content: string;
            labels?: string[];
            isDraft?: boolean;
          };

          // For v1, use a default blog ID
          const blogId = process.env.BLOGGER_BLOG_ID || 'default-blog';

          const result = await bloggerClient.publishPost(
            blogId,
            title,
            content,
            isDraft ?? true
          );

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
                text: `Error publishing post: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }

      case 'list_blogs':
        try {
          const blogs = await bloggerClient.listBlogs();
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(blogs, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error listing blogs: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }

      case 'authenticate_blogger':
        try {
          const { authCode } = args as { authCode: string };
          await bloggerClient.handleAuthorizationCode(authCode);

          return {
            content: [
              {
                type: 'text' as const,
                text: 'Successfully authenticated with Blogger',
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error authenticating: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
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
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: 'Unknown request',
      },
    ],
    isError: true,
  };
});

// ============================================================================
// SERVER START
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP Blogger] Connected to stdio transport');
}

main().catch(console.error);
