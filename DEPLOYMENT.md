# Claude Chat Backend - Deployment Guide

## Prerequisites

- Node.js 18+
- Firebase project with Firestore enabled
- Claude API key from Anthropic
- Vercel account (for serverless deployment)

## Local Development

### 1. Setup Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your credentials:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@appspot.gserviceaccount.com
CLAUDE_API_KEY=sk-ant-xxxxx
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3000
```

**Note**: Firebase private key must include literal `\n` for newlines in `.env` files.

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

Server will run on `http://localhost:3000`

### 4. Test Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Generate QR token
curl -X POST http://localhost:3000/auth/qr-token

# Pair device (with QR data from above)
curl -X POST http://localhost:3000/auth/pair \
  -H "Content-Type: application/json" \
  -d '{
    "token": "...",
    "deviceId": "...",
    "expiresAt": ...
  }'
```

## Vercel Deployment

### 1. Build the Project

```bash
npm run build
```

### 2. Deploy to Vercel

```bash
vercel deploy --prod
```

Or via Vercel UI:
- Connect GitHub repo
- Set Environment Variables (see section below)
- Deploy

### 3. Configure Environment Variables

In Vercel project settings, add:

| Variable | Value |
|----------|-------|
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key (full key with newlines) |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `CLAUDE_API_KEY` | Your Claude API key |
| `NODE_ENV` | `production` |
| `BACKEND_URL` | Your Vercel deployment URL (e.g., `https://my-app.vercel.app`) |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` |

## Firebase Setup

### 1. Create Firebase Project

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Create project
firebase init firestore
```

### 2. Database Schema

Collections:

```
users/
  - deviceId: string
  - createdAt: timestamp
  - lastActive: timestamp

conversations/
  - userId: string (reference to users)
  - title: string
  - createdAt: timestamp
  - updatedAt: timestamp
  - messageCount: number
  - messages/ (subcollection)
    - conversationId: string
    - senderId: "user" | "assistant"
    - text: string
    - sequenceNumber: number
    - timestamp: timestamp
```

### 3. Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth == null; // QR token pair uses no auth
      allow read, write: if resource.data.deviceId == request.headers['x-device-id'];
    }

    // Conversations collection
    match /conversations/{conversationId} {
      allow read, write: if resource.data.userId == request.headers['x-user-id'];
      
      // Messages subcollection
      match /messages/{messageId} {
        allow read, write: if get(/databases/$(database)/documents/conversations/$(conversationId)).data.userId == request.headers['x-user-id'];
      }
    }
  }
}
```

**Note**: For production, implement proper Firebase Authentication instead of header-based auth.

## API Endpoints

### Authentication

#### `POST /auth/qr-token`
Generate QR token for device pairing.

**Response**:
```json
{
  "token": "hex-string",
  "deviceId": "uuid",
  "expiresAt": 1234567890000,
  "expiresIn": 300000,
  "backendUrl": "https://api.example.com"
}
```

#### `POST /auth/pair`
Pair device using QR token data.

**Body**:
```json
{
  "token": "hex-string",
  "deviceId": "uuid",
  "expiresAt": 1234567890000
}
```

**Response**:
```json
{
  "userId": "uuid",
  "deviceId": "uuid"
}
```

### Conversations

All conversation endpoints require `x-user-id` header.

#### `GET /conversations`
List user's conversations.

**Headers**: `x-user-id: user-uuid`

**Query**: `?limit=20` (max 100)

**Response**:
```json
{
  "conversations": [
    {
      "id": "conversation-id",
      "userId": "user-id",
      "title": "Conversation Title",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "messageCount": 5
    }
  ]
}
```

#### `POST /conversations`
Create new conversation.

**Headers**: `x-user-id: user-uuid`

**Body**:
```json
{
  "title": "Optional Title"
}
```

**Response**:
```json
{
  "conversationId": "id",
  "userId": "user-id",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### `GET /conversations/:id`
Get conversation with messages.

**Headers**: `x-user-id: user-uuid`

**Query**: `?limit=50` (max 100)

**Response**:
```json
{
  "conversation": {
    "id": "conversation-id",
    "userId": "user-id",
    "title": "Title",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "messageCount": 5
  },
  "messages": [
    {
      "id": "message-id",
      "conversationId": "conversation-id",
      "senderId": "user",
      "text": "Hello",
      "sequenceNumber": 1,
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### `POST /conversations/:id/messages`
Add message and get Claude response.

**Headers**: `x-user-id: user-uuid`

**Body**:
```json
{
  "text": "Your message here"
}
```

**Response**:
```json
{
  "userMessage": {
    "id": "message-id",
    "conversationId": "conversation-id",
    "senderId": "user",
    "text": "Your message"
  },
  "assistantMessage": {
    "id": "message-id",
    "conversationId": "conversation-id",
    "senderId": "assistant",
    "text": "Claude's response"
  }
}
```

## Rate Limiting

Default: 100 requests per 15 minutes per IP address.

Configure via environment:
- `RATE_LIMIT_WINDOW_MS`: Time window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS`: Max requests in window

## Firestore Real-time Listeners (Frontend)

### Setup for Web Client

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Listen to conversation messages in real-time
const q = query(
  collection(db, 'conversations', conversationId, 'messages'),
  where('sequenceNumber', '>=', startSequenceNumber)
);

const unsubscribe = onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
      console.log('New message:', change.doc.data());
    }
  });
});

// Cleanup
unsubscribe();
```

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error message"
}
```

Common status codes:
- `400`: Bad request (invalid input)
- `401`: Unauthorized (missing/invalid auth)
- `403`: Forbidden (access denied)
- `404`: Not found
- `429`: Rate limited
- `500`: Server error

## Monitoring

### Health Check

```bash
curl https://api.example.com/health
```

### Logs

Logs are structured with timestamps, level, context, and message:

```
[2024-01-01T00:00:00.000Z] [INFO] [Auth] QR token generated
[2024-01-01T00:00:00.000Z] [ERROR] [Claude] Failed to generate response
```

## Security Considerations

1. **Private Key Storage**: Use Vercel/Firebase secrets, never commit to Git
2. **Rate Limiting**: Enabled on all public endpoints
3. **CORS**: Configure allowed origins in production
4. **Message Validation**: Max 5000 characters per message
5. **Firestore Rules**: Add proper authentication (not just headers)
6. **API Key Rotation**: Rotate Claude API key periodically

## Production Checklist

- [ ] Environment variables configured in Vercel
- [ ] Firebase security rules updated
- [ ] Rate limiting configured
- [ ] CORS origins set correctly
- [ ] Error logging setup (e.g., Sentry)
- [ ] Database backups enabled
- [ ] Monitoring alerts configured
- [ ] API documentation shared with frontend team
- [ ] Load testing performed
- [ ] Security review completed
