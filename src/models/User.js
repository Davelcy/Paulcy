const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  user_id: { type: Number, index: true, unique: true, required: true },
  username: { type: String },
  balance: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },
  ip_address: { type: String },
  device_id: { type: String },
  joined_date: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'banned', 'blocked'], default: 'active' },
  lastDailyClaim: { type: Date, default: null },
  referral_code: { type: String },
  verified: { type: Boolean, default: false } // verified via web link (IP/device captured)
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
