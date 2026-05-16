require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });


const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const passport = require('./config/passport');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const creditRoutes = require('./routes/credit.routes');
const numberRoutes = require('./routes/number.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes = require('./routes/admin.routes');
const errorMiddleware = require('./middleware/error.middleware');
const { getPublicStats } = require('./controllers/number.controller');

const app = express();

// Trust Railway's reverse proxy so express-rate-limit reads the real client IP
app.set('trust proxy', 1);

// Gzip compression — must be before any routes
app.use(compression());

// Security
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        'https://www.textlix.com',
        'https://textlix.com',
        'https://textlix-production.up.railway.app',
        'http://localhost:5173',
        'http://localhost:5174',
      ];
      if (!origin || allowed.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

// Webhooks need raw body — register before json parser, accept any content-type
app.use('/api/v1/payments/oxprocessing/webhook', express.raw({ type: '*/*' }));
app.use('/api/v1/payments/korapay/webhook', express.raw({ type: '*/*' }));

// Body parsing — 50kb limit prevents large-payload attacks
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser());

// Passport
app.use(passport.initialize());

// General rate limit
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

// Public stats — no auth required
app.get('/api/v1/stats', getPublicStats);

// Temporary debug: find Fiverr code + get real GrizzlySMS country list
app.get('/api/v1/debug/grizzly-meta', async (req, res) => {
  const axios = require('axios');
  const KEY = process.env.GRIZZLYSMS_API_KEY;
  const BASE = 'https://api.grizzlysms.com/stubs/handler_api.php';
  const call = (params) => axios.get(BASE, { params: { api_key: KEY, ...params }, timeout: 12000 }).then(r => r.data);

  // Test Fiverr codes
  const fiverCodes = ['fv', 'fiver', 'fiverr', 'fi'];
  const fiverResults = {};
  for (const code of fiverCodes) {
    try {
      const data = await call({ action: 'getPrices', service: code });
      const total = typeof data === 'object' ? Object.values(data).reduce((s, v) => s + (v?.[code]?.count || 0), 0) : 0;
      fiverResults[code] = { countries: typeof data === 'object' ? Object.keys(data).length : 0, total };
    } catch (e) { fiverResults[code] = { error: e.message }; }
  }

  // Get real country list from GrizzlySMS
  let countries = null;
  try {
    countries = await call({ action: 'getCountries' });
  } catch (e) { countries = { error: e.message }; }

  res.json({ fiverr: fiverResults, countries });
});




// Public settings (announcement banner, etc.) — no auth required
app.get('/api/v1/public/settings', async (req, res) => {
  try {
    const PlatformSettings = require('./models/PlatformSettings');
    const banner = await PlatformSettings.findOne({ key: 'announcementBanner' });
    res.json({ success: true, data: { announcementBanner: banner?.value || null } });
  } catch (_) {
    res.json({ success: true, data: { announcementBanner: null } });
  }
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/credits', creditRoutes);
app.use('/api/v1/numbers', numberRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// Error handler
app.use(errorMiddleware);

module.exports = app;
