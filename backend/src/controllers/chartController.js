const Expense = require('../models/Expense');

// Get monthly totals for chart visualization
const getMonthlyTotals = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 12 } = req.query; // Default to last 12 months

    // Get all expenses grouped by month
    const expenses = await Expense.find({ userId }).sort({ month: -1 });

    // Group by month
    const monthlyData = {};
    expenses.forEach((expense) => {
      const month = expense.month;
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          totalMoneyIn: 0,
          totalMoneyOut: 0,
          totalExpenses: 0,
        };
      }
      monthlyData[month].totalMoneyIn += expense.moneyIn || 0;
      monthlyData[month].totalMoneyOut += expense.moneyOut || 0;
      monthlyData[month].totalExpenses += 1;
    });

    // Convert to array and calculate remaining
    let monthlyArray = Object.values(monthlyData).map((data) => ({
      ...data,
      remaining: data.totalMoneyIn - data.totalMoneyOut,
    }));

    // Sort by month (descending) and limit
    monthlyArray.sort((a, b) => b.month.localeCompare(a.month));
    monthlyArray = monthlyArray.slice(0, parseInt(limit));

    // Sort by month (ascending) for chart display
    monthlyArray.sort((a, b) => a.month.localeCompare(b.month));

    res.status(200).json({
      success: true,
      count: monthlyArray.length,
      data: monthlyArray,
    });
  } catch (error) {
    console.error('Error in getMonthlyTotals:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get monthly totals',
    });
  }
};

// Get category-wise expense distribution for a specific month
const getCategoryDistribution = async (req, res) => {
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

    // Group by category
    const categoryData = {};
    expenses.forEach((expense) => {
      const category = expense.category || 'Uncategorized';
      if (!categoryData[category]) {
        categoryData[category] = {
          category,
          totalAmount: 0,
          totalMoneyIn: 0,
          totalMoneyOut: 0,
          count: 0,
        };
      }
      categoryData[category].totalAmount += expense.amount || 0;
      categoryData[category].totalMoneyIn += expense.moneyIn || 0;
      categoryData[category].totalMoneyOut += expense.moneyOut || 0;
      categoryData[category].count += 1;
    });

    // Convert to array and sort by totalMoneyOut (descending)
    const categoryArray = Object.values(categoryData).sort(
      (a, b) => b.totalMoneyOut - a.totalMoneyOut
    );

    // Calculate percentages
    const totalMoneyOut = categoryArray.reduce((sum, cat) => sum + cat.totalMoneyOut, 0);
    const categoryArrayWithPercentages = categoryArray.map((cat) => ({
      ...cat,
      percentage: totalMoneyOut > 0 ? (cat.totalMoneyOut / totalMoneyOut) * 100 : 0,
    }));

    res.status(200).json({
      success: true,
      month,
      count: categoryArray.length,
      totalMoneyOut,
      data: categoryArrayWithPercentages,
    });
  } catch (error) {
    console.error('Error in getCategoryDistribution:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get category distribution',
    });
  }
};

// Get money in/out trends over time
const getTrends = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 12 } = req.query; // Default to last 12 months

    // Get all expenses
    const expenses = await Expense.find({ userId }).sort({ month: -1, createdAt: -1 });

    // Group by month
    const monthlyData = {};
    expenses.forEach((expense) => {
      const month = expense.month;
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          moneyIn: [],
          moneyOut: [],
          totalMoneyIn: 0,
          totalMoneyOut: 0,
        };
      }
      if (expense.moneyIn > 0) {
        monthlyData[month].moneyIn.push(expense.moneyIn);
        monthlyData[month].totalMoneyIn += expense.moneyIn;
      }
      if (expense.moneyOut > 0) {
        monthlyData[month].moneyOut.push(expense.moneyOut);
        monthlyData[month].totalMoneyOut += expense.moneyOut;
      }
    });

    // Convert to array
    let trendArray = Object.values(monthlyData).map((data) => ({
      month: data.month,
      totalMoneyIn: data.totalMoneyIn,
      totalMoneyOut: data.totalMoneyOut,
      remaining: data.totalMoneyIn - data.totalMoneyOut,
      averageMoneyIn: data.moneyIn.length > 0
        ? data.totalMoneyIn / data.moneyIn.length
        : 0,
      averageMoneyOut: data.moneyOut.length > 0
        ? data.totalMoneyOut / data.moneyOut.length
        : 0,
      transactionCount: data.moneyIn.length + data.moneyOut.length,
    }));

    // Sort by month (descending) and limit
    trendArray.sort((a, b) => b.month.localeCompare(a.month));
    trendArray = trendArray.slice(0, parseInt(limit));

    // Sort by month (ascending) for chart display
    trendArray.sort((a, b) => a.month.localeCompare(b.month));

    // Calculate growth rates
    const trendsWithGrowth = trendArray.map((data, index) => {
      if (index === 0) {
        return {
          ...data,
          moneyInGrowth: 0,
          moneyOutGrowth: 0,
          remainingGrowth: 0,
        };
      }

      const prevData = trendArray[index - 1];
      const moneyInGrowth = prevData.totalMoneyIn !== 0
        ? ((data.totalMoneyIn - prevData.totalMoneyIn) / prevData.totalMoneyIn) * 100
        : 0;
      const moneyOutGrowth = prevData.totalMoneyOut !== 0
        ? ((data.totalMoneyOut - prevData.totalMoneyOut) / prevData.totalMoneyOut) * 100
        : 0;
      const remainingGrowth = prevData.remaining !== 0
        ? ((data.remaining - prevData.remaining) / Math.abs(prevData.remaining)) * 100
        : 0;

      return {
        ...data,
        moneyInGrowth: parseFloat(moneyInGrowth.toFixed(2)),
        moneyOutGrowth: parseFloat(moneyOutGrowth.toFixed(2)),
        remainingGrowth: parseFloat(remainingGrowth.toFixed(2)),
      };
    });

    res.status(200).json({
      success: true,
      count: trendsWithGrowth.length,
      data: trendsWithGrowth,
    });
  } catch (error) {
    console.error('Error in getTrends:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get trends',
    });
  }
};

module.exports = {
  getMonthlyTotals,
  getCategoryDistribution,
  getTrends,
};

