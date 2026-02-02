
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Security & Utility Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// 1. Endpoint Health Check Super-Level (Paling Atas)
// Tes di: http://89.21.85.28:3000/ping
app.get('/ping', (req, res) => {
    res.json({ status: 'OK', service: 'waresix-acc', timestamp: new Date() });
});

// 2. Rute API
// Pastikan ini sebelum error handler
app.use('/api', routes);

// 3. Catch-all 404 Handler (Untuk Debugging)
app.use((req, res, next) => {
    console.log(`[404 NOT FOUND] Path: ${req.path} Method: ${req.method}`);
    res.status(404).json({
        status: 'error',
        message: `Route ${req.originalUrl} not found on this server.`
    });
});

// 4. Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Waresix Server [ACC] running on port ${PORT}`);
  console.log(`👉 Test Ping: http://YOUR_IP:${PORT}/ping`);
  console.log(`👉 Test API: http://YOUR_IP:${PORT}/api/health`);
});

module.exports = app;
