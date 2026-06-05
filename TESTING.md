# Testing Guide

## Local Development Testing

### 1. Environment Setup

Create `.env.local` with test values:

```bash
FIREBASE_PROJECT_ID=test-project
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQE...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=test@test-project.iam.gserviceaccount.com
CLAUDE_API_KEY=sk-ant-test-key
NODE_ENV=development
PORT=3000
BACKEND_URL=http://localhost:3000
```

### 2. Start Development Server

```bash
npm run dev
```

Expected output:
```
[2024-01-01T12:00:00.000Z] [INFO] [Server] Configuration validated
[2024-01-01T12:00:00.000Z] [INFO] [Firebase] Firebase initialized successfully
[2024-01-01T12:00:00.000Z] [INFO] [Server] Server running on http://localhost:3000
```

### 3. Test Endpoints

#### Health Check
```bash
curl http://localhost:3000/health
```

Expected response (200):
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 12.345
}
```

#### Generate QR Token
```bash
curl -X POST http://localhost:3000/auth/qr-token
```

Expected response (200):
```json
{
  "token": "a1b2c3d4...",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": 1704110000000,
  "expiresIn": 300000,
  "backendUrl": "http://localhost:3000"
}
```

#### Pair Device
```bash
# First get QR token
QR_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/qr-token)
TOKEN=$(echo $QR_RESPONSE | jq -r '.token')
DEVICE_ID=$(echo $QR_RESPONSE | jq -r '.deviceId')
EXPIRES_AT=$(echo $QR_RESPONSE | jq -r '.expiresAt')

# Pair device
curl -X POST http://localhost:3000/auth/pair \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\",
    \"deviceId\": \"$DEVICE_ID\",
    \"expiresAt\": $EXPIRES_AT
  }"
```

Expected response (200):
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Create Conversation
```bash
# Save userId from pairing response
USER_ID="550e8400-e29b-41d4-a716-446655440001"

curl -X POST http://localhost:3000/conversations \
  -H "x-user-id: $USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Conversation"}'
```

Expected response (201):
```json
{
  "conversationId": "conv-id-123",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

#### List Conversations
```bash
curl http://localhost:3000/conversations \
  -H "x-user-id: $USER_ID"
```

Expected response (200):
```json
{
  "conversations": [
    {
      "id": "conv-id-123",
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "title": "Test Conversation",
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z",
      "messageCount": 0
    }
  ]
}
```

#### Get Conversation
```bash
CONVERSATION_ID="conv-id-123"

curl http://localhost:3000/conversations/$CONVERSATION_ID \
  -H "x-user-id: $USER_ID"
```

Expected response (200):
```json
{
  "conversation": {
    "id": "conv-id-123",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "title": "Test Conversation",
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "messageCount": 0
  },
  "messages": []
}
```

#### Send Message
```bash
curl -X POST http://localhost:3000/conversations/$CONVERSATION_ID/messages \
  -H "x-user-id: $USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello Claude!"}'
```

Expected response (201):
```json
{
  "userMessage": {
    "id": "msg-id-1",
    "conversationId": "conv-id-123",
    "senderId": "user",
    "text": "Hello Claude!"
  },
  "assistantMessage": {
    "id": "msg-id-2",
    "conversationId": "conv-id-123",
    "senderId": "assistant",
    "text": "Hello! I'm Claude, an AI assistant..."
  }
}
```

## Error Testing

### Missing Required Fields

```bash
curl -X POST http://localhost:3000/auth/pair \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response (400):
```json
{
  "error": "Missing required fields: token, deviceId, expiresAt"
}
```

### Missing Auth Header

```bash
curl http://localhost:3000/conversations
```

Expected response (401):
```json
{
  "error": "Missing x-user-id header"
}
```

### Invalid Conversation

```bash
curl http://localhost:3000/conversations/invalid-id \
  -H "x-user-id: $USER_ID"
```

Expected response (404):
```json
{
  "error": "Conversation not found"
}
```

### Rate Limiting

Make 101 requests in quick succession:

```bash
for i in {1..101}; do
  curl http://localhost:3000/health
done
```

Expected response on 101st request (429):
```json
{
  "error": "Too many requests",
  "retryAfter": 1704110300000
}
```

### Expired QR Token

Generate QR token, wait 5+ minutes, then try to pair:

```bash
# QR token generated at T=0
sleep 301

# Try to pair after expiry
curl -X POST http://localhost:3000/auth/pair \
  -H "Content-Type: application/json" \
  -d "{...old token data...}"
```

Expected response (400):
```json
{
  "error": "QR token expired"
}
```

## Firestore Integration Testing

### Verify Collections

In Firebase Console:

1. Check `users` collection:
   - Document exists with `deviceId`, `createdAt`

2. Check `conversations` collection:
   - Document exists with `userId`, `title`, `createdAt`, `updatedAt`, `messageCount`

3. Check `messages` subcollection:
   - Documents exist under conversation with `senderId`, `text`, `sequenceNumber`, `timestamp`

### Firestore Security Rules Test

Try accessing without proper headers:

```bash
# Using gcloud CLI
gcloud firestore documents get users/user-id-123 \
  --database-id='(default)' \
  --project=test-project
```

Expected: Firestore security rules should block access.

## Load Testing

### Using Apache Bench

```bash
# Test health endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 http://localhost:3000/health

# Test message endpoint (requires valid user ID)
ab -n 50 -c 5 \
  -H "x-user-id: $USER_ID" \
  http://localhost:3000/conversations/$CONVERSATION_ID
```

### Using hey

```bash
# Install hey
go install github.com/rakyll/hey@latest

# Run load test
hey -n 1000 -c 20 http://localhost:3000/health
```

### Expected Results

- Response time: < 100ms for health
- Response time: < 500ms for conversation operations
- P99 latency: < 1000ms
- Error rate: < 1%

## Continuous Integration Testing

Create `.github/workflows/test.yml`:

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
```

## Production Testing Checklist

- [ ] All endpoints tested with valid credentials
- [ ] Error handling tested for all error cases
- [ ] Rate limiting verified
- [ ] Database schema verified in Firestore
- [ ] Firestore security rules tested
- [ ] Claude API integration tested
- [ ] Environment variables validated
- [ ] CORS configuration tested
- [ ] Response times acceptable
- [ ] Error logs reviewed
- [ ] No sensitive data in logs
