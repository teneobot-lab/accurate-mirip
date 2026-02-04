
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const initDb = require('./config/initDb');

const app = express();

// --- 1. PROXY TRUST ---
// Penting untuk Cloudflare agar IP user terbaca benar
app.set('trust proxy', true);

// --- 2. CORS CONFIGURATION (PRIORITY HIGH) ---
// Wajib paling atas. Izinkan semua origin (*) dan method lengkap.
// Credentials false agar kompatibel dengan wildcard origin.
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: false
}));

// Handle Preflight Request secara global untuk semua route
app.options('*', cors());

// --- 3. HELMET (PERMISSIVE) ---
// Matikan policy ketat yang bisa memblokir aset/request via tunnel
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    referrerPolicy: false,
    dnsPrefetchControl: false
}));

// --- 4. BODY PARSER ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- 5. LOGGING ---
app.use(morgan('dev'));
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} | IP: ${req.ip}`);
    next();
});

// --- 6. TIMEOUT HANDLING ---
// Mencegah request hang (30 detik timeout internal)
app.use((req, res, next) => {
    res.setTimeout(30000, () => {
        console.error(`[TIMEOUT] Request cancelled: ${req.method} ${req.originalUrl}`);
        if (!res.headersSent) {
            res.status(503).send('Service Unavailable: Request Timeout');
        }
    });
    next();
});

// --- 7. ROUTES ---
app.get('/ping', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));
app.use('/api', routes);

// --- 8. ERROR HANDLER ---
app.use((req, res, next) => {
    res.status(404).json({ status: 'error', message: `Route ${req.originalUrl} not found.` });
});
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        console.log("🚀 Starting Waresix Server...");
        await initDb();
        
        const server = app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
        });

        // --- CLOUDFLARE 502 FIX ---
        // Node Keep-Alive harus > Cloudflare/Nginx Timeout (60s)
        server.keepAliveTimeout = 65000; // 65 detik
        server.headersTimeout = 66000;   // 66 detik

    } catch (error) {
        console.error("🔥 Server start failed:", error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
