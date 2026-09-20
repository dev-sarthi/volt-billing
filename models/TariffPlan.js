const mongoose = require('mongoose');

const slabSchema = new mongoose.Schema(
  {
    minUnits: {
      type: Number,
      required: [true, 'Minimum units is required'],
      min: [0, 'Minimum units cannot be negative'],
    },
    maxUnits: {
      type: Number,
      required: [true, 'Maximum units is required'],
      min: [0, 'Maximum units cannot be negative'],
    },
    ratePerUnit: {
      type: Number,
      required: [true, 'Rate per unit is required'],
      min: [0, 'Rate per unit cannot be negative'],
    },
  },
  { _id: false }
);

const tariffPlanSchema = new mongoose.Schema({
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
  slabs: {
    type: [slabSchema],
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0,
      message: 'At least one slab is required',
    },
  },
  fixedCharge: {
    type: Number,
    required: [true, 'Fixed charge is required'],
    min: [0, 'Fixed charge cannot be negative'],
  },
  active: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model('TariffPlan', tariffPlanSchema);
