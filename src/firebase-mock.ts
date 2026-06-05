import { Logger } from './logger.js';

const logger = new Logger('FirebaseLocal');

// In-memory storage for local development
const storage = {
  users: new Map<string, any>(),
  conversations: new Map<string, any>(),
  messages: new Map<string, any[]>(),
};

export interface IUser {
  deviceId: string;
  createdAt: any;
  lastActive?: any;
}

export interface IMessage {
  conversationId: string;
  senderId: 'user' | 'assistant';
  text: string;
  sequenceNumber: number;
  timestamp: any;
}

export interface IConversation {
  userId: string;
  title?: string;
  createdAt: any;
  updatedAt: any;
  messageCount: number;
}

export const initializeFirebase = () => {
  logger.info('Using local in-memory storage (development mode)');
  return null;
};

export const getDb = () => null;

export const db = {
  users: {
    create: async (deviceId: string): Promise<string> => {
      const id = `user_${Date.now()}`;
      storage.users.set(id, {
        deviceId,
        createdAt: new Date(),
      });
      logger.info(`Created user: ${id}`);
      return id;
    },

    getByDeviceId: async (deviceId: string): Promise<(IUser & { id: string }) | null> => {
      for (const [id, user] of storage.users.entries()) {
        if (user.deviceId === deviceId) {
          return { id, ...user };
        }
      }
      return null;
    },

    getById: async (userId: string): Promise<(IUser & { id: string }) | null> => {
      const user = storage.users.get(userId);
      return user ? { id: userId, ...user } : null;
    },

    updateLastActive: async (userId: string): Promise<void> => {
      const user = storage.users.get(userId);
      if (user) {
        user.lastActive = new Date();
      }
    },
  },

  conversations: {
    create: async (userId: string, title?: string): Promise<string> => {
      const id = `conv_${Date.now()}`;
      storage.conversations.set(id, {
        userId,
        title: title || 'Untitled Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
      });
      storage.messages.set(id, []);
      logger.info(`Created conversation: ${id}`);
      return id;
    },

    getById: async (conversationId: string): Promise<(IConversation & { id: string }) | null> => {
      const conv = storage.conversations.get(conversationId);
      return conv ? { id: conversationId, ...conv } : null;
    },

    getByUserId: async (userId: string, limit = 20): Promise<(IConversation & { id: string })[]> => {
      const results: (IConversation & { id: string })[] = [];
      for (const [id, conv] of storage.conversations.entries()) {
        if (conv.userId === userId) {
          results.push({ id, ...conv });
        }
      }
      return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, limit);
    },

    update: async (conversationId: string, data: Partial<IConversation>): Promise<void> => {
      const conv = storage.conversations.get(conversationId);
      if (conv) {
        Object.assign(conv, data);
        conv.updatedAt = new Date();
      }
    },
  },

  messages: {
    create: async (
      conversationId: string,
      message: Omit<IMessage, 'timestamp' | 'sequenceNumber'>
    ): Promise<string> => {
      const messages = storage.messages.get(conversationId) || [];
      const sequenceNumber = messages.length + 1;
      const id = `msg_${Date.now()}`;

      const newMessage = {
        ...message,
        sequenceNumber,
        timestamp: new Date(),
      };

      messages.push(newMessage);
      storage.messages.set(conversationId, messages);

      // Update conversation metadata
      const conv = storage.conversations.get(conversationId);
      if (conv) {
        conv.messageCount += 1;
        conv.updatedAt = new Date();
      }

      return id;
    },

    getByConversationId: async (conversationId: string, limit = 50): Promise<(IMessage & { id: string })[]> => {
      const messages = storage.messages.get(conversationId) || [];
      return messages.slice(-limit).map((msg, idx) => ({ id: `msg_${idx}`, ...msg }));
    },

    getLatest: async (conversationId: string, limit = 10): Promise<(IMessage & { id: string })[]> => {
      const messages = storage.messages.get(conversationId) || [];
      return messages.slice(-limit).map((msg, idx) => ({ id: `msg_${idx}`, ...msg }));
    },
  },
};
