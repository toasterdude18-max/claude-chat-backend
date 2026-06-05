import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config.js';
import { initializeFirebase } from './firebase.js';
import {
  limiter,
  errorHandler,
  requestLogger,
  corsOptions,
} from './middleware.js';
import { Logger } from './logger.js';

// Routes
import authRoutes from './routes/auth.js';
import conversationRoutes from './routes/conversations.js';
import healthRoutes from './routes/health.js';

const logger = new Logger('Server');

const app = express();

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(cors(corsOptions));
app.use(requestLogger);
app.use(limiter);

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/conversations', conversationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const start = async (): Promise<void> => {
  try {
    // Validate NODE_ENV matches config
    if (config.server.nodeEnv === 'production' && process.env.NODE_ENV !== 'production') {
      throw new Error('NODE_ENV mismatch - refusing to start in production mode without NODE_ENV=production');
    }

    // Validate configuration
    validateConfig();
    logger.info('Configuration validated');

    // Initialize Firebase (skip in development)
    if (config.server.nodeEnv === 'production') {
      initializeFirebase();
      logger.info('Firebase initialized');
    } else {
      logger.info('Skipping Firebase initialization (development mode - using in-memory storage)');
    }

    // Start Express server
    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`Server running on http://localhost:${port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
      logger.info(`Backend URL: ${config.server.backendUrl}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

start();

export default app;
