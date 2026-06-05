import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { config } from './config.js';
import { Logger } from './logger.js';

const logger = new Logger('Middleware');

// Rate limiter (per IP)
export const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    const resetTime = (req as any).rateLimit?.resetTime || new Date().toISOString();
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: resetTime,
    });
  },
});

// Rate limiter (per device ID for auth attempts)
export const deviceRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5, // Max 5 attempts per minute per device
  keyGenerator: (req) => (req.body as any)?.deviceId || req.ip || 'unknown',
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for device: ${(req.body as any)?.deviceId}`);
    res.status(429).json({
      error: 'Too many authentication attempts. Please try again later.',
    });
  },
});

// Bearer token middleware (validates QR token)
export const requireBearerToken = (tokenStore: Map<string, any>) => (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const token = authHeader.slice(7);
  const storedToken = tokenStore.get(token);

  if (!storedToken || Date.now() > storedToken.expiresAt) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.userId = storedToken.deviceId;
  next();
};

// Auth middleware
export const requireUserId = (req: Request, res: Response, next: NextFunction): void => {
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    res.status(401).json({ error: 'Invalid user ID format' });
    return;
  }

  req.userId = userId;
  next();
};

// Validate conversation ID format
export const validateConversationId = (req: Request, res: Response, next: NextFunction): void => {
  const { id } = req.params;

  // Firestore document IDs are alphanumeric + underscores/dashes, typically 20+ chars
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(id)) {
    res.status(400).json({ error: 'Invalid conversation ID format' });
    return;
  }

  next();
};

// Error handler middleware
export const errorHandler = (
  err: Error & { statusCode?: number },
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error(`${req.method} ${req.path}`, err);

  const statusCode = err.statusCode || 500;
  const isDev = config.server.nodeEnv === 'development';

  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
  });

  next();
};

// CORS options
export const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-id', 'authorization'],
};
