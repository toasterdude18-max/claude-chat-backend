# Client Integration Guide

Guide for frontend applications to integrate with the Claude Chat Backend.

## Getting Started

### 1. Backend URL

Store the backend URL (from QR token response):

```typescript
const BACKEND_URL = "https://your-backend.vercel.app";
```

### 2. User Authentication

After device pairing, store the `userId`:

```typescript
localStorage.setItem('userId', userId);
const userId = localStorage.getItem('userId');
```

Pass `userId` in all requests via `x-user-id` header.

## API Client Example

### JavaScript/TypeScript

```typescript
class ClaudeChatClient {
  private backendUrl: string;
  private userId: string;

  constructor(backendUrl: string, userId: string) {
    this.backendUrl = backendUrl;
    this.userId = userId;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.backendUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': this.userId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API error');
    }

    return response.json();
  }

  // Auth endpoints
  async generateQRToken(): Promise<{
    token: string;
    deviceId: string;
    expiresAt: number;
    expiresIn: number;
    backendUrl: string;
  }> {
    return this.request('POST', '/auth/qr-token');
  }

  async pairDevice(token: string, deviceId: string, expiresAt: number): Promise<{
    userId: string;
    deviceId: string;
  }> {
    return this.request('POST', '/auth/pair', {
      token,
      deviceId,
      expiresAt,
    });
  }

  // Conversation endpoints
  async createConversation(title?: string): Promise<{
    conversationId: string;
    userId: string;
    createdAt: string;
  }> {
    return this.request('POST', '/conversations', { title });
  }

  async listConversations(limit = 20): Promise<{
    conversations: Array<{
      id: string;
      userId: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      messageCount: number;
    }>;
  }> {
    const params = new URLSearchParams({ limit: limit.toString() });
    return this.request('GET', `/conversations?${params}`);
  }

  async getConversation(conversationId: string, limit = 50): Promise<{
    conversation: {
      id: string;
      userId: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      messageCount: number;
    };
    messages: Array<{
      id: string;
      conversationId: string;
      senderId: 'user' | 'assistant';
      text: string;
      timestamp?: string;
      sequenceNumber?: number;
    }>;
  }> {
    const params = new URLSearchParams({ limit: limit.toString() });
    return this.request('GET', `/conversations/${conversationId}?${params}`);
  }

  async sendMessage(conversationId: string, text: string): Promise<{
    userMessage: {
      id: string;
      conversationId: string;
      senderId: 'user';
      text: string;
    };
    assistantMessage: {
      id: string;
      conversationId: string;
      senderId: 'assistant';
      text: string;
    };
  }> {
    return this.request('POST', `/conversations/${conversationId}/messages`, {
      text,
    });
  }
}
```

### Usage Example

```typescript
// Initialize client
const client = new ClaudeChatClient(BACKEND_URL, userId);

// Create conversation
const { conversationId } = await client.createConversation('My Chat');

// Send message
const { userMessage, assistantMessage } = await client.sendMessage(
  conversationId,
  'Hello Claude!'
);

console.log('Assistant:', assistantMessage.text);

// List conversations
const { conversations } = await client.listConversations();
conversations.forEach(conv => {
  console.log(`${conv.title} (${conv.messageCount} messages)`);
});
```

## React Integration

### Custom Hook

```typescript
import { useCallback, useState } from 'react';

interface Message {
  id: string;
  conversationId: string;
  senderId: 'user' | 'assistant';
  text: string;
}

export const useClaudeChat = (backendUrl: string, userId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = new ClaudeChatClient(backendUrl, userId);

  const sendMessage = useCallback(
    async (conversationId: string, text: string): Promise<Message[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const { userMessage, assistantMessage } = await client.sendMessage(
          conversationId,
          text
        );

        return [userMessage, assistantMessage];
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  return {
    sendMessage,
    isLoading,
    error,
  };
};
```

### Component Example

```typescript
import React, { useEffect, useState } from 'react';
import { useClaudeChat } from './useClaudeChat';

interface Message {
  id: string;
  conversationId: string;
  senderId: 'user' | 'assistant';
  text: string;
}

export const ChatComponent: React.FC<{
  conversationId: string;
  userId: string;
}> = ({ conversationId, userId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { sendMessage, isLoading, error } = useClaudeChat(
    'https://backend.example.com',
    userId
  );

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    try {
      const newMessages = await sendMessage(conversationId, input);
      setMessages(prev => [...prev, ...newMessages]);
      setInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="chat">
      <div className="messages">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`message ${msg.senderId}`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="input-area">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
          disabled={isLoading}
          placeholder="Type a message..."
        />
        <button onClick={handleSendMessage} disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
```

## Real-time Updates with Firestore

### Setup Firebase Client

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Your Firebase config
  apiKey: 'AIzaSy...',
  authDomain: 'your-app.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-app.appspot.com',
  messagingSenderId: '123456',
  appId: '1:123456:web:abc123',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
```

### Listen to Messages in Real-time

```typescript
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export const subscribeToMessages = (
  conversationId: string,
  onUpdate: (messages: any[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('sequenceNumber', 'asc')
  );

  return onSnapshot(q, snapshot => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    onUpdate(messages);
  });
};
```

### React Hook for Real-time

```typescript
import { useEffect, useState } from 'react';
import { subscribeToMessages } from './firestore';

export const useRealtimeMessages = (conversationId: string) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);

    const unsubscribe = subscribeToMessages(conversationId, messages => {
      setMessages(messages);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [conversationId]);

  return { messages, isLoading };
};
```

## Error Handling

### Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }

  throw lastError!;
}

// Usage
await withRetry(() => client.sendMessage(conversationId, text));
```

### Rate Limit Handling

```typescript
class RateLimitedClient extends ClaudeChatClient {
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private requestsThisWindow = 0;
  private windowStart = Date.now();

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      // Check rate limit
      const now = Date.now();
      if (now - this.windowStart > 900000) {
        // 15 minutes
        this.requestsThisWindow = 0;
        this.windowStart = now;
      }

      if (this.requestsThisWindow >= 90) {
        // Leave headroom
        await new Promise(resolve =>
          setTimeout(resolve, 900000 - (now - this.windowStart))
        );
        continue;
      }

      const fn = this.requestQueue.shift();
      if (fn) {
        try {
          await fn();
          this.requestsThisWindow++;
        } catch (error) {
          console.error('Queue processing error:', error);
        }
      }
    }

    this.isProcessing = false;
  }

  async sendMessage(conversationId: string, text: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await super.sendMessage(conversationId, text);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }
}
```

## Best Practices

1. **Store userId Securely**: Use secure storage, not localStorage for sensitive data
2. **Handle Errors Gracefully**: Show user-friendly error messages
3. **Implement Loading States**: Show spinners/loading indicators
4. **Cache Conversations**: Store fetched data to reduce API calls
5. **Use Real-time Listeners**: For live message updates
6. **Batch Operations**: Send multiple messages at once if possible
7. **Rate Limit Awareness**: Implement client-side throttling
8. **Offline Support**: Queue messages when offline, sync when reconnected

## Testing

```typescript
// Mock client for testing
class MockClaudeChatClient extends ClaudeChatClient {
  async sendMessage(conversationId: string, text: string) {
    return {
      userMessage: {
        id: 'msg-1',
        conversationId,
        senderId: 'user' as const,
        text,
      },
      assistantMessage: {
        id: 'msg-2',
        conversationId,
        senderId: 'assistant' as const,
        text: 'Mock response from Claude',
      },
    };
  }
}
```

## Troubleshooting

### CORS Errors

Verify backend has CORS enabled:

```bash
curl -i -X OPTIONS http://localhost:3000/health \
  -H "Origin: http://localhost:3000"
```

### Auth Header Not Sent

Check headers in Network tab:
- `x-user-id` should be included
- Content-Type should be `application/json`

### Messages Not Syncing

1. Check Firestore security rules allow read access
2. Verify `userId` in header matches conversation owner
3. Check browser console for errors

## Resources

- [Backend API Documentation](./DEPLOYMENT.md)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Anthropic Claude API](https://console.anthropic.com)
