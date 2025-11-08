const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  uploadExpenses,
  addExpense,
  getExpensesByMonth,
  getExpenseSummary,
  compareExpenses,
} = require('../controllers/expenseController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Upload expenses in bulk
router.post('/upload', uploadExpenses);

// Add single expense
router.post(
  '/',
  [
    body('month').matches(/^\d{4}-\d{2}$/).withMessage('Month must be in YYYY-MM format'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('amount').optional().isNumeric().withMessage('Amount must be a number'),
    body('moneyIn').optional().isNumeric().withMessage('MoneyIn must be a number'),
    body('moneyOut').optional().isNumeric().withMessage('MoneyOut must be a number'),
    body('remaining').optional().isNumeric().withMessage('Remaining must be a number'),
  ],
  addExpense
);

// Get expenses by month
router.get('/:month', getExpensesByMonth);

// Get expense summary for a month
router.get('/summary/:month', getExpenseSummary);

// Compare expenses between two months
router.get('/compare', compareExpenses);

module.exports = router;

