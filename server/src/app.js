require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Force Node's DNS resolver to use known-good public DNS servers. Windows can
// hand Node a loopback DNS server (e.g. 127.0.0.1 from a VPN/local resolver
// that isn't actually running), causing ECONNREFUSED on every lookup —
// including Atlas SRV resolution. This is a localhost-dev workaround.
const dns = require('dns');
const currentServers = dns.getServers();
if (currentServers.length === 0 || currentServers.every((s) => s === '127.0.0.1' || s === '::1')) {
  dns.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1']);
}


const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const passport = require('./config/passport');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const creditRoutes = require('./routes/credit.routes');
const numberRoutes = require('./routes/number.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes = require('./routes/admin.routes');
const creatorRoutes = require('./routes/creator.routes');
const welcomeBonusRoutes = require('./routes/welcome-bonus.routes');
const supportRoutes = require('./routes/support.routes');
const errorMiddleware = require('./middleware/error.middleware');
const { getPublicStats } = require('./controllers/number.controller');

const app = express();

// Trust Railway's reverse proxy so express-rate-limit reads the real client IP
app.set('trust proxy', 1);

// Gzip compression — must be before any routes
app.use(compression());

// Security
// Helmet with explicit hardening for a finance / PII app.
// 2-year HSTS w/ preload, strict CORP, same-origin opener. CSP uses defaults
// — tighten when the asset origin list is stable (CDNs, Sentry, etc.).
app.use(helmet({
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        'https://www.textlix.com',
        'https://textlix.com',
        'https://creator.textlix.com',
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

// General rate limit.
// Key authenticated requests by USER id so users sharing one public IP (mobile
// carrier-grade NAT, or Cloudflare's edge) each get their own budget instead of
// fighting over a single bucket. Unauthenticated requests key on the real client
// IP via Cloudflare's CF-Connecting-IP header (req.ip can be a proxy hop).
const rateLimitKey = (req) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), process.env.JWT_ACCESS_SECRET);
      if (payload?.userId) return `user:${payload.userId}`;
    } catch (_) { /* invalid/expired — fall through to IP keying */ }
  }
  return `ip:${req.headers['cf-connecting-ip'] || req.ip}`;
};

const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
});
app.use('/api', generalLimiter);

// Public stats — no auth required
app.get('/api/v1/stats', getPublicStats);









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
app.use('/api/v1/creator', creatorRoutes);
app.use('/api/v1/welcome-bonus', welcomeBonusRoutes);
app.use('/api/v1/support', supportRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// Error handler
app.use(errorMiddleware);

module.exports = app;
