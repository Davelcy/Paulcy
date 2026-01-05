const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  user_id: { type: Number, required: true, index: true },
  service_id: { type: Number, required: true },
  quantity: { type: Number, required: true },
  total_points: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  external_id: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
