import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import http from 'http';
import express from 'express';
import cors from 'cors';

import { config } from './config.js';
import auth from './middleware/auth.js';
import errorHandler from './middleware/error-handler.js';

import { taskRouter } from './routes/tasks.js';
import { planRouter } from './routes/plans.js';
import { diffRouter } from './routes/diffs.js';
import { mergeRouter } from './routes/merge.js';
import { eventRouter } from './routes/events.js';
import { slotRouter } from './routes/slots.js';
import { daemonRouter } from './routes/daemon.js';
import { fileLockRouter } from './routes/file-locks.js';
import { messagingRouter } from './routes/messaging.js';
import { telegramBot } from './messaging/telegram.js';
import { sendNotification } from './messaging/notifications.js';

import { setupWebSocket } from './ws/server.js';
import { runMigrations } from './db/migrate.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Messaging webhooks — mounted BEFORE auth (Meta sends these directly)
app.use('/api/v1/messaging', messagingRouter);

// Auth middleware on all /api/v1 routes
app.use('/api/v1', auth);

// Mount routes
app.use('/api/v1/tasks', taskRouter);
// Plans, diffs, and merge are nested under tasks (e.g. /:id/plans, /:id/diffs, /:id/merge/*)
app.use('/api/v1/tasks', planRouter);
app.use('/api/v1/tasks', diffRouter);
app.use('/api/v1/tasks', mergeRouter);
app.use('/api/v1/events', eventRouter);
app.use('/api/v1/slots', slotRouter);
app.use('/api/v1/daemon', daemonRouter);
app.use('/api/v1/file-locks', fileLockRouter);

// Serve dashboard static files in production
const dashboardDist = path.resolve(__dirname, '../../dashboard/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(dashboardDist));
  // SPA fallback — serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/ws') return next();
    res.sendFile(path.join(dashboardDist, 'index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

const server = http.createServer(app);
setupWebSocket(server);

async function start() {
  try {
    await runMigrations();
    server.listen(config.port, () => {
      console.log(`Agent Pool server running on port ${config.port}`);

      // Start Telegram long-polling if configured (non-blocking)
      if (telegramBot.isConfigured()) {
        telegramBot.startPolling();
        console.log('Telegram bot polling active.');
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Export sendNotification so other parts of the server can trigger messaging
export { sendNotification };

start();
