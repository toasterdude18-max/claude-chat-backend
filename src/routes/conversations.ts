import { Router, Request, Response } from 'express';
import { db } from '../firebase.js';
import { generateClaudeResponse } from '../claude-service.js';
import { requireUserId, limiter, validateConversationId } from '../middleware.js';
import { Logger } from '../logger.js';
import admin from 'firebase-admin';

const router = Router();
const logger = new Logger('ConversationRoutes');

interface CreateConversationRequest {
  title?: string;
}

interface CreateMessageRequest {
  text: string;
}

/**
 * POST /conversations
 * Creates a new conversation
 * Body: { title? }
 * Returns: { conversationId, userId, createdAt }
 */
router.post('/', limiter, requireUserId, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { title } = req.body as CreateConversationRequest;

    const conversationId = await db.conversations.create(userId, title);

    await db.users.updateLastActive(userId);

    logger.info(`Conversation created: ${conversationId} for user: ${userId}`);
    res.status(201).json({
      conversationId,
      userId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to create conversation', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /conversations/:id
 * Fetches a conversation with messages
 * Query: ?limit=50 (default: 50)
 * Returns: { conversation, messages }
 */
router.get('/:id', limiter, requireUserId, validateConversationId, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id: conversationId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const conversation = await db.conversations.getById(conversationId);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const messages = await db.messages.getByConversationId(conversationId, limit);

    await db.users.updateLastActive(userId);

    logger.info(`Conversation fetched: ${conversationId} with ${messages.length} messages`);
    res.status(200).json({
      conversation,
      messages,
    });
  } catch (error) {
    logger.error('Failed to fetch conversation', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * POST /conversations/:id/messages
 * Adds a message to a conversation and gets Claude response
 * Body: { text }
 * Returns: { userMessage, assistantMessage }
 */
router.post(
  '/:id/messages',
  limiter,
  requireUserId,
  validateConversationId,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { id: conversationId } = req.params;
      const { text } = req.body as CreateMessageRequest;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        res.status(400).json({ error: 'Message text is required' });
        return;
      }

      if (text.length > 5000) {
        res.status(400).json({ error: 'Message text exceeds maximum length' });
        return;
      }

      // Verify conversation exists and belongs to user
      const conversation = await db.conversations.getById(conversationId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      if (conversation.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Save user message
      const userMessageId = await db.messages.create(conversationId, {
        conversationId,
        senderId: 'user',
        text: text.trim(),
      });

      logger.info(`User message created: ${userMessageId}`);

      // Get conversation history
      const messages = await db.messages.getByConversationId(conversationId, 20);

      // Generate Claude response
      const conversationHistory = messages.map(msg => ({
        role: msg.senderId as 'user' | 'assistant',
        content: msg.text,
      }));

      let assistantMessage: string;
      try {
        assistantMessage = await generateClaudeResponse(conversationHistory);
      } catch (error) {
        // If Claude API fails, use a fallback message
        logger.warn('Claude API failed, using fallback response', error);
        assistantMessage = "I'm unable to generate a response at the moment. Please try again later.";
      }

      // Save assistant message
      const assistantMessageId = await db.messages.create(conversationId, {
        conversationId,
        senderId: 'assistant',
        text: assistantMessage,
      });

      logger.info(`Assistant message created: ${assistantMessageId}`);
      await db.users.updateLastActive(userId);

      res.status(201).json({
        userMessage: {
          id: userMessageId,
          conversationId,
          senderId: 'user',
          text: text.trim(),
        },
        assistantMessage: {
          id: assistantMessageId,
          conversationId,
          senderId: 'assistant',
          text: assistantMessage,
        },
      });
    } catch (error) {
      logger.error('Failed to add message', error);
      res.status(500).json({ error: 'Failed to add message' });
    }
  }
);

/**
 * GET /conversations
 * Lists user's conversations
 * Query: ?limit=20 (default: 20)
 * Returns: { conversations: [] }
 */
router.get('/', limiter, requireUserId, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const conversations = await db.conversations.getByUserId(userId, limit);

    await db.users.updateLastActive(userId);

    logger.info(`${conversations.length} conversations fetched for user: ${userId}`);
    res.status(200).json({ conversations });
  } catch (error) {
    logger.error('Failed to list conversations', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

export default router;
