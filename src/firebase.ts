import admin from 'firebase-admin';
import { config } from './config.js';
import { Logger } from './logger.js';

const logger = new Logger('Firebase');

let initialized = false;
let useMock = false;

export interface IUser {
  deviceId: string;
  createdAt: admin.firestore.Timestamp | Date;
  lastActive?: admin.firestore.Timestamp | Date;
}

export interface IMessage {
  conversationId: string;
  senderId: 'user' | 'assistant';
  text: string;
  sequenceNumber: number;
  timestamp: admin.firestore.Timestamp | Date;
}

export interface IConversation {
  userId: string;
  title?: string;
  createdAt: admin.firestore.Timestamp | Date;
  updatedAt: admin.firestore.Timestamp | Date;
  messageCount: number;
}

export const initializeFirebase = (): admin.firestore.Firestore | null => {
  if (initialized) {
    return useMock ? null : admin.firestore();
  }

  try {
    const privateKey = config.firebase.privateKey?.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey,
        clientEmail: config.firebase.clientEmail,
      }),
    });

    initialized = true;
    useMock = false;
    logger.info('Firebase initialized successfully');
  } catch (error) {
    logger.warn('Firebase initialization failed, using local storage', error);
    initialized = true;
    useMock = true;
  }

  return useMock ? null : admin.firestore();
};

export const getDb = (): admin.firestore.Firestore | null => {
  if (!initialized) {
    return initializeFirebase();
  }
  return useMock ? null : admin.firestore();
};

// In-memory storage for local development
const localStorage = {
  users: new Map<string, any>(),
  conversations: new Map<string, any>(),
  messages: new Map<string, any[]>(),
};

export const db = {
  // Users
  users: {
    create: async (deviceId: string): Promise<string> => {
      const firestore = getDb();
      if (!firestore) {
        const id = `user_${Date.now()}`;
        localStorage.users.set(id, {
          deviceId,
          createdAt: new Date(),
        });
        return id;
      }
      const docRef = firestore.collection('users').doc();
      await docRef.set({
        deviceId,
        createdAt: admin.firestore.Timestamp.now(),
      });
      return docRef.id;
    },

    getByDeviceId: async (deviceId: string): Promise<(IUser & { id: string }) | null> => {
      const firestore = getDb();
      if (!firestore) {
        for (const [id, user] of localStorage.users.entries()) {
          if (user.deviceId === deviceId) {
            return { id, ...user };
          }
        }
        return null;
      }
      const snapshot = await firestore
        .collection('users')
        .where('deviceId', '==', deviceId)
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as IUser & { id: string };
    },

    getById: async (userId: string): Promise<(IUser & { id: string }) | null> => {
      const firestore = getDb();
      if (!firestore) {
        const user = localStorage.users.get(userId);
        return user ? { id: userId, ...user } : null;
      }
      const doc = await firestore.collection('users').doc(userId).get();

      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() } as IUser & { id: string };
    },

    updateLastActive: async (userId: string): Promise<void> => {
      const firestore = getDb();
      if (!firestore) {
        const user = localStorage.users.get(userId);
        if (user) {
          user.lastActive = new Date();
        }
        return;
      }
      await firestore
        .collection('users')
        .doc(userId)
        .update({
          lastActive: admin.firestore.Timestamp.now(),
        });
    },
  },

  // Conversations
  conversations: {
    create: async (userId: string, title?: string): Promise<string> => {
      const firestore = getDb();
      if (!firestore) {
        const id = `conv_${Date.now()}`;
        localStorage.conversations.set(id, {
          userId,
          title: title || 'Untitled Conversation',
          createdAt: new Date(),
          updatedAt: new Date(),
          messageCount: 0,
        });
        localStorage.messages.set(id, []);
        return id;
      }
      const docRef = firestore.collection('conversations').doc();
      await docRef.set({
        userId,
        title: title || 'Untitled Conversation',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        messageCount: 0,
      });
      return docRef.id;
    },

    getById: async (conversationId: string): Promise<(IConversation & { id: string }) | null> => {
      const firestore = getDb();
      if (!firestore) {
        const conv = localStorage.conversations.get(conversationId);
        return conv ? { id: conversationId, ...conv } : null;
      }
      const doc = await firestore.collection('conversations').doc(conversationId).get();

      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() } as IConversation & { id: string };
    },

    getByUserId: async (
      userId: string,
      limit = 20
    ): Promise<(IConversation & { id: string })[]> => {
      const firestore = getDb();
      if (!firestore) {
        const results: (IConversation & { id: string })[] = [];
        for (const [id, conv] of localStorage.conversations.entries()) {
          if (conv.userId === userId) {
            results.push({ id, ...conv });
          }
        }
        return results.sort((a, b) => {
          const aTime = (a.updatedAt as any).getTime?.() ?? (a.updatedAt as any).toMillis?.() ?? 0;
          const bTime = (b.updatedAt as any).getTime?.() ?? (b.updatedAt as any).toMillis?.() ?? 0;
          return bTime - aTime;
        }).slice(0, limit);
      }
      const snapshot = await firestore
        .collection('conversations')
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IConversation & { id: string }));
    },

    update: async (conversationId: string, data: Partial<IConversation>): Promise<void> => {
      const firestore = getDb();
      if (!firestore) {
        const conv = localStorage.conversations.get(conversationId);
        if (conv) {
          Object.assign(conv, data);
          conv.updatedAt = new Date();
        }
        return;
      }
      await firestore
        .collection('conversations')
        .doc(conversationId)
        .update({
          ...data,
          updatedAt: admin.firestore.Timestamp.now(),
        });
    },
  },

  // Messages
  messages: {
    create: async (
      conversationId: string,
      message: Omit<IMessage, 'timestamp' | 'sequenceNumber'>
    ): Promise<string> => {
      const firestore = getDb();
      if (!firestore) {
        const messages = localStorage.messages.get(conversationId) || [];
        const sequenceNumber = messages.length + 1;
        const id = `msg_${Date.now()}`;

        messages.push({
          ...message,
          sequenceNumber,
          timestamp: new Date(),
        });
        localStorage.messages.set(conversationId, messages);

        const conv = localStorage.conversations.get(conversationId);
        if (conv) {
          conv.messageCount += 1;
          conv.updatedAt = new Date();
        }
        return id;
      }

      // Get next sequence number
      const messagesRef = firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages');

      const lastMessage = await messagesRef
        .orderBy('sequenceNumber', 'desc')
        .limit(1)
        .get();

      const nextSequenceNumber = lastMessage.empty ? 1 : lastMessage.docs[0].data().sequenceNumber + 1;

      // Create message
      const docRef = messagesRef.doc();
      await docRef.set({
        ...message,
        sequenceNumber: nextSequenceNumber,
        timestamp: admin.firestore.Timestamp.now(),
      });

      // Update conversation metadata
      await firestore
        .collection('conversations')
        .doc(conversationId)
        .update({
          messageCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.Timestamp.now(),
        });

      return docRef.id;
    },

    getByConversationId: async (
      conversationId: string,
      limit = 50
    ): Promise<(IMessage & { id: string })[]> => {
      const firestore = getDb();
      if (!firestore) {
        const messages = localStorage.messages.get(conversationId) || [];
        return messages.slice(-limit).map((msg, idx) => ({ id: `msg_${idx}`, ...msg }));
      }
      const snapshot = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('sequenceNumber', 'asc')
        .limitToLast(limit)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IMessage & { id: string }));
    },

    getLatest: async (conversationId: string, limit = 10): Promise<(IMessage & { id: string })[]> => {
      const firestore = getDb();
      if (!firestore) {
        const messages = localStorage.messages.get(conversationId) || [];
        return messages.slice(-limit).map((msg, idx) => ({ id: `msg_${idx}`, ...msg }));
      }
      const snapshot = await firestore
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('sequenceNumber', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs
        .reverse()
        .map(doc => ({ id: doc.id, ...doc.data() } as IMessage & { id: string }));
    },
  },
};
