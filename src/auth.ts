import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { db } from './firebase.js';
import { Logger } from './logger.js';

const logger = new Logger('Auth');

interface QRToken {
  token: string;
  deviceId: string;
  expiresAt: number;
  backendUrl: string;
}

interface QRData {
  token: string;
  deviceId: string;
  expiresAt: number;
}

// In-memory token store (use Redis in production)
const tokenStore = new Map<string, QRToken>();

// Cleanup expired tokens every minute
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, token] of tokenStore.entries()) {
    if (token.expiresAt < now) {
      tokenStore.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Cleaned up ${cleaned} expired tokens`);
  }
}, 60000);

export const generateQRToken = (): QRToken => {
  const deviceId = uuidv4();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + config.qrToken.expiryMinutes * 60 * 1000;

  const qrToken: QRToken = {
    token,
    deviceId,
    expiresAt,
    backendUrl: config.server.backendUrl,
  };

  tokenStore.set(token, qrToken);
  logger.info(`Generated QR token for device: ${deviceId}`);

  return qrToken;
};

export const verifyAndPairDevice = async (qrData: QRData): Promise<{ userId: string; deviceId: string }> => {
  const { token, deviceId, expiresAt } = qrData;

  // Verify token exists and is not expired
  const storedToken = tokenStore.get(token);
  if (!storedToken) {
    throw new Error('Invalid QR token');
  }

  if (Date.now() > storedToken.expiresAt) {
    tokenStore.delete(token);
    throw new Error('QR token expired');
  }

  // Verify device ID matches (timing-safe comparison)
  if (!crypto.timingSafeEqual(Buffer.from(storedToken.deviceId), Buffer.from(deviceId))) {
    throw new Error('Device ID mismatch');
  }

  // Verify expiry timestamp matches (timing-safe comparison)
  if (!crypto.timingSafeEqual(Buffer.from(storedToken.expiresAt.toString()), Buffer.from(expiresAt.toString()))) {
    throw new Error('Token expiry mismatch');
  }

  // Check if device already exists
  let user = await db.users.getByDeviceId(deviceId);

  if (!user) {
    // Create new user
    const userId = await db.users.create(deviceId);
    user = { id: userId, deviceId, createdAt: undefined as any };
    logger.info(`Created new user for device: ${deviceId}`);
  } else {
    logger.info(`Paired existing device: ${deviceId}`);
  }

  // Remove used token
  tokenStore.delete(token);

  return {
    userId: user.id,
    deviceId,
  };
};

export const validateUserSession = async (userId: string): Promise<boolean> => {
  try {
    const user = await db.users.getById(userId);
    return user !== null;
  } catch (error) {
    logger.error('Session validation failed', error);
    return false;
  }
};
