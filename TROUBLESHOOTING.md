# Troubleshooting Guide

Common issues and solutions for Claude Chat Backend.

## Installation Issues

### "npm ERR! code ERESOLVE"

**Issue**: Dependency conflict during npm install

**Solution**:

```bash
npm install --legacy-peer-deps
```

Or update npm:

```bash
npm install -g npm@latest
npm install
```

### "Cannot find module 'typescript'"

**Issue**: TypeScript not installed

**Solution**:

```bash
npm install
npm run typecheck
```

### "Port already in use"

**Issue**: Port 3000 already in use

**Solution**:

Change port in `.env.local`:

```env
PORT=3001
```

Or find and kill process:

```bash
# macOS/Linux
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

## Configuration Issues

### "FIREBASE_PROJECT_ID is not configured"

**Issue**: Missing environment variable

**Solution**:

1. Check `.env.local` exists
2. Add to `.env.local`:

```env
FIREBASE_PROJECT_ID=your-project-id
```

3. Restart dev server

### "FIREBASE_PRIVATE_KEY not configured"

**Issue**: Private key missing or malformed

**Solution**:

1. Get key from Firebase Console
2. Copy entire key including BEGIN/END
3. In `.env.local`, format as:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyHere\n-----END PRIVATE KEY-----\n"
```

**Important**: Use literal `\n` not actual newlines

### "CLAUDE_API_KEY validation failed"

**Issue**: Claude API key invalid

**Solution**:

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create new API key
3. Copy full key (starts with `sk-ant-`)
4. Update `.env.local`:

```env
CLAUDE_API_KEY=sk-ant-xxxxx
```

### "Invalid environment variable format"

**Issue**: Env var not parsed correctly

**Solution**:

Don't use quotes in actual values:

```env
# ❌ Wrong
FIREBASE_PROJECT_ID="my-project"

# ✅ Correct
FIREBASE_PROJECT_ID=my-project
```

## Firebase Issues

### "Error: Cannot create credentials"

**Issue**: Firebase initialization failed

**Solution**:

1. Verify credentials in `.env.local`:

```bash
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL
```

2. Check service account has Firestore permissions:

```bash
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:YOUR_SERVICE_ACCOUNT"
```

3. Enable Firestore API:

```bash
gcloud services enable firestore.googleapis.com \
  --project=YOUR_PROJECT_ID
```

### "Firestore Database not found"

**Issue**: Firestore not enabled in project

**Solution**:

1. Go to Firebase Console
2. Click "Firestore Database"
3. Click "Create Database"
4. Select region
5. Click "Enable"

### "Permission denied" errors

**Issue**: Firestore security rules blocking access

**Solution**:

1. Go to Firestore → Rules
2. Update rules to allow test access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth == null; // TEMP: FOR TESTING ONLY
    }
  }
}
```

3. After testing, update rules properly:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.headers['x-user-id'] == userId;
    }
    match /conversations/{conversationId} {
      allow read, write: if get(/databases/$(database)/documents/conversations/$(conversationId)).data.userId == request.headers['x-user-id'];
      match /messages/{messageId} {
        allow read, write: if get(/databases/$(database)/documents/conversations/$(conversationId)).data.userId == request.headers['x-user-id'];
      }
    }
  }
}
```

### "Collection not found"

**Issue**: Collection doesn't exist yet

**Solution**:

1. Create collection manually via Firebase Console, OR
2. Backend auto-creates on first request

### "Quota exceeded"

**Issue**: Firestore quota reached

**Solution**:

Check usage in Firebase Console:
- Firestore → Stats
- View read/write/delete operations

Options:
1. Wait for quota reset (if on free tier)
2. Upgrade to Blaze plan (pay-as-you-go)
3. Reduce API calls:
   - Use query limits
   - Implement caching
   - Batch operations

## Authentication Issues

### "Invalid QR token"

**Issue**: Token doesn't exist or expired

**Solution**:

1. Generate new token:

```bash
curl -X POST http://localhost:3000/auth/qr-token
```

2. Use immediately (tokens expire in 5 minutes)

### "QR token expired"

**Issue**: Token is older than 5 minutes

**Solution**:

1. Generate new token:

```bash
curl -X POST http://localhost:3000/auth/qr-token
```

2. Change expiry in `.env.local`:

```env
QR_TOKEN_EXPIRY_MINUTES=10
```

### "Device ID mismatch"

**Issue**: Token deviceId doesn't match pairing request

**Solution**:

Make sure QR token deviceId matches pairing request:

```bash
# Generate token (save deviceId)
curl -X POST http://localhost:3000/auth/qr-token

# Use SAME deviceId in pairing
curl -X POST http://localhost:3000/auth/pair \
  -H "Content-Type: application/json" \
  -d '{
    "token": "...",
    "deviceId": "SAME_AS_ABOVE",
    "expiresAt": ...
  }'
```

### "Missing x-user-id header"

**Issue**: Request missing user ID header

**Solution**:

Add header to all authenticated requests:

```bash
curl http://localhost:3000/conversations \
  -H "x-user-id: YOUR_USER_ID"
```

### "Invalid user ID format"

**Issue**: User ID is not valid UUID

**Solution**:

Use valid UUID format (from pairing response):

```
550e8400-e29b-41d4-a716-446655440000
```

## API Issues

### "Rate limit exceeded"

**Issue**: Too many requests

**Solution**:

1. Wait 15 minutes for quota reset
2. Reduce request frequency
3. Implement client-side throttling
4. Change limit in `.env.local`:

```env
RATE_LIMIT_MAX_REQUESTS=500
RATE_LIMIT_WINDOW_MS=900000
```

### "Message text exceeds maximum length"

**Issue**: Message longer than 5000 characters

**Solution**:

Split message or increase limit in code:

In `src/routes/conversations.ts`:

```typescript
if (text.length > 10000) { // Changed from 5000
  res.status(400).json({ error: 'Message too long' });
  return;
}
```

### "Conversation not found"

**Issue**: Invalid conversation ID

**Solution**:

1. Get conversation ID from create response
2. Verify format (UUID)
3. Check user owns conversation:

```bash
curl http://localhost:3000/conversations \
  -H "x-user-id: YOUR_USER_ID" | jq '.conversations[].id'
```

### "Access denied"

**Issue**: User trying to access other user's data

**Solution**:

1. Verify x-user-id header is correct
2. Ensure conversation belongs to user:

```bash
# List user's conversations
curl http://localhost:3000/conversations \
  -H "x-user-id: YOUR_USER_ID"
```

### "Claude API key validation failed"

**Issue**: API key invalid or rate limited

**Solution**:

1. Verify key in `.env.local`
2. Check key is active in Anthropic Console
3. Wait if rate limited (check error message)

### "No response from Claude"

**Issue**: Claude API timeout or error

**Solution**:

1. Check network connectivity
2. Verify Claude API is operational
3. Check API key has credit
4. Increase timeout in `claude-service.ts`

## Deployment Issues

### "Vercel build failed"

**Issue**: Build error during deployment

**Solution**:

1. Check error message in Vercel logs
2. Test build locally:

```bash
npm run build
```

3. Fix TypeScript errors:

```bash
npm run typecheck
```

4. Commit and push again

### "Environment variables not set"

**Issue**: Variables missing in production

**Solution**:

1. Go to Vercel project settings
2. Add all variables manually:

```bash
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_PRIVATE_KEY
# etc.
```

3. Redeploy:

```bash
vercel redeploy
```

### "CORS errors in production"

**Issue**: Frontend can't access backend

**Solution**:

1. Update CORS_ORIGIN in Vercel:

```bash
vercel env add CORS_ORIGIN https://my-frontend.com
```

2. Update middleware in code:

```typescript
export const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['https://my-frontend.com'],
};
```

3. Redeploy

### "502 Bad Gateway"

**Issue**: Backend crashed or not responding

**Solution**:

1. Check Vercel logs:

```bash
vercel logs my-app --error
```

2. Verify environment variables are set
3. Check Firebase connectivity
4. Redeploy:

```bash
vercel deploy --prod
```

### "Timeout errors"

**Issue**: Request taking too long

**Solution**:

1. Increase timeout in `vercel.json`:

```json
{
  "functions": {
    "dist/index.js": {
      "maxDuration": 30
    }
  }
}
```

2. Optimize database queries
3. Implement caching
4. Consider upgrading Vercel plan

## Performance Issues

### "High response time"

**Issue**: Requests taking too long

**Solution**:

1. Check Firebase latency:

```bash
# Add timing to logs
logger.info(`Firestore query took ${Date.now() - start}ms`);
```

2. Optimize queries:
   - Add indexes
   - Limit results
   - Use pagination

3. Enable caching:

```typescript
app.use(require('express-cache-ctrl').cacheControl({
  maxAge: 60 // seconds
}));
```

### "High memory usage"

**Issue**: Backend consuming too much RAM

**Solution**:

1. Check for memory leaks:
   - Use Vercel's memory monitoring
   - Review token store size

2. Reduce message history:

```typescript
// In conversations.ts
const messages = await db.messages.getByConversationId(conversationId, 10);
```

3. Implement pagination

### "High CPU usage"

**Issue**: Backend using too much CPU

**Solution**:

1. Check for inefficient queries
2. Add query indexes in Firestore
3. Implement result caching
4. Monitor with Vercel Analytics

## Logging & Debugging

### "Not seeing logs"

**Issue**: No output in development

**Solution**:

1. Check NODE_ENV:

```bash
echo $NODE_ENV
```

2. Set to development:

```env
NODE_ENV=development
```

3. Restart dev server:

```bash
npm run dev
```

### "Logs not showing in Vercel"

**Issue**: Can't see production logs

**Solution**:

1. Fetch logs:

```bash
vercel logs my-app
```

2. Filter by level:

```bash
vercel logs my-app | grep ERROR
```

3. Use Datadog or similar for production logs

### "DEBUG mode not working"

**Issue**: Debug logs not appearing

**Solution**:

1. Set DEBUG environment variable:

```bash
DEBUG=* npm run dev
```

2. Or in code:

```typescript
logger.debug('Debug message', data);
```

Only shows when NODE_ENV=development

## Testing Issues

### "Curl requests failing"

**Issue**: API tests not working

**Solution**:

1. Check server is running:

```bash
curl http://localhost:3000/health
```

2. Check headers are correct:

```bash
curl -X POST http://localhost:3000/auth/pair \
  -H "Content-Type: application/json" \
  -d '{...}'
```

3. Use valid JSON:

```bash
# ❌ Wrong
curl -d '{"text": "hello"}'

# ✅ Correct
curl -d '{"text":"hello"}'
```

### "TypeScript compilation errors"

**Issue**: Type errors in build

**Solution**:

1. Check errors:

```bash
npm run typecheck
```

2. Fix TypeScript issues:
   - Add type annotations
   - Check for null values
   - Verify imports

3. Review tsconfig.json

## Getting Help

### Information to Include

When reporting issues, include:

1. Error message (full stack trace)
2. Steps to reproduce
3. Environment info:

```bash
node --version
npm --version
uname -a # or Windows version
```

4. .env.local settings (WITHOUT sensitive data)
5. Logs from server/deployment

### Resources

- GitHub Issues
- Stack Overflow (tag: express, firebase, typescript)
- Vercel Docs: https://vercel.com/docs
- Firebase Docs: https://firebase.google.com/docs
- Anthropic Docs: https://docs.anthropic.com

### Contact

For Claude Chat Backend issues:
1. Check this troubleshooting guide
2. Review documentation files
3. Test locally first
4. Check logs carefully

---

**Most Common Solutions**:

1. ✅ Check .env.local is configured
2. ✅ Verify Firebase is enabled
3. ✅ Confirm API keys are valid
4. ✅ Check server is running
5. ✅ Restart dev server after changes
6. ✅ Clear npm cache if stuck
7. ✅ Review error logs carefully

Good luck! 🚀
