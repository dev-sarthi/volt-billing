const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    applicantName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
    },
    connectionType: {
      type: String,
      enum: ['domestic', 'commercial'],
      required: true,
    },
    utilityType: {
      type: String,
      enum: ['electricity', 'water'],
      default: 'electricity',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    documents: [
      {
        filename: String,
        path: String,
        originalName: String,
        mimetype: String,
      }
    ],
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewNotes: {
      type: String,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Application', applicationSchema);
