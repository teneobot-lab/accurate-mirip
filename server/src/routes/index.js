
const router = require('express').Router();
const authRoutes = require('./authRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const transactionRoutes = require('./transactionRoutes');
const rejectRoutes = require('./rejectRoutes');
const musicRoutes = require('./musicRoutes');

// Health Check Endpoint (Akses via /api/health)
router.get('/health', (req, res) => {
    console.log('Health check requested');
    res.json({ 
        status: 'UP', 
        service: 'waresix-acc-api',
        message: 'Backend API is responding correctly',
        timestamp: new Date().toISOString()
    });
});

router.use('/auth', authRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/transactions', transactionRoutes);
router.use('/reject', rejectRoutes);
router.use('/music', musicRoutes);

module.exports = router;
