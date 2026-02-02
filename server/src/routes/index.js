
const router = require('express').Router();
const authRoutes = require('./authRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const transactionRoutes = require('./transactionRoutes');
const musicRoutes = require('./musicRoutes');

// Health Check Endpoint
router.get('/health', (req, res) => {
    res.json({ 
        status: 'UP', 
        message: 'Backend Waresix is running',
        timestamp: new Date().toISOString()
    });
});

router.use('/auth', authRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/transactions', transactionRoutes);
router.use('/music', musicRoutes);

module.exports = router;
