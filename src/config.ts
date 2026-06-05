import dotenv from 'dotenv';

dotenv.config();

type ConfigShape = {
  firebase: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
  };
  claude: {
    apiKey: string;
  };
  server: {
    port: number;
    nodeEnv: string;
    backendUrl: string;
  };
  qrToken: {
    expiryMinutes: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
};

export const config: ConfigShape = {
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
  },
  qrToken: {
    expiryMinutes: parseInt(process.env.QR_TOKEN_EXPIRY_MINUTES || '5', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};

// Validation
export const validateConfig = (): void => {
  const required = [
    'firebase.projectId',
    'firebase.privateKey',
    'firebase.clientEmail',
    'claude.apiKey',
  ];

  // Only require Claude API key (Firebase is optional for local/Vercel deployment)
  const requiredForDeployment = ['claude.apiKey'];

  const missing = requiredForDeployment.filter(key => {
    const [section, field] = key.split('.');
    const sectionConfig = config[section as keyof ConfigShape];
    return !sectionConfig[field as keyof typeof sectionConfig];
  });

  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }
};
