import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { attachSession, securityContext } from './auth/middleware.js';
import { apiRouter } from './http/api.js';
import { apiNotFound, errorHandler } from './http/errors.js';
import { csrfProtection } from './security/csrf.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(securityContext);
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
        imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com'],
        connectSrc: ["'self'", 'https://accounts.google.com/gsi/'],
        frameSrc: ['https://accounts.google.com/gsi/'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.isProduction ? [] : null,
      },
    },
  }));

  app.use(express.json({ limit: '100kb', strict: true }));
  app.use(cookieParser());
  app.use(csrfProtection);
  app.use(attachSession);

  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', apiRouter);
  app.use('/api', apiNotFound);

  app.use('/shared', express.static(path.join(config.rootDir, 'shared'), {
    index: false,
    maxAge: config.isProduction ? '1h' : 0,
  }));
  app.use(express.static(path.join(config.rootDir, 'public'), {
    index: false,
    maxAge: config.isProduction ? '1h' : 0,
  }));

  app.get(/.*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(config.rootDir, 'public', 'index.html'));
  });

  app.use(errorHandler);
  return app;
}
