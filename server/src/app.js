
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const initDb = require('./config/initDb');

const app = express();

// 1. Pre-middleware Logger (CATCH EVERYTHING)
app.use((req, res, next) => {
    console.log(`[REQ] ${new Date().toISOString()} | ${req.method} ${req.url} | IP: ${req.ip}`);
    next();
});

// 2. Explicit CORS configuration for Pre-flight & DELETE
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(helmet({
    crossOriginResourcePolicy: false, // Allow cross-origin images/resources
}));

app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// Health Check
app.get('/ping', (req, res) => {
    res.json({ status: 'OK', service: 'waresix-acc', timestamp: new Date() });
});

// Routes
app.use('/api', routes);

// 404
app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Not Found' });
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await initDb();
        app.listen(PORT, () => {
            console.log(`✅ Server ON: Port ${PORT}`);
        });
    } catch (error) {
        console.error("❌ DB Boot Failure:", error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
