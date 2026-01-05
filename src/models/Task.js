const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  points: { type: Number, default: 10 },
  created_by: { type: Number },
  created_at: { type: Date, default: Date.now },
  claimed_by: [{ type: Number }], // user_ids who claimed
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Task', TaskSchema);
