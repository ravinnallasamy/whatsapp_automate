const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true // Ensure fast lookups
  },
  accessToken: {
    type: String,
    required: false
  },
  conversationId: {
    type: String,
    required: false
  },
  // Optional debugging field
  tokenLastRefreshedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
