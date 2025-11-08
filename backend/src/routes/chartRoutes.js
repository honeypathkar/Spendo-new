const express = require('express');
const router = express.Router();
const {
  getMonthlyTotals,
  getCategoryDistribution,
  getTrends,
} = require('../controllers/chartController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get monthly totals
router.get('/monthly', getMonthlyTotals);

// Get category distribution for a specific month
router.get('/category/:month', getCategoryDistribution);

// Get money in/out trends
router.get('/trend', getTrends);

module.exports = router;

