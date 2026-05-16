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

// Temporary debug: check successRate computation for a country
app.get('/api/v1/debug/services/:countryId', async (req, res) => {
  try {
    const Country = require('./models/Country');
    const NumberPricing = require('./models/NumberPricing');
    const fivesim = require('./providers/sms/fivesim.provider');
    const grizzlysms = require('./providers/sms/grizzlysms.provider');
    const MARGIN = 0.60;
    const ISO_TO_SLUG = { US:'usa',GB:'england',IN:'india',NG:'nigeria',RU:'russia',BR:'brazil',DE:'germany',FR:'france',CA:'canada',AU:'australia',PH:'philippines',NG:'nigeria' };

    const country = await Country.findById(req.params.countryId);
    if (!country) return res.json({ error: 'country not found' });
    const fivesimSlug = country.fivesimSlug || ISO_TO_SLUG[country.code] || country.code.toLowerCase();

    const pricing = await NumberPricing.findOne({ countryId: country._id, isAvailable: true }).populate('serviceId');
    if (!pricing) return res.json({ error: 'no pricing', fivesimSlug });
    const slug = pricing.serviceId.slug;

    const [raw, grizzlyRaw] = await Promise.all([
      fivesim.getPrices(slug).catch((e) => null),
      grizzlysms.getOtpPrices(slug).catch((e) => null),
    ]);

    const byCountry = raw?.[slug] || {};
    const operators = byCountry[fivesimSlug] || {};
    let maxPrice = 0, bestRate = 0;
    for (const opData of Object.values(operators)) {
      if (opData.cost > maxPrice) maxPrice = opData.cost;
      const rawRate = opData.rate || 0;
      const normRate = rawRate > 1 ? rawRate / 100 : rawRate;
      if (normRate > bestRate) bestRate = normRate;
    }
    const fivesimRate = maxPrice > 0 ? Math.min(100, Math.round(bestRate * 1000) / 10) : null;

    // Grizzly for this country
    const grizzlyCountryData = grizzlyRaw
      ? Object.entries(grizzlyRaw).find(([, v]) => v)?.[1]
      : null;
    const grizzlyRate = grizzlyCountryData ? Math.ceil(Math.ceil(grizzlyCountryData.cost * 100) * (1 + MARGIN)) : null;

    res.json({ fivesimSlug, slug, maxPrice, bestRate, fivesimRate, grizzlyRateForAnyCountry: grizzlyRate, lix1SuccessRateWillBe: fivesimRate });
  } catch (err) {
    res.json({ error: err.message });
  }
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
