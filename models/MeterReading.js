const mongoose = require('mongoose');

const meterReadingSchema = new mongoose.Schema(
  {
    meterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meter',
      required: [true, 'Meter reference is required'],
    },
    billingMonth: {
      type: String,
      required: [true, 'Billing month is required'],
      match: [/^\d{4}-\d{2}$/, 'Billing month must be in YYYY-MM format'],
    },
    previousReading: {
      type: Number,
      required: [true, 'Previous reading is required'],
      min: [0, 'Previous reading cannot be negative'],
    },
    currentReading: {
      type: Number,
      required: [true, 'Current reading is required'],
      min: [0, 'Current reading cannot be negative'],
    },
    unitsConsumed: {
      type: Number,
      required: [true, 'Units consumed is required'],
      min: [0, 'Units consumed cannot be negative'],
    },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Entered-by user reference is required'],
    },
  },
  { timestamps: true }
);

// Block duplicate readings for the same meter in the same billing month
meterReadingSchema.index({ meterId: 1, billingMonth: 1 }, { unique: true });

module.exports = mongoose.model('MeterReading', meterReadingSchema);
