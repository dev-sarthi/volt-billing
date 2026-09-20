const mongoose = require('mongoose');

const consumerSchema = new mongoose.Schema({
  consumerId: {
    type: String,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
  },
  connectionType: {
    type: String,
    enum: {
      values: ['domestic', 'commercial'],
      message: '{VALUE} is not a valid connection type',
    },
    required: [true, 'Connection type is required'],
  },
  utilityType: {
    type: String,
    enum: {
      values: ['electricity', 'water'],
      message: '{VALUE} is not a valid utility type',
    },
    default: 'electricity',
  },
  address: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive'],
      message: '{VALUE} is not a valid status',
    },
    default: 'active',
  },
});

// Auto-generate consumerId like "CNS-0001" before saving
consumerSchema.pre('save', async function (next) {
  if (this.consumerId) return next();

  const last = await mongoose.model('Consumer')
    .findOne({}, { consumerId: 1 })
    .sort({ _id: -1 })
    .lean();

  let nextNum = 1;
  if (last && last.consumerId) {
    const match = last.consumerId.match(/CNS-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  this.consumerId = `CNS-${String(nextNum).padStart(4, '0')}`;
  next();
});

module.exports = mongoose.model('Consumer', consumerSchema);
