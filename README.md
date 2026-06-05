# Claude Chat Backend

A production-ready Node.js backend for a Claude AI chat application using Express.js, Firebase Firestore, and the Anthropic API.

## Features

- **Device Pairing**: QR token-based device linking with 5-minute expiry
- **Real-time Chat**: Send messages and receive Claude responses
- **Conversation Management**: Create, retrieve, and manage conversations
- **Firestore Database**: Scalable cloud database with real-time listeners
- **Rate Limiting**: Built-in protection against quota abuse (100 req/15min)
- **Vercel Deployment**: Pre-configured for serverless deployment
- **TypeScript**: Full type safety and IntelliSense
- **Error Handling**: Comprehensive error handling and logging
- **CORS Support**: Cross-origin resource sharing configured

## Project Structure

```
src/
├── index.ts              # Express app entry point
├── config.ts             # Configuration management
├── logger.ts             # Structured logging
├── firebase.ts           # Firestore initialization and queries
├── auth.ts               # QR token and device pairing logic
├── middleware.ts         # Express middleware (rate limit, auth, logging)
├── claude-service.ts     # Anthropic API integration
└── routes/
    ├── auth.ts           # POST /auth/qr-token, POST /auth/pair
    ├── conversations.ts  # Conversation CRUD and messaging
    └── health.ts         # GET /health
```

## Quick Start

### 1. Clone & Install

```bash
git clone <repo>
cd claude-chat-backend
npm install
```

### 2. Configure Environment

Create `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your credentials:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY` (with literal `\n` for newlines)
- `FIREBASE_CLIENT_EMAIL`
- `CLAUDE_API_KEY`

### 3. Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
```

Outputs to `dist/` folder.

## API Endpoints

### Authentication

- **`POST /auth/qr-token`** - Generate QR token (5 min expiry)
- **`POST /auth/pair`** - Pair device with QR data

### Conversations

All require `x-user-id` header.

- **`GET /conversations`** - List user's conversations
- **`POST /conversations`** - Create new conversation
- **`GET /conversations/:id`** - Get conversation + messages
- **`POST /conversations/:id/messages`** - Add message & get Claude response

### Health

- **`GET /health`** - Server health check

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed API documentation.

## Database Schema

### Firestore Collections

```
users/
  ├─ deviceId
  ├─ createdAt
  └─ lastActive

conversations/
  ├─ userId
  ├─ title
  ├─ createdAt
  ├─ updatedAt
  ├─ messageCount
  └─ messages/ (subcollection)
     ├─ conversationId
     ├─ senderId ("user" | "assistant")
     ├─ text
     ├─ sequenceNumber
     └─ timestamp
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy --prod
```

1. Connect GitHub repo in Vercel dashboard
2. Add environment variables
3. Auto-deploys on push to main branch

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full setup guide.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FIREBASE_PROJECT_ID` | Firebase project ID | ✓ |
| `FIREBASE_PRIVATE_KEY` | Firebase service account key | ✓ |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | ✓ |
| `CLAUDE_API_KEY` | Anthropic Claude API key | ✓ |
| `NODE_ENV` | `development` or `production` | - |
| `PORT` | Server port (default: 3000) | - |
| `BACKEND_URL` | Backend URL for QR tokens | - |
| `QR_TOKEN_EXPIRY_MINUTES` | QR token expiry (default: 5) | - |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (default: 900000) | - |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window (default: 100) | - |

## Development

### Scripts

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Compile TypeScript
npm start            # Run compiled JavaScript
npm run typecheck    # Check TypeScript types
npm run lint         # Lint code
```

### Testing Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Generate QR token
curl -X POST http://localhost:3000/auth/qr-token

# Create conversation
curl -X POST http://localhost:3000/conversations \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{"title": "My Chat"}'

# Send message
curl -X POST http://localhost:3000/conversations/{conversationId}/messages \
  -H "x-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello Claude!"}'
```

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

**Status codes**:
- `400` - Bad request (invalid input)
- `401` - Unauthorized (missing auth header)
- `403` - Forbidden (access denied)
- `404` - Not found
- `429` - Rate limited (too many requests)
- `500` - Server error

## Logging

Structured logs with timestamps:

```
[2024-01-01T12:00:00.000Z] [INFO] [Auth] QR token generated
[2024-01-01T12:00:01.000Z] [ERROR] [Firebase] Collection not found
```

Set `NODE_ENV=development` for debug logs.

## Security

- **API Keys**: Stored in secure environment variables, never exposed
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Message Size**: Limited to 5000 characters
- **Device Pairing**: Time-limited tokens (5 min default)
- **CORS**: Configurable allowed origins
- **Firestore Rules**: Add authentication in production

## Firestore Real-time Listeners (Frontend Integration)

For frontend apps to subscribe to conversation updates in real-time:

```javascript
import { getFirestore, collection, query, onSnapshot } from 'firebase/firestore';

const db = getFirestore();

// Listen to messages
const unsubscribe = onSnapshot(
  collection(db, 'conversations', conversationId, 'messages'),
  (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        console.log('New message:', change.doc.data());
      }
    });
  }
);
```

## Support

For issues or questions:
1. Check [DEPLOYMENT.md](./DEPLOYMENT.md)
2. Review error logs
3. Verify environment variables
4. Check Firebase Firestore rules

## License

MIT
