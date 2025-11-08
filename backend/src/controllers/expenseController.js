const Expense = require('../models/Expense');
const { body, validationResult } = require('express-validator');

// Upload expenses in bulk from JSON
const uploadExpenses = async (req, res) => {
  try {
    const { expenses } = req.body;

    if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Expenses array is required and must not be empty',
      });
    }

    const userId = req.userId;
    const expensesToSave = expenses.map((expense) => ({
      userId,
      month: expense.month || expense.Month,
      category: expense.category || expense.Category,
      amount: expense.amount || expense.Amount || 0,
      notes: expense.notes || expense.Notes || '',
      moneyIn: expense.moneyIn || expense.MoneyIn || 0,
      moneyOut: expense.moneyOut || expense.MoneyOut || 0,
      remaining: expense.remaining || expense.Remaining || 0,
    }));

    // Validate month format (YYYY-MM)
    const monthRegex = /^\d{4}-\d{2}$/;
    for (const expense of expensesToSave) {
      if (!monthRegex.test(expense.month)) {
        return res.status(400).json({
          success: false,
          message: `Invalid month format: ${expense.month}. Expected format: YYYY-MM`,
        });
      }
    }

    // Insert all expenses
    const savedExpenses = await Expense.insertMany(expensesToSave);

    res.status(201).json({
      success: true,
      message: `${savedExpenses.length} expenses uploaded successfully`,
      count: savedExpenses.length,
      expenses: savedExpenses,
    });
  } catch (error) {
    console.error('Error in uploadExpenses:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload expenses',
    });
  }
};

// Add single expense manually
const addExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const { month, category, amount, notes, moneyIn, moneyOut, remaining } = req.body;
    const userId = req.userId;

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month format. Expected format: YYYY-MM',
      });
    }

    // Calculate remaining if not provided
    let calculatedRemaining = remaining;
    if (calculatedRemaining === undefined || calculatedRemaining === null) {
      calculatedRemaining = (moneyIn || 0) - (moneyOut || 0);
    }

    const expense = await Expense.create({
      userId,
      month,
      category,
      amount: amount || 0,
      notes: notes || '',
      moneyIn: moneyIn || 0,
      moneyOut: moneyOut || 0,
      remaining: calculatedRemaining,
    });

    res.status(201).json({
      success: true,
      message: 'Expense added successfully',
      expense,
    });
  } catch (error) {
    console.error('Error in addExpense:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add expense',
    });
  }
};

// Get all expenses for a specific month
const getExpensesByMonth = async (req, res) => {
  try {
    const { month } = req.params;
    const userId = req.userId;

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month format. Expected format: YYYY-MM',
      });
    }

    const expenses = await Expense.find({ userId, month }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: expenses.length,
      month,
      expenses,
    });
  } catch (error) {
    console.error('Error in getExpensesByMonth:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get expenses',
    });
  }
};

// Get summarized data for a specific month
const getExpenseSummary = async (req, res) => {
  try {
    const { month } = req.params;
    const userId = req.userId;

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month format. Expected format: YYYY-MM',
      });
    }

    // Get all expenses for the month
    const expenses = await Expense.find({ userId, month });

    // Calculate totals
    const totalMoneyIn = expenses.reduce((sum, exp) => sum + (exp.moneyIn || 0), 0);
    const totalMoneyOut = expenses.reduce((sum, exp) => sum + (exp.moneyOut || 0), 0);
    const remaining = totalMoneyIn - totalMoneyOut;

    // Category-wise breakdown
    const categoryBreakdown = {};
    expenses.forEach((expense) => {
      const category = expense.category || 'Uncategorized';
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = {
          totalAmount: 0,
          totalMoneyIn: 0,
          totalMoneyOut: 0,
          count: 0,
        };
      }
      categoryBreakdown[category].totalAmount += expense.amount || 0;
      categoryBreakdown[category].totalMoneyIn += expense.moneyIn || 0;
      categoryBreakdown[category].totalMoneyOut += expense.moneyOut || 0;
      categoryBreakdown[category].count += 1;
    });

    // Convert to array format
    const categoryArray = Object.entries(categoryBreakdown).map(([category, data]) => ({
      category,
      ...data,
    }));

    res.status(200).json({
      success: true,
      month,
      summary: {
        totalMoneyIn,
        totalMoneyOut,
        remaining,
        totalExpenses: expenses.length,
      },
      categoryBreakdown: categoryArray,
    });
  } catch (error) {
    console.error('Error in getExpenseSummary:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get expense summary',
    });
  }
};

// Compare month-to-month spending
const compareExpenses = async (req, res) => {
  try {
    const { month1, month2 } = req.query;
    const userId = req.userId;

    if (!month1 || !month2) {
      return res.status(400).json({
        success: false,
        message: 'Both month1 and month2 query parameters are required (format: YYYY-MM)',
      });
    }

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month1) || !monthRegex.test(month2)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month format. Expected format: YYYY-MM',
      });
    }

    // Get expenses for both months
    const [expenses1, expenses2] = await Promise.all([
      Expense.find({ userId, month: month1 }),
      Expense.find({ userId, month: month2 }),
    ]);

    // Calculate totals for month1
    const month1Data = {
      month: month1,
      totalMoneyIn: expenses1.reduce((sum, exp) => sum + (exp.moneyIn || 0), 0),
      totalMoneyOut: expenses1.reduce((sum, exp) => sum + (exp.moneyOut || 0), 0),
      totalExpenses: expenses1.length,
    };
    month1Data.remaining = month1Data.totalMoneyIn - month1Data.totalMoneyOut;

    // Calculate totals for month2
    const month2Data = {
      month: month2,
      totalMoneyIn: expenses2.reduce((sum, exp) => sum + (exp.moneyIn || 0), 0),
      totalMoneyOut: expenses2.reduce((sum, exp) => sum + (exp.moneyOut || 0), 0),
      totalExpenses: expenses2.length,
    };
    month2Data.remaining = month2Data.totalMoneyIn - month2Data.totalMoneyOut;

    // Calculate differences
    const comparison = {
      moneyIn: {
        month1: month1Data.totalMoneyIn,
        month2: month2Data.totalMoneyIn,
        difference: month2Data.totalMoneyIn - month1Data.totalMoneyIn,
        percentageChange: month1Data.totalMoneyIn !== 0
          ? ((month2Data.totalMoneyIn - month1Data.totalMoneyIn) / month1Data.totalMoneyIn) * 100
          : 0,
      },
      moneyOut: {
        month1: month1Data.totalMoneyOut,
        month2: month2Data.totalMoneyOut,
        difference: month2Data.totalMoneyOut - month1Data.totalMoneyOut,
        percentageChange: month1Data.totalMoneyOut !== 0
          ? ((month2Data.totalMoneyOut - month1Data.totalMoneyOut) / month1Data.totalMoneyOut) * 100
          : 0,
      },
      remaining: {
        month1: month1Data.remaining,
        month2: month2Data.remaining,
        difference: month2Data.remaining - month1Data.remaining,
        percentageChange: month1Data.remaining !== 0
          ? ((month2Data.remaining - month1Data.remaining) / month1Data.remaining) * 100
          : 0,
      },
    };

    res.status(200).json({
      success: true,
      comparison,
      month1: month1Data,
      month2: month2Data,
    });
  } catch (error) {
    console.error('Error in compareExpenses:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to compare expenses',
    });
  }
};

module.exports = {
  uploadExpenses,
  addExpense,
  getExpensesByMonth,
  getExpenseSummary,
  compareExpenses,
};

