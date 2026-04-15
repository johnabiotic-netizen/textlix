const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const setupSocket = require('./sockets/socket.handler');
const smsPoller = require('./services/sms-poller.service');
const expiryJob = require('./jobs/number-expiry.job');
const cleanupJob = require('./jobs/sms-cleanup.job');
const logger = require('./config/logger');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'https://www.textlix.com',
  'https://textlix.com',
  'https://textlix-production.up.railway.app',
  'http://localhost:5173',
  'http://localhost:5174',
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupSocket(io);
smsPoller.setIO(io);
expiryJob.setIO(io);

const start = async () => {
  await connectDB();

  // Resume polling for any orders active before restart
  await smsPoller.resumeActive();

  // Start cron jobs
  expiryJob.start();
  cleanupJob.start();

  server.listen(PORT, () => {
    logger.info(`TextLix server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  smsPoller.stopAll();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down');
  smsPoller.stopAll();
  server.close(() => process.exit(0));
});

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
