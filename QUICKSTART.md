# Quick Start Guide

Get the Claude Chat Backend running in 5 minutes.

## 1. Prerequisites

- Node.js 18+ (`node --version`)
- npm 9+ (`npm --version`)

## 2. Clone & Install

```bash
cd claude-chat-backend
npm install
```

## 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
FIREBASE_PROJECT_ID=your-project-id-here
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyHere\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-email@appspot.gserviceaccount.com
CLAUDE_API_KEY=sk-ant-your-key-here
```

**Getting credentials:**

1. **Firebase**: Follow [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
2. **Claude API**: Get key from [Anthropic Console](https://console.anthropic.com)

## 4. Start Development Server

```bash
npm run dev
```

You should see:

```
[2024-01-01T12:00:00.000Z] [INFO] [Server] Server running on http://localhost:3000
```

## 5. Test It Works

```bash
# Health check
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","timestamp":"...","uptime":...}
```

## 6. Generate QR Token

```bash
curl -X POST http://localhost:3000/auth/qr-token
```

Response:

```json
{
  "token": "abc123...",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": 1704110000000,
  "expiresIn": 300000,
  "backendUrl": "http://localhost:3000"
}
```

Save the `token`, `deviceId`, and `expiresAt` for next step.

## 7. Pair Device

```bash
curl -X POST http://localhost:3000/auth/pair \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123...",
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": 1704110000000
  }'
```

Response:

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Save the `userId` for next step.

## 8. Create Conversation

```bash
USER_ID="550e8400-e29b-41d4-a716-446655440001"

curl -X POST http://localhost:3000/conversations \
  -H "x-user-id: $USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"title": "My First Chat"}'
```

Response:

```json
{
  "conversationId": "conv-abc123",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

Save the `conversationId`.

## 9. Send First Message

```bash
CONVERSATION_ID="conv-abc123"

curl -X POST http://localhost:3000/conversations/$CONVERSATION_ID/messages \
  -H "x-user-id: $USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello Claude! What can you do?"}'
```

Response:

```json
{
  "userMessage": {
    "id": "msg-1",
    "conversationId": "conv-abc123",
    "senderId": "user",
    "text": "Hello Claude! What can you do?"
  },
  "assistantMessage": {
    "id": "msg-2",
    "conversationId": "conv-abc123",
    "senderId": "assistant",
    "text": "I'm Claude, an AI assistant made by Anthropic..."
  }
}
```

## ✅ You're Done!

Backend is running and working. Next steps:

1. **Integrate Frontend**: Use [CLIENT_INTEGRATION.md](./CLIENT_INTEGRATION.md)
2. **Deploy to Vercel**: Use [DEPLOYMENT.md](./DEPLOYMENT.md)
3. **Add Testing**: Use [TESTING.md](./TESTING.md)

## Common Issues

### "Cannot find module 'express'"

```bash
npm install
```

### "FIREBASE_PROJECT_ID not configured"

Check `.env.local` has all required fields:

```bash
grep "FIREBASE_PROJECT_ID" .env.local
```

### "CLAUDE_API_KEY not configured"

Get key from [Anthropic Console](https://console.anthropic.com)

### "Connection refused"

Backend not running. Run `npm run dev` first.

### "Rate limited"

Wait 15 minutes or modify `RATE_LIMIT_WINDOW_MS` in `.env.local`

## Next: Deploy to Production

When ready for production:

```bash
# Build for production
npm run build

# Deploy to Vercel
npm install -g vercel
vercel deploy --prod
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full instructions.

## Scripts

```bash
npm run dev           # Start dev server
npm run build         # Compile TypeScript
npm start             # Run compiled app
npm run typecheck     # Type checking
npm run lint          # Lint code
```

## API Documentation

- [Health Check](./DEPLOYMENT.md#get-health)
- [QR Token](./DEPLOYMENT.md#post-authmr-token)
- [Device Pairing](./DEPLOYMENT.md#post-authpair)
- [Conversations](./DEPLOYMENT.md#conversations)
- [Messages](./DEPLOYMENT.md#post-conversationsidmessages)

## Firebase & Claude Setup

1. Firebase: [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
2. Testing: [TESTING.md](./TESTING.md)
3. Frontend: [CLIENT_INTEGRATION.md](./CLIENT_INTEGRATION.md)

## Support

Need help?

1. Check docs above
2. Review error logs
3. Verify environment variables
4. Check network connectivity

Happy coding! 🚀
