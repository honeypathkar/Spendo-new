const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  month: {
    type: String,
    required: true,
    // Format: YYYY-MM (e.g., "2024-01")
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  moneyIn: {
    type: Number,
    default: 0,
    min: 0,
  },
  moneyOut: {
    type: Number,
    default: 0,
    min: 0,
  },
  remaining: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
expenseSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Compound index for efficient queries
expenseSchema.index({ userId: 1, month: 1 });
expenseSchema.index({ userId: 1, category: 1 });
expenseSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Expense', expenseSchema);

