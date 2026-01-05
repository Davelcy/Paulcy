const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  referrer_id: { type: Number, required: true, index: true },
  referred_id: { type: Number, required: true, index: true },
  points_earned: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Referral', ReferralSchema);
