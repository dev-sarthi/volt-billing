const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    consumerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consumer',
      required: [true, 'Consumer reference is required'],
    },
    meterReadingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MeterReading',
      required: [true, 'Meter reading reference is required'],
    },
    billingMonth: {
      type: String,
      required: [true, 'Billing month is required'],
      match: [/^\d{4}-\d{2}$/, 'Billing month must be in YYYY-MM format'],
    },
    usageCharge: {
      type: Number,
      required: [true, 'Usage charge is required'],
      min: [0, 'Usage charge cannot be negative'],
    },
    fixedCharge: {
      type: Number,
      required: [true, 'Fixed charge is required'],
      min: [0, 'Fixed charge cannot be negative'],
    },
    surcharge: {
      type: Number,
      default: 0,
      min: [0, 'Surcharge cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['unpaid', 'paid', 'overdue'],
        message: '{VALUE} is not a valid bill status',
      },
      default: 'unpaid',
    },
    paidDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bill', billSchema);
