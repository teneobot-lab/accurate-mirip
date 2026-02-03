
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const initDb = require('./config/initDb');

const app = express();

// --- 1. DEBUG LOGGER (TOP PRIORITY) ---
app.use((req, res, next) => {
    console.log(`[REQ] ${new Date().toISOString()} | ${req.method} ${req.url} | IP: ${req.ip}`);
    next();
});

// Security & Utility Middlewares
// UPDATE: Konfigurasi CSP Khusus untuk mengizinkan YouTube Iframe & Tailwind CDN
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com"], // IZINKAN YOUTUBE
            connectSrc: ["'self'", "*"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
}));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// 2. Health Check
app.get('/ping', (req, res) => {
    res.json({ status: 'OK', service: 'waresix-acc', timestamp: new Date() });
});

// 3. Rute API
app.use('/api', routes);

// 4. 404 Handler
app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.originalUrl} not found on this server.`
    });
});

// 5. Global Error Handler
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
