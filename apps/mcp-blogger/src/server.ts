import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const app = express();
app.use(express.json());

const blogs = [{ id: 'local-blog', name: 'Local Content OS Blog', url: 'https://example.blogspot.com' }];
const posts = new Map<string, Record<string, unknown>>();

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mcp-blogger', timestamp: new Date().toISOString() });
});

app.post('/tools/list_blogs', (_req, res) => {
  res.json({ blogs });
});

const CreateDraftSchema = z.object({
  blogId: z.string().min(1),
  title: z.string().min(1),
  contentHtml: z.string().min(1),
  labels: z.array(z.string()).optional()
});

app.post('/tools/create_draft_post', (req, res) => {
  const parsed = CreateDraftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const postId = `post_${randomUUID()}`;
  const response = {
    postId,
    title: parsed.data.title,
    url: `https://example.blogspot.com/draft/${postId}`,
    selfLink: `https://www.googleapis.com/blogger/v3/blogs/${parsed.data.blogId}/posts/${postId}`,
    status: 'DRAFT'
  };
  posts.set(`${parsed.data.blogId}:${postId}`, response);
  res.json(response);
});

const GetPostSchema = z.object({ blogId: z.string().min(1), postId: z.string().min(1) });
app.post('/tools/get_post', (req, res) => {
  const parsed = GetPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const found = posts.get(`${parsed.data.blogId}:${parsed.data.postId}`);
  if (!found) return res.status(404).json({ error: 'Post not found' });
  res.json(found);
});

const port = Number(process.env.MCP_BLOGGER_PORT ?? 4100);
app.listen(port, () => {
  console.log(`Blogger MCP server listening on http://localhost:${port}`);
});
