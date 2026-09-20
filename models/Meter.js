const mongoose = require('mongoose');

const meterSchema = new mongoose.Schema({
  meterNumber: {
    type: String,
    required: [true, 'Meter number is required'],
    unique: true,
    trim: true,
  },
  consumerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Consumer',
    required: [true, 'Consumer reference is required'],
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive'],
      message: '{VALUE} is not a valid status',
    },
    default: 'active',
  },
  installedDate: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Meter', meterSchema);
