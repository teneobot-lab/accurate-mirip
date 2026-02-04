const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const initDb = require('./config/initDb');

const app = express();

/* =========================================================
   1. BASIC TRUST PROXY (WAJIB JIKA LEWAT VERCEL / NGINX)
========================================================= */
app.set('trust proxy', true);

/* =========================================================
   2. REQUEST LOGGER (DEBUG FRIENDLY)
========================================================= */
app.use((req, res, next) => {
  console.log(
    `[REQ] ${new Date().toISOString()} | ${req.method} ${req.originalUrl} | IP: ${req.ip}`
  );
  next();
});

/* =========================================================
   3. CORS (AMAN UNTUK VERCEL & SPA)
========================================================= */
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/* =========================================================
   4. BODY PARSER (WAJIB SEBELUM ROUTES)
========================================================= */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   5. HELMET (TUNED AGAR TIDAK MERUSAK SPA / REWRITE)
========================================================= */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://cdn.tailwindcss.com",
        "https://esm.sh"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.tailwindcss.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://*"
      ],
      frameSrc: [
        "'self'",
        "https://www.youtube.com",
        "https://youtube.com"
      ],
      connectSrc: [
        "'self'",
        "*"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}));

/* =========================================================
   6. HTTP LOGGER
========================================================= */
app.use(morgan('dev'));

/* =========================================================
   7. HEALTH CHECK (WAJIB UNTUK VERCEL DEBUG)
========================================================= */
app.get('/ping', (req, res) => {
  res.json({
    status: 'OK',
    service: 'waresix-acc',
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   8. API ROUTES
========================================================= */
app.use('/api', routes);

/* =========================================================
   9. 404 HANDLER (JSON ONLY, NO HTML)
========================================================= */
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
  });
});

/* =========================================================
   10. GLOBAL ERROR HANDLER (ANTI 502)
========================================================= */
app.use((err, req, res, next) => {
  console.error('🔥 GLOBAL ERROR:', err);

  // Jangan pernah kirim HTML
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
});

/* =========================================================
   11. SERVER BOOTSTRAP
========================================================= */
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    console.log('🚀 Starting Waresix Server...');
    await initDb();

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`👉 Health Check: http://localhost:${PORT}/ping`);
    });
  } catch (error) {
    console.error('🔥 CRITICAL: Failed to start server');
    console.error(error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
