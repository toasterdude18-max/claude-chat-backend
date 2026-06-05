import { Router, Request, Response } from 'express';
import { generateQRToken, verifyAndPairDevice } from '../auth.js';
import { limiter, deviceRateLimiter } from '../middleware.js';
import { Logger } from '../logger.js';

const router = Router();
const logger = new Logger('AuthRoutes');

interface QRTokenResponse {
  token: string;
  deviceId: string;
  expiresAt: number;
  expiresIn: number;
  backendUrl: string;
}

interface PairRequest {
  token: string;
  deviceId: string;
  expiresAt: number;
}

interface PairResponse {
  userId: string;
  deviceId: string;
}

/**
 * POST /auth/qr-token
 * Generates a new QR token for device pairing
 * Returns: { token, deviceId, expiresAt, expiresIn, backendUrl }
 */
router.post('/qr-token', limiter, (req: Request, res: Response): void => {
  try {
    const qrToken = generateQRToken();

    const response: QRTokenResponse = {
      token: qrToken.token,
      deviceId: qrToken.deviceId,
      expiresAt: qrToken.expiresAt,
      expiresIn: qrToken.expiresAt - Date.now(),
      backendUrl: qrToken.backendUrl,
    };

    logger.info('QR token generated');
    res.status(200).json(response);
  } catch (error) {
    logger.error('Failed to generate QR token', error);
    res.status(500).json({ error: 'Failed to generate QR token' });
  }
});

/**
 * POST /auth/pair
 * Pairs a device using QR data
 * Body: { token, deviceId, expiresAt }
 * Returns: { userId, deviceId }
 */
router.post('/pair', limiter, deviceRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, deviceId, expiresAt } = req.body as PairRequest;

    if (!token || !deviceId || !expiresAt) {
      res.status(400).json({
        error: 'Missing required fields: token, deviceId, expiresAt',
      });
      return;
    }

    const pairing = await verifyAndPairDevice({ token, deviceId, expiresAt });

    logger.info(`Device paired successfully: ${pairing.deviceId}`);
    res.status(200).json(pairing as PairResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`Pairing failed: ${message}`);
    res.status(400).json({ error: message });
  }
});

export default router;
