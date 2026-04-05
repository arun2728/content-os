/**
 * OAuth2 Helper Script
 * 
 * This script helps you obtain OAuth2 tokens for the Blogger API.
 * 
 * Prerequisites:
 * 1. Go to https://console.cloud.google.com/apis/credentials
 * 2. Create an OAuth 2.0 Client ID (type: Web application)
 * 3. Add http://localhost:8085 as an Authorized redirect URI
 * 4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in apps/mcp-blogger/.env
 * 5. Run: npx tsx apps/mcp-blogger/scripts/get-oauth-token.ts
 * 6. Open the URL printed in the console, authorize, and the tokens will be saved to .env
 */

import * as http from 'http';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8085';
const SCOPES = 'https://www.googleapis.com/auth/blogger';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
  console.error('');
  console.error('Steps to set up:');
  console.error('1. Go to https://console.cloud.google.com/apis/credentials');
  console.error('2. Create an OAuth 2.0 Client ID (Web application)');
  console.error('3. Add http://localhost:8085 as an Authorized redirect URI');
  console.error('4. Add these to apps/mcp-blogger/.env:');
  console.error('   GOOGLE_CLIENT_ID=your_client_id');
  console.error('   GOOGLE_CLIENT_SECRET=your_client_secret');
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('🔗 Open this URL in your browser to authorize:\n');
console.log(authUrl);
console.log('\n⏳ Waiting for callback on http://localhost:8085 ...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '', REDIRECT_URI);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1>❌ Authorization failed</h1><p>${error}</p>`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>❌ No authorization code received</h1>');
    return;
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokens = await tokenResponse.json() as any;

    if (tokens.error) {
      throw new Error(`${tokens.error}: ${tokens.error_description}`);
    }

    console.log('✅ Tokens received successfully!\n');

    // Update .env file
    let envContent = fs.readFileSync(envPath, 'utf-8');

    // Add or update tokens in .env
    const updates: Record<string, string> = {
      GOOGLE_ACCESS_TOKEN: tokens.access_token,
    };

    if (tokens.refresh_token) {
      updates.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
    }

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');

    console.log('📝 Tokens saved to .env:');
    console.log(`   GOOGLE_ACCESS_TOKEN=${tokens.access_token.substring(0, 20)}...`);
    if (tokens.refresh_token) {
      console.log(`   GOOGLE_REFRESH_TOKEN=${tokens.refresh_token.substring(0, 20)}...`);
    }
    console.log(`\n   Token expires in ${tokens.expires_in} seconds.`);
    console.log('   The refresh token will be used to auto-renew expired tokens.');

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>✅ Authorization successful!</h1><p>You can close this tab. Tokens have been saved to .env</p>');

  } catch (err) {
    console.error('❌ Token exchange failed:', err);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>❌ Token exchange failed</h1><p>${err}</p>`);
  }

  server.close();
  process.exit(0);
});

server.listen(8085, () => {
  // Server ready
});
