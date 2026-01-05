const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
  admin_id: { type: Number, required: true },
  action: { type: String, required: true },
  details: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminLog', AdminLogSchema);
