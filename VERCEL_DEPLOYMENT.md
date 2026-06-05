# Vercel Deployment Guide

Step-by-step guide to deploy the Claude Chat Backend to Vercel.

## Prerequisites

- Vercel account (sign up at [vercel.com](https://vercel.com))
- GitHub repo with backend code
- Firebase credentials
- Claude API key

## Step 1: Prepare Code for Deployment

### 1.1 Build Test

```bash
npm run build
```

Verify `dist/` folder has compiled code.

### 1.2 Verify package.json

Ensure scripts are correct:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### 1.3 Check vercel.json

Confirm `vercel.json` is at root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/index.js"
    }
  ]
}
```

## Step 2: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Claude chat backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/claude-chat-backend.git
git push -u origin main
```

## Step 3: Create Vercel Project

### Option A: Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
```

Follow prompts:
- Select GitHub repo
- Confirm project name
- Set production branch to `main`

### Option B: Via Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Select your GitHub repo
4. Click "Import"
5. Confirm settings
6. Click "Deploy"

## Step 4: Configure Environment Variables

### Via Vercel CLI

```bash
vercel env add FIREBASE_PROJECT_ID
# Enter: your-project-id

vercel env add FIREBASE_PRIVATE_KEY
# Enter: -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n

vercel env add FIREBASE_CLIENT_EMAIL
# Enter: your-email@appspot.gserviceaccount.com

vercel env add CLAUDE_API_KEY
# Enter: sk-ant-xxxxx

vercel env add NODE_ENV
# Enter: production

vercel env add QR_TOKEN_EXPIRY_MINUTES
# Enter: 5

vercel env add RATE_LIMIT_WINDOW_MS
# Enter: 900000

vercel env add RATE_LIMIT_MAX_REQUESTS
# Enter: 100
```

### Via Vercel Dashboard

1. Go to project settings
2. Click "Environment Variables"
3. Add each variable:

| Variable | Value |
|----------|-------|
| `FIREBASE_PROJECT_ID` | your-project-id |
| `FIREBASE_PRIVATE_KEY` | Private key from service account |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `CLAUDE_API_KEY` | sk-ant-xxxxx |
| `NODE_ENV` | production |
| `RATE_LIMIT_WINDOW_MS` | 900000 |
| `RATE_LIMIT_MAX_REQUESTS` | 100 |

### Setting BACKEND_URL

After first deployment:

1. Get your Vercel URL (e.g., `https://my-app.vercel.app`)
2. Add environment variable:
   - `BACKEND_URL`: `https://my-app.vercel.app`

## Step 5: Deploy

### First Deployment

```bash
vercel deploy --prod
```

### Subsequent Deployments

Auto-deploy on git push to `main`:

```bash
git add .
git commit -m "Update backend"
git push
```

Vercel will auto-build and deploy.

## Step 6: Verify Deployment

### Check Deployment Status

```bash
vercel projects list
vercel deployments
```

### Test Health Endpoint

```bash
curl https://your-app.vercel.app/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 123.45
}
```

### Test QR Token Endpoint

```bash
curl -X POST https://your-app.vercel.app/auth/qr-token
```

Expected response:

```json
{
  "token": "abc123...",
  "deviceId": "550e8400-...",
  "expiresAt": 1704110000000,
  "expiresIn": 300000,
  "backendUrl": "https://your-app.vercel.app"
}
```

## Step 7: Configure Vercel Domains

### Add Custom Domain

1. Go to project settings
2. Click "Domains"
3. Enter your domain (e.g., `api.claude-chat.com`)
4. Add DNS records (Vercel provides instructions)

### HTTPS

Vercel automatically provisions SSL certificates. HTTPS is enabled by default.

## Step 8: Monitoring & Logs

### View Logs

```bash
vercel logs my-app
```

### Real-time Logs

```bash
vercel logs my-app --follow
```

### Filter Logs

```bash
vercel logs my-app | grep ERROR
```

### Via Vercel Dashboard

1. Go to project
2. Click "Logs" tab
3. View deployment logs

## Step 9: Performance Optimization

### Enable Caching

Add to `vercel.json`:

```json
{
  "routes": [
    {
      "src": "/health",
      "dest": "dist/index.js",
      "headers": {
        "Cache-Control": "max-age=60"
      }
    }
  ]
}
```

### Request Size Limits

Vercel has limits on request body size. Current: 5 MB.

Backend is configured to accept max 1 MB per request.

## Step 10: Database Connection Optimization

### Connection Pooling

For production, configure Firestore connection pooling:

```typescript
// In firebase.ts
const firestore = admin.firestore();
firestore.settings({
  maxRetries: 3,
  useFallbackRts: true,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
```

### Firestore Indexes

For complex queries, create indexes:

```bash
firebase deploy --only firestore:indexes
```

## Troubleshooting

### Deployment Failed

Check logs:

```bash
vercel logs my-app --error
```

Common issues:
- Missing environment variables
- Build errors (run `npm run build` locally)
- Invalid `vercel.json` format

### Timeout Issues

Increase timeout in `vercel.json`:

```json
{
  "functions": {
    "dist/index.js": {
      "maxDuration": 30
    }
  }
}
```

### Memory Issues

Vercel serverless has 512 MB RAM (Pro: 1 GB). If hitting limits:
- Reduce message history fetched per request
- Implement pagination
- Cache frequently accessed data

### Connection Refused

Verify Firebase credentials:

```bash
vercel env ls
```

Check that all Firebase env vars are set.

### High Latency

1. Check regional availability (Vercel defaults to closest region)
2. Enable HTTP/2 (automatic on Vercel)
3. Consider caching frequently used data

## Rollback Deployment

```bash
vercel rollback
```

Select previous deployment to restore.

## Performance Monitoring

### Set Up Monitoring

1. Go to [vercel.com/integrations](https://vercel.com/integrations)
2. Search for monitoring tools:
   - Datadog
   - New Relic
   - Sentry

### Track Metrics

Monitor these key metrics:

- **Response Time**: < 200ms (target)
- **Error Rate**: < 0.1%
- **CPU Usage**: < 50%
- **Memory Usage**: < 300 MB
- **Request Rate**: < 100 req/sec

### Enable Vercel Analytics

1. In project settings
2. Enable "Analytics"
3. View dashboard

## Security

### Hide Build Logs

```bash
vercel env add VERCEL_CONSOLE_NO_LOGS true
```

### Rate Limiting Headers

Vercel adds rate limiting headers automatically:

```
X-Rate-Limit-Limit: 1000
X-Rate-Limit-Remaining: 999
X-Rate-Limit-Reset: 1234567890
```

### CORS Configuration

Update `CORS_ORIGIN` in environment:

```bash
vercel env add CORS_ORIGIN https://my-frontend.com,https://another-domain.com
```

## Cost Optimization

### Free Tier Limits

- **Pro/Enterprise**: Unlimited deployments
- **Serverless Functions**: 100 GB-hours/month
- **Bandwidth**: 100 GB/month

### Reduce Costs

1. Use caching aggressively
2. Implement request pagination
3. Monitor memory usage
4. Use Firestore efficiently (avoid unnecessary reads)

### Cost Monitoring

Check Vercel dashboard:
- Usage analytics
- Bandwidth monitoring
- Function execution time

## CI/CD Pipeline

### Auto-Deploy on Push

Vercel auto-deploys when you push to main.

### Preview Deployments

Each pull request gets a preview deployment:

```bash
git checkout -b feature/new-endpoint
# Make changes
git push origin feature/new-endpoint

# Check PR for preview URL
```

### Disable Auto-Deploy

```bash
vercel --no-auto-deploy
```

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Configure environment variables
3. ✅ Verify deployment
4. ✅ Set up monitoring
5. ✅ Add custom domain (optional)
6. ✅ Configure CI/CD
7. ✅ Monitor performance
8. ✅ Optimize for production

## Resources

- [Vercel Docs](https://vercel.com/docs)
- [Node.js on Vercel](https://vercel.com/docs/runtimes/nodejs)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Deployment Monitoring](https://vercel.com/docs/observability)

## Support

For issues:

1. Check Vercel logs
2. Verify environment variables
3. Test locally first
4. Contact Vercel support

---

**Deployment URL**: `https://your-app.vercel.app`

**Backend Ready!** 🚀
