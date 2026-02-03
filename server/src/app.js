
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const initDb = require('./config/initDb');

const app = express();

// Security & Utility Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for bulk imports
app.use(morgan('dev'));

// 1. Health Check
app.get('/ping', (req, res) => {
    res.json({ status: 'OK', service: 'waresix-acc', timestamp: new Date() });
});

// 2. Rute API
app.use('/api', routes);

// 3. 404 Handler
app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.originalUrl} not found on this server.`
    });
});

// 4. Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Initialize Database then Start Server
const startServer = async () => {
    try {
        console.log("🚀 Starting Waresix Server...");
        
        // Auto Create/Migrate Tables before accepting requests
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
