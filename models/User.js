const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'reader', 'consumer'],
      message: '{VALUE} is not a valid role',
    },
    required: [true, 'Role is required'],
  },
});

module.exports = mongoose.model('User', userSchema);
