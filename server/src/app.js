
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const initDb = require('./config/initDb');

const app = express();

// --- 1. DEBUG LOGGER ---
app.use((req, res, next) => {
    console.log(`[REQ] ${new Date().toISOString()} | ${req.method} ${req.url} | IP: ${req.ip}`);
    next();
});

// 2. CORS (Diletakkan di atas helmet agar pre-flight OPTIONS tidak terblokir)
app.use(cors());

// 3. HELMET CONFIGURATION (Tuned for SPA & ESM)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // IZINKAN ESM.SH karena index.html menggunakan importmap dari sana
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'", 
                "'unsafe-eval'", 
                "https://cdn.tailwindcss.com", 
                "https://esm.sh"
            ],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://*"],
            // IZINKAN YOUTUBE untuk Music Player
            frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com"],
            // IZINKAN KONEKSI API (Connect-src * membolehkan panggil API dari domain manapun saat dev)
            connectSrc: ["'self'", "*"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [], // Matikan auto-upgrade ke HTTPS jika server masih HTTP (Common issue on VPS)
        },
    },
    // Matikan proteksi yang sering mengganggu loading resource cross-origin
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
}));

app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// 4. Health Check
app.get('/ping', (req, res) => {
    res.json({ status: 'OK', service: 'waresix-acc', timestamp: new Date() });
});

// 5. Rute API
app.use('/api', routes);

// 6. 404 Handler
app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.originalUrl} not found on this server.`
    });
});

// 7. Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Initialize Database then Start Server
const startServer = async () => {
    try {
        console.log("🚀 Starting Waresix Server...");
        await initDb();
        app.listen(PORT, () => {
            console.log(`✅ Server running successfully on port ${PORT}`);
            console.log(`👉 Health Check: http://localhost:${PORT}/ping`);
        });
    } catch (error) {
        console.error("🔥 CRITICAL FAILURE: Could not start server due to DB Error.");
        console.error(error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
