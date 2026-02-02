
const router = require('express').Router();
const transactionController = require('../controllers/transactionController');

router.post('/', transactionController.createTransaction);
router.get('/', transactionController.getTransactions);

module.exports = router;
