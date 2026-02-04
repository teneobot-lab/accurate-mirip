
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const initDb = require('./config/initDb');

const app = express();

// --- 1. PROXY TRUST (CRITICAL FOR CLOUDFLARE) ---
// Agar Express membaca IP asli dari header X-Forwarded-For
app.set('trust proxy', 1);

// --- 2. CORS CONFIGURATION (MUST BE FIRST) ---
// Mengizinkan Frontend mengakses method PUT/DELETE/PATCH tanpa blokir
app.use(cors({
    origin: true, // Allow all origins (reflects request origin)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Handle Global OPTIONS (Preflight) untuk mencegah 502/404 pada method non-GET
app.options('*', cors());

// --- 3. HELMET (PERMISSIVE MODE) ---
// Mematikan policy yang sering memblokir SPA/Cloudflare
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: false,
    dnsPrefetchControl: false
}));

// --- 4. REQUEST PARSERS ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- 5. LOGGING ---
app.use(morgan('dev'));
app.use((req, res, next) => {
    // Log manual untuk debugging traffic via Proxy
    console.log(`[PROXY] ${new Date().toISOString()} | ${req.method} ${req.originalUrl} | IP: ${req.ip}`);
    next();
});

// --- 6. TIMEOUT PROTECTION ---
// Mencegah request hang selamanya
app.use((req, res, next) => {
    res.setTimeout(30000, () => { // 30 detik timeout
        console.error(`[TIMEOUT] Request took too long: ${req.method} ${req.originalUrl}`);
        if (!res.headersSent) {
            res.status(503).send('Service Unavailable: Request Timeout');
        }
    });
    next();
});

// --- 7. HEALTH CHECK ---
app.get('/ping', (req, res) => {
    res.json({ status: 'OK', service: 'waresix-backend', timestamp: new Date() });
});

// --- 8. ROUTES ---
app.use('/api', routes);

// --- 9. ERROR HANDLING ---
app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.originalUrl} not found on this server.`
    });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Initialize Database then Start Server
const startServer = async () => {
    try {
        console.log("🚀 Starting Waresix Server...");
        await initDb();
        
        const server = app.listen(PORT, () => {
            console.log(`✅ Server running successfully on port ${PORT}`);
            console.log(`👉 Health Check: http://localhost:${PORT}/ping`);
        });

        // --- CRITICAL FIX FOR 502 BAD GATEWAY ON CLOUDFLARE ---
        // Ensure Node timeout > Cloudflare/LB timeout (usually 60s)
        // Jika Node menutup koneksi lebih cepat dari Cloudflare, user mendapat 502.
        server.keepAliveTimeout = 65000; // 65 seconds
        server.headersTimeout = 66000;   // 66 seconds

    } catch (error) {
        console.error("🔥 CRITICAL FAILURE: Could not start server due to DB Error.");
        console.error(error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
