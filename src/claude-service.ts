import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { Logger } from './logger.js';

const logger = new Logger('ClaudeService');

let client: Anthropic | null = null;

const getClient = (): Anthropic => {
  if (!client) {
    if (!config.claude.apiKey) {
      throw new Error('CLAUDE_API_KEY not configured');
    }
    client = new Anthropic({
      apiKey: config.claude.apiKey,
      baseURL: 'https://openrouter.io/api/v1',
    });
  }
  return client;
};

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const generateClaudeResponse = async (
  conversationHistory: Message[]
): Promise<string> => {
  try {
    const claudeClient = getClient();

    const response = await claudeClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: `You are a helpful AI assistant. You are concise and conversational.
      Keep responses under 500 words unless asked for more detail.`,
      messages: conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }

    throw new Error('Unexpected response type from Claude');
  } catch (error) {
    logger.error('Failed to generate Claude response', error);
    throw error;
  }
};

export const validateClaudeApiKey = async (): Promise<boolean> => {
  try {
    const claudeClient = getClient();

    // Make a minimal request to verify the key
    await claudeClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'ping',
        },
      ],
    });

    logger.info('Claude API key validated');
    return true;
  } catch (error) {
    logger.error('Claude API key validation failed', error);
    return false;
  }
};
