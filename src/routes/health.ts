import { Router, Request, Response } from 'express';
import { Logger } from '../logger.js';

const router = Router();
const logger = new Logger('HealthRoutes');

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

/**
 * GET /health
 * Health check endpoint
 * Returns: { status, timestamp, uptime }
 */
router.get('/', (req: Request, res: Response): void => {
  const response: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  res.status(200).json(response);
});

export default router;
