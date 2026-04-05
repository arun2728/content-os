import express from 'express';

const app = express();

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html>
  <head>
    <title>Content OS</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; line-height: 1.5; }
      .card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; max-width: 760px; }
      code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>Content OS v1 Skeleton</h1>
    <div class="card">
      <p>API: <code>http://localhost:4000</code></p>
      <p>MCP Blogger: <code>http://localhost:4100</code></p>
      <p>This web app is intentionally minimal in v1 bootstrap mode. Use API endpoints to drive the clarification + job pipeline.</p>
    </div>
  </body>
</html>`);
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Web server listening on http://localhost:${port}`);
});
