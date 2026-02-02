
const router = require('express').Router();
const authRoutes = require('./authRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const transactionRoutes = require('./transactionRoutes');
const musicRoutes = require('./musicRoutes');

router.use('/auth', authRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/transactions', transactionRoutes);
router.use('/music', musicRoutes);

module.exports = router;
