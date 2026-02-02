
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
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for bulk import
app.use(morgan('dev'));

// Routes
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Waresix Server running on port ${PORT}`);
});

module.exports = app;
