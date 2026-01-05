const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user_id: { type: Number, required: true, index: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['credit', 'debit', 'task', 'referral', 'admin'], required: true },
  service_id: { type: Number, default: null },
  details: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
