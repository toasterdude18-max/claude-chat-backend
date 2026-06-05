import { Request } from 'express';

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export interface QRTokenPayload {
  token: string;
  deviceId: string;
  expiresAt: number;
  backendUrl: string;
}

export interface UserPayload {
  userId: string;
  deviceId: string;
}

export interface ConversationPayload {
  conversationId: string;
  userId: string;
  createdAt: string;
}

export interface MessagePayload {
  id: string;
  conversationId: string;
  senderId: 'user' | 'assistant';
  text: string;
  timestamp?: string;
  sequenceNumber?: number;
}

export interface ChatMessagePayload {
  userMessage: MessagePayload;
  assistantMessage: MessagePayload;
}

export interface ConversationDetailPayload {
  conversation: {
    id: string;
    userId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
  };
  messages: MessagePayload[];
}

export interface ErrorPayload {
  error: string;
  stack?: string;
}
